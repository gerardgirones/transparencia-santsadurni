import test from "node:test";
import assert from "node:assert/strict";
import "./register-source.mjs";

const api = await import("../src/lib/api.ts");
const { socrataFetch } = await import("../src/lib/socrata.ts");
const { buildCompanyHref } = await import("../src/lib/company-identity.ts");
const { isContractSortKey } = await import("../src/lib/contract-sort.ts");
const company = (id, name, total = "100", year = "20") => ({
  identificacio_adjudicatari: id, denominacio_adjudicatari: name,
  total, num_contracts: "1", total_current_year: year,
});

function mockFetch(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, options) => handler(new URL(url), options);
  t.after(() => { globalThis.fetch = previous; });
}

function assertMunicipal(url) {
  const where = url.searchParams.get("$where");
  assert.match(where, /upper\(nom_organ\)=upper\('Ajuntament de Sant Sadurní d''Anoia'\)/);
  assert.match(where, /upper\(lloc_execucio\)=upper\('Sant Sadurní d''Anoia'\)/);
}

test("sorting rejects inherited properties and preserves awardee ordering", () => {
  assert.equal(isContractSortKey("__proto__"), false);
  assert.equal(isContractSortKey("constructor"), false);
  assert.equal(isContractSortKey("amount-desc"), true);
  assert.equal(isContractSortKey("awardee-asc"), true);
});

test("municipal company search preserves aliases, separates masked ids and shares its catalogue with the count", async t => {
  let requests = 0;
  mockFetch(t, async url => {
    assertMunicipal(url);
    requests++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json([
      company("B08000002", "NETEJA PÚBLICA SL", "100"),
      company("B08000002", "SERVEIS ANTICS SL", "50", "10"),
      company("***1234**", "PERSONA A", "30"),
      company("***1234**", "PERSONA B", "40"),
      company("A08000001||B08000002", "UNIÓ TEMPORAL", "200"),
    ]);
  });
  const [rows, count] = await Promise.all([api.fetchCompanies(), api.fetchCompaniesCount()]);
  assert.equal(requests, 1);
  assert.equal(count, 4);
  assert.equal(rows.find(row => row.identificacio_adjudicatari === "B08000002").total, "150");
  assert.equal(rows.find(row => row.identificacio_adjudicatari === "B08000002").total_current_year, "30");
  assert.ok(rows.some(row => row.identificacio_adjudicatari === "A08000001||B08000002"));
  const matches = await api.fetchCompanies(0, 50, "publica neteja");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].total, "150");
  assert.equal((await api.fetchCompanies(0, 50, "antics"))[0].total, "150");
  assert.equal((await api.fetchCompanies(0, 50, "B-08000002")).length, 1);
  assert.equal((await api.fetchCompanies(0, 50, "inexistent")).length, 0);
});

test("company catalogue continues past the first page and keeps CPV filters in every request", async t => {
  const offsets = [];
  mockFetch(t, url => {
    assertMunicipal(url);
    assert.match(url.searchParams.get("$where"), /codi_cpv like '45%'/);
    const offset = Number(url.searchParams.get("$offset"));
    offsets.push(offset);
    return Response.json(offset === 0
      ? Array.from({length: 1000}, (_, i) => company(`B${String(i).padStart(8,"0")}`, `EMPRESA ${i}`))
      : [company("B99999999", "ÚLTIMA EMPRESA")]);
  });
  assert.equal(await api.fetchCompaniesCount(undefined, ["45"]), 1001);
  assert.deepEqual(offsets, [0, 1000]);
});

test("masked company links retain the name and all detail queries scope that identity", async t => {
  assert.equal(buildCompanyHref("***1234**", "PERSONA A"), "/empreses/***1234**?name=PERSONA%20A");
  const queries = [];
  mockFetch(t, url => {
    assertMunicipal(url);
    queries.push(url.searchParams.get("$where"));
    return Response.json([]);
  });
  await api.fetchCompanyDetail("***1234**", "PERSONA A");
  await api.fetchCompanyContracts("***1234**", 0, 50, "PERSONA A");
  await api.fetchCompanyContractsCount("***1234**", "PERSONA A");
  await api.fetchCompanyLastAwardDate("***1234**", "PERSONA A");
  await api.fetchCompanyTopOrgans("***1234**", 10, "PERSONA A");
  assert.ok(queries.every(query => query.includes("upper(denominacio_adjudicatari)=upper('PERSONA A')")));
  queries.length = 0;
  await api.fetchCompanyDetail("***1234**");
  assert.ok(queries.every(query => query.includes("1=0")));
});

test("contract list and count share identity, date bounds and municipal scope", async t => {
  const queries = [];
  mockFetch(t, url => {
    assertMunicipal(url);
    queries.push(url.searchParams.get("$where"));
    return Response.json([]);
  });
  const filters = { nif: "***1234**", awardee_name: "PERSONA B", dateFrom: "2026-01-01", dateTo: "2026-10-15" };
  await Promise.all([api.fetchContracts(filters), api.fetchContractsCount(filters)]);
  assert.equal(queries[0], queries[1]);
  assert.match(queries[0], /upper\('PERSONA B'\)/);
  assert.match(queries[0], />= '2026-01-01T00:00:00'/);
  assert.match(queries[0], /< '2026-10-16T00:00:00'/);
  queries.length = 0;
  await api.fetchContracts({dateFrom:"2026-02-30",dateTo:"2026-01-01' OR 1=1"});
  assert.doesNotMatch(queries[0], /2026-02-30|OR 1=1/);
});

test("minor-contract chart uses one municipal grouped request and fills empty buckets", async t => {
  let requests = 0;
  mockFetch(t, url => {
    requests++;
    assertMunicipal(url);
    assert.equal(url.searchParams.get("$group"), "bucket");
    return Response.json([{bucket:"2",total:"3"},{bucket:"30",total:"7"}]);
  });
  const buckets = await api.fetchThresholdDistribution();
  assert.equal(requests, 1);
  assert.equal(buckets.length, 29);
  assert.equal(buckets[0].count, 3);
  assert.equal(buckets[1].count, 0);
  assert.equal(buckets.at(-1).count, 7);
});

test("Socrata retries temporary errors but fails immediately on bad queries", async t => {
  let requests = 0;
  mockFetch(t, () => ++requests === 1 ? new Response("temporary", {status:503}) : Response.json([{ok:true}]));
  assert.deepEqual(await socrataFetch("https://example.test/retry", {}), [{ok:true}]);
  assert.equal(requests, 2);
  requests = 0;
  globalThis.fetch = async () => { requests++; return new Response("bad query",{status:400}); };
  await assert.rejects(socrataFetch("https://example.test/bad", {}), /400/);
  assert.equal(requests, 1);
});
