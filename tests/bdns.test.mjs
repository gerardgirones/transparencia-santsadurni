import test from "node:test";
import assert from "node:assert/strict";
import "./register-source.mjs";

const { fetchSubsidyCalls, resolveSubsidyCallFilters } = await import("../src/lib/bdns.ts");

const call = (code = "933923") => ({
  numeroConvocatoria: code,
  descripcion: "ACTIVIDADES CULTURALES",
  descripcionLeng: "ACTIVITATS CULTURALS",
  fechaRecepcion: "2026-10-07",
});

function mockFetch(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, options) => handler(new URL(url), options);
  t.after(() => { globalThis.fetch = previous; });
}

test("BDNS searches municipal calls by registration year and keeps budgets separate from grants", async (t) => {
  mockFetch(t, (url, options) => {
    assert.equal(options.next.revalidate, 21600);
    assert.equal(url.hostname, "www.subvenciones.gob.es");
    if (url.pathname.endsWith("/busqueda")) {
      assert.equal(url.searchParams.get("organos"), "413");
      assert.equal(url.searchParams.get("tipoAdministracion"), "L");
      assert.equal(url.searchParams.get("fechaDesde"), "01/01/2026");
      assert.equal(url.searchParams.get("fechaHasta"), "31/12/2026");
      assert.equal(url.searchParams.get("page"), "0");
      return Response.json({ content: [call()], totalElements: 13 });
    }
    assert.equal(url.searchParams.get("numConv"), "933923");
    return Response.json({ codigoBDNS: "933923", presupuestoTotal: 19000, tipoConvocatoria: "Concurrencia competitiva - canónica" });
  });
  const result = await fetchSubsidyCalls({ year: "2026" });
  assert.equal(result.total, 13);
  assert.equal(result.data[0].title, "ACTIVITATS CULTURALS");
  assert.equal(result.data[0].budget, 19000);
  assert.equal(result.data[0].registeredAt, "2026-10-07");
  assert.equal(result.data[0].url, "https://www.subvenciones.gob.es/bdnstrans/GE/es/convocatoria/933923");
  assert.equal(result.data[0].detailUnavailable, false);
});

test("BDNS pagination and title search remain scoped to the granting body", async (t) => {
  mockFetch(t, (url) => {
    assert.equal(url.searchParams.get("page"), "1");
    assert.equal(url.searchParams.get("pageSize"), "20");
    assert.equal(url.searchParams.get("organos"), "413");
    assert.equal(url.searchParams.get("descripcion"), "Festa d'estiu & cultura");
    assert.equal(url.searchParams.get("descripcionTipoBusqueda"), "0");
    return Response.json({ content: [], totalElements: 20 });
  });
  const result = await fetchSubsidyCalls({ year: "2025", page: 2, search: "  Festa d'estiu & cultura  " });
  assert.equal(result.page, 2);
  assert.equal(result.total, 20);
});

test("a failed or mismatched detail keeps the call visible and never becomes a zero budget", async (t) => {
  mockFetch(t, (url) => {
    if (url.pathname.endsWith("/busqueda")) {
      return Response.json({ content: [call("100"), call("101"), call("102")], totalElements: 3 });
    }
    const code = url.searchParams.get("numConv");
    if (code === "100") return new Response("Unavailable", { status: 503 });
    if (code === "101") return Response.json({ codigoBDNS: "999", presupuestoTotal: 500 });
    return Response.json({ codigoBDNS: "102", presupuestoTotal: 0 });
  });
  const { data } = await fetchSubsidyCalls();
  assert.equal(data.length, 3);
  assert.equal(data[0].budget, null);
  assert.equal(data[0].detailUnavailable, true);
  assert.equal(data[1].budget, null);
  assert.equal(data[2].budget, 0);
  assert.equal(data[2].detailUnavailable, false);
});

test("failed or invalid BDNS listings are errors rather than zero calls", async (t) => {
  mockFetch(t, () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(fetchSubsidyCalls(), /BDNS API error/);
  globalThis.fetch = async () => Response.json({ content: [], totalElements: null });
  await assert.rejects(fetchSubsidyCalls(), /invalid call listing/);
  globalThis.fetch = async () => Response.json({ content: [{ numeroConvocatoria: "../other" }], totalElements: 1 });
  await assert.rejects(fetchSubsidyCalls(), /invalid call code/);
});

test("detail requests have bounded concurrency", async (t) => {
  let active = 0;
  let peak = 0;
  mockFetch(t, async (url) => {
    if (url.pathname.endsWith("/busqueda")) {
      return Response.json({ content: Array.from({ length: 13 }, (_, i) => call(String(i + 100))), totalElements: 13 });
    }
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return Response.json({ codigoBDNS: url.searchParams.get("numConv"), presupuestoTotal: 50 });
  });
  const result = await fetchSubsidyCalls();
  assert.ok(peak <= 4);
  assert.equal(result.data.filter((row) => row.budget === 50).length, 13);
});

test("invalid year and page parameters resolve to a safe current-year query", () => {
  const result = resolveSubsidyCallFilters({ year: "not-a-year", page: -10, search: "x".repeat(500) });
  assert.equal(result.year, new Date().getFullYear());
  assert.equal(result.page, 1);
  assert.equal(result.search.length, 200);
});
