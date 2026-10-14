import test from "node:test";
import assert from "node:assert/strict";
import "./register-source.mjs";

const {
  fetchBudgetLines,
  fetchTransparencyContracts,
  fetchTransparencySummary,
  fetchSubsidiesExplorer,
  fetchSubsidiesAvailableYears,
  fetchSubsidiesCoverage,
} = await import("../src/lib/transparency.ts");
const { AOC_RESOURCE_IDS } = await import("../src/config/constants.ts");

function reply(records, total = records.length) {
  return Response.json({ success: true, result: { records, total } });
}

function grant(id, values = {}) {
  return { id, fechaConcesion: "2025-01-01", convocatoria: "Subvenció", beneficiario: "Entitat", importe: 10, ...values };
}

function grantReply(content, totalElements = content.length) {
  return Response.json({ content, totalElements });
}

function mockFetch(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = (url, options) => Promise.resolve(handler(new URL(url), options));
  t.after(() => { globalThis.fetch = previous; });
}

test("budget and contracts send text municipality codes; budget uses one expenditure classification", async (t) => {
  mockFetch(t, (url) => {
    const resource = url.searchParams.get("resource_id");
    const filters = JSON.parse(url.searchParams.get("filters"));
    if (resource === AOC_RESOURCE_IDS.contracts) {
      assert.equal(filters.CODI_INE10, "824010007");
      return reply([]);
    }
    assert.deepEqual(filters, { CODI_ENS: "824010007", TIPUS_PARTIDA: "D", TIPUS_CLASSIF: "F", NIVELL: "1" });
    return reply([
      { ANY_EXERCICI: "2026", TIPUS_PARTIDA: "D", NIVELL: "1", IMPORT: "1.234,56", DESCRIPCIO: "Serveis" },
      { ANY_EXERCICI: "2025", TIPUS_PARTIDA: "D", NIVELL: "1", IMPORT: "100,00" },
    ]);
  });
  const budget = await fetchBudgetLines();
  assert.equal(budget.length, 1);
  assert.equal(budget[0].import, 1234.56);
  await fetchTransparencyContracts();
});

test("subsidies beyond the old 2,500-row limit remain searchable, including 2026", async (t) => {
  const rows = Array.from({ length: 2501 }, (_, i) => ({
    ...grant(i + 1),
    fechaConcesion: i === 2500 ? "2026-06-01" : "2025-01-01",
    convocatoria: `Subvenció ${i}`,
  }));
  const offsets = [];
  mockFetch(t, (url) => {
    const limit = Number(url.searchParams.get("pageSize"));
    const offset = Number(url.searchParams.get("page")) * limit;
    offsets.push(offset);
    assert.equal(url.searchParams.get("order"), "codConcesion");
    assert.equal(url.searchParams.get("organos"), "413");
    return grantReply(rows.slice(offset, offset + limit), rows.length);
  });
  const list = await fetchSubsidiesExplorer({ year: "2026" });
  assert.equal(list.total, 1);
  assert.equal(list.data[0].titol, "Subvenció 2500");
  assert.deepEqual(offsets, Array.from({ length: 26 }, (_, i) => i * 100));
  assert.deepEqual(await fetchSubsidiesAvailableYears(), ["2026", "2025"]);
  assert.equal((await fetchSubsidiesCoverage()).latestGrantDate, "2026-06-01");
});

test("coverage reports the actual latest concession and does not invent current-year data", async (t) => {
  mockFetch(t, () => grantReply([grant(1, { fechaConcesion: "2025-12-11", importe: 10000 })]));
  const coverage = await fetchSubsidiesCoverage();
  assert.equal(coverage.latestGrantDate, "2025-12-11");
  assert.equal(coverage.totalRecords, 1);
  assert.equal(coverage.currentYear, new Date().getFullYear());
  assert.equal((await fetchSubsidiesExplorer({ year: "2026" })).total, 0);
});

test("decimal amount filters preserve both dot and comma decimals", async (t) => {
  mockFetch(t, () => grantReply([
    grant(1, { importe: 100.25, convocatoria: "Petit" }),
    grant(2, { importe: 100.75, convocatoria: "Gran" }),
  ]));
  for (const amountMin of ["100.50", "100,50"]) {
    const result = await fetchSubsidiesExplorer({ amountMin });
    assert.equal(result.total, 1);
    assert.equal(result.data[0].titol, "Gran");
  }
});

test("unsuccessful and truncated CKAN responses are errors rather than empty datasets", async (t) => {
  mockFetch(t, () => Response.json({ success: false }));
  await assert.rejects(fetchBudgetLines(), /unsuccessful/);
  globalThis.fetch = async () => reply([], 10);
  await assert.rejects(fetchBudgetLines(), /incomplete/);
});

test("summary sums every page and isolates a failed budget without consulting salaries", async (t) => {
  const subsidies = Array.from({ length: 1201 }, (_, i) => grant(i + 1, { importe: 2 }));
  const agreements = Array.from({ length: 1001 }, () => ({ TOTAL_APORTACIONS_PREVISTES: 3 }));
  const previousError = console.error;
  console.error = () => {};
  t.after(() => { console.error = previousError; });
  mockFetch(t, (url) => {
    if (url.hostname === "analisi.transparenciacatalunya.cat") {
      return Response.json([{ total: url.searchParams.get("$select").includes("count") ? "10" : "500" }]);
    }
    if (url.hostname === "www.subvenciones.gob.es") {
      assert.equal(url.pathname, "/bdnstrans/api/concesiones/busqueda");
      const offset = Number(url.searchParams.get("page")) * 100;
      return grantReply(subsidies.slice(offset, offset + 100), subsidies.length);
    }
    assert.equal(url.hostname, "dadesobertes.seu-e.cat", "No salary website should be requested");
    const resource = url.searchParams.get("resource_id");
    if (resource === AOC_RESOURCE_IDS.budgetByProgram) return new Response("Invalid query", { status: 409 });
    const offset = Number(url.searchParams.get("offset"));
    if (resource === AOC_RESOURCE_IDS.cooperationAgreements) return reply(agreements.slice(offset, offset + 1000), agreements.length);
    if (resource === AOC_RESOURCE_IDS.plenaryMinutes) return reply([], 242);
    assert.fail(`Unexpected source: ${resource}`);
  });
  const summary = await fetchTransparencySummary();
  assert.equal(summary.contractsTotal, 10);
  assert.equal(summary.subsidiesTotal, 1201);
  assert.equal(summary.subsidiesAmount, 2402);
  assert.equal(summary.agreementsTotal, 1001);
  assert.equal(summary.agreementsAmount, 3003);
  assert.equal(summary.currentBudgetAmount, undefined);
  assert.deepEqual(summary.unavailableSources, ["pressupost"]);
});
