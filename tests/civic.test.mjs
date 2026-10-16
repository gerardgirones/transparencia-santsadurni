import test from "node:test";
import assert from "node:assert/strict";
import "./register-source.mjs";

const {extractPlenarySummary} = await import("../src/lib/plenary-summary.ts");
const {supportedPlenaryPdf} = await import("../src/lib/plenary-source.ts");
const {reviewContracts,reviewGrants} = await import("../src/lib/review-rules.ts");
const {fetchCouncilContractCatalog} = await import("../src/lib/api.ts");
const {fetchPlenaryCatalog} = await import("../src/lib/transparency.ts");
const TODAY = "2026-10-15";
const ORGAN = "Ajuntament de Sant Sadurní d'Anoia";
const contract = (overrides={}) => ({source_row_id:"row-1",nom_organ:ORGAN,codi_expedient:"EXP-1",numero_lot:"1",denominacio:"Servei de manteniment",tipus_contracte:"Serveis",procediment:"Contracte menor",fase_publicacio:"Adjudicació",resultat:"Adjudicat",identificacio_adjudicatari:"B08000002",denominacio_adjudicatari:"EMPRESA DE MOSTRA",import_adjudicacio_sense:"6000",data_adjudicacio_contracte:"2026-01-10",data_publicacio_anunci:"2026-01-11",codi_cpv:"50000000-5",enllac_publicacio:{url:"https://contractaciopublica.cat/exp/1"},...overrides});
const grant = (overrides={}) => ({id:"1",date:"2026-01-10",title:"Ajut cultural",beneficiary:"ENTITAT DE MOSTRA",amount:1000,basesUrl:"https://seu-e.cat/bases",callUrl:"https://www.subvenciones.gob.es/bdnstrans/GE/es/convocatorias/933923",...overrides});
function mockFetch(t,handler) {const previous=globalThis.fetch;globalThis.fetch=async(url,options)=>handler(new URL(url),options);t.after(()=>{globalThis.fetch=previous;});}

test("plenary extraction only downloads the official council document paths", () => {
  assert.equal(supportedPlenaryPdf("https://media.seu-e.cat/acteca/824010007/2026/acta.pdf"),true);
  for (const url of ["http://media.seu-e.cat/acteca/824010007/a.pdf","https://media.seu-e.cat/acteca/111111111/a.pdf","https://media.seu-e.cat.evil.test/acteca/824010007/a.pdf","https://user:password@media.seu-e.cat/acteca/824010007/a.pdf","https://media.seu-e.cat/acteca/824010007/../111111111/a.pdf","http://127.0.0.1:3100/private"]) assert.equal(supportedPlenaryPdf(url),false);
});

test("plenary digest preserves document evidence, vote counts and page references without attendance ids", () => {
  const summary=extractPlenarySummary([
    {num:1,text:"ASSISTÈNCIA\n12345678Z Persona\n1.- Aprovació de l’acta anterior\nFavorable Tipus de votació: Ordinària\nA favor: 15, En contra: 0, Abstencions: 1\nResolució:\nPRIMER: Aprovar l’acta. Codi Validació: SECRET\nACTA DEL PLE"},
    {num:2,text:"2.- Aprovació d’un ajut\nper a una activitat cultural\nFavorable Tipus de votació: Unanimitat\nResolució:\nPRIMER: Aprovar l’ajut segons l’informe de 87654321X i X1234567T.\nSEGON: Notificar l’acord."},
  ]);
  assert.equal(summary.points.length,2);
  assert.equal(summary.points[0].page,1);
  assert.equal(summary.points[0].votes,"A favor: 15, En contra: 0, Abstencions: 1");
  assert.equal(summary.points[1].title,"Aprovació d’un ajut per a una activitat cultural");
  assert.equal(summary.points[1].excerptPage,2);
  assert.doesNotMatch(JSON.stringify(summary),/12345678Z|87654321X|X1234567T|SECRET|Notificar l’acord/);
});

test("unrecognised or scanned minutes never receive an invented summary or vote", () => {
  assert.deepEqual(extractPlenarySummary([{num:1,text:"Document escanejat"}]).points,[]);
  const point=extractPlenarySummary([{num:1,text:"1.- Preguntes dels grups municipals\nIntervencions i debat"}]).points[0];
  assert.equal(point.outcome,null);
  assert.equal(point.votes,null);
  assert.equal(point.excerpt,null);
});

test("threshold screening distinguishes services from works, excludes historic and cancelled awards", () => {
  const rows=[contract({source_row_id:"services",import_adjudicacio_sense:"14950"}),contract({source_row_id:"works-low",tipus_contracte:"Obres",import_adjudicacio_sense:"14950"}),contract({source_row_id:"works-high",tipus_contracte:"Obres",import_adjudicacio_sense:"39800"}),contract({source_row_id:"old",data_adjudicacio_contracte:"2017-01-01",import_adjudicacio_sense:"14950"}),contract({source_row_id:"cancelled",resultat:"Desert",import_adjudicacio_sense:"14950"})];
  const flags=reviewContracts(rows,TODAY).filter(row=>row.rule==="proximitat-llindar");
  assert.deepEqual(flags.map(row=>row.evidence[0].id),["services","works-high"]);
  assert.ok(flags.every(row=>row.limitation.includes("no el valor estimat legal")));
});

test("lots and publication phases are not silently labelled as duplicated payments", () => {
  const rows=[contract(),contract({source_row_id:"row-2",numero_lot:"2"}),contract({source_row_id:"row-3",fase_publicacio:"Formalització"})];
  assert.equal(reviewContracts(rows,TODAY).filter(row=>row.rule==="coincidencia-registres").length,0);
  const duplicates=reviewContracts([contract(),contract({source_row_id:"row-2"})],TODAY).filter(row=>row.rule==="coincidencia-registres");
  assert.equal(duplicates.length,1);
  assert.match(duplicates[0].limitation,/ni afirma/);
});

test("recurrence needs three separate expedients and ignores repeated phases, masked ids and conflicting versions", () => {
  const rows=[0,1,2].map(i=>contract({source_row_id:`row-${i}`,codi_expedient:`EXP-${i}`,data_adjudicacio_contracte:`2026-01-${10+i}`}));
  assert.equal(reviewContracts(rows,TODAY).filter(row=>row.rule==="reiteracio-menors").length,1);
  assert.equal(reviewContracts(rows.map(row=>({...row,codi_expedient:"SAME",numero_lot:row.source_row_id})),TODAY).filter(row=>row.rule==="reiteracio-menors").length,0);
  assert.equal(reviewContracts(rows.map(row=>({...row,identificacio_adjudicatari:"***1234**"})),TODAY).filter(row=>row.rule==="reiteracio-menors").length,0);
  assert.equal(reviewContracts([...rows.slice(0,2),{...rows[0],source_row_id:"phase",fase_publicacio:"Formalització"}],TODAY).filter(row=>row.rule==="reiteracio-menors").length,0);
  assert.equal(reviewContracts([...rows,{...rows[0],source_row_id:"correction",import_adjudicacio_sense:"6500"}],TODAY).filter(row=>row.rule==="reiteracio-menors").length,0);
});

test("review does not mistake announcements, aggregate amounts or anonymisation for misconduct", () => {
  assert.equal(reviewContracts([contract({fase_publicacio:"Anunci de licitació",denominacio_adjudicatari:"",import_adjudicacio_sense:""})],TODAY).length,0);
  const flags=reviewContracts([contract({import_adjudicacio_sense:"14950||14950",identificacio_adjudicatari:"***1234**"})],TODAY);
  assert.equal(flags.some(row=>row.rule==="proximitat-llindar"),false);
  assert.equal(flags.filter(row=>row.rule==="import-no-interpretable").length,1);
  assert.ok(flags.every(row=>row.kind==="qualitat"));
  assert.equal(reviewContracts([contract({fase_publicacio:"Publicació agregada de contractes",es_agregada:"SÍ",import_adjudicacio_sense:"14950"})],TODAY).some(row=>row.rule==="proximitat-llindar"),true);
});

test("BDNS coincidences require the same call and never use contract thresholds", () => {
  assert.equal(reviewGrants([grant({amount:14950}),grant({id:"2",amount:14950,callUrl:"https://www.subvenciones.gob.es/bdnstrans/GE/es/convocatorias/11111"})],TODAY).length,0);
  const flags=reviewGrants([grant(),grant({id:"2"})],TODAY);
  assert.equal(flags.length,1);
  assert.equal(flags[0].rule,"coincidencia-concessions");
  assert.match(flags[0].limitation,/no prova un doble cobrament/);
  assert.equal(reviewGrants([grant({callUrl:null}),grant({id:"2",callUrl:null})],TODAY).length,0);
});

test("full council catalogue retains all publication phases with exact council scope", async t => {
  mockFetch(t,url=>{
    assert.match(url.searchParams.get("$where"),/upper\(nom_organ\)=upper\('Ajuntament de Sant Sadurní d''Anoia'\)/);
    if (url.searchParams.get("$select").includes("total_catalog_rows")) return Response.json([{total_catalog_rows:"2"}]);
    assert.equal(url.searchParams.get("$order"),":id ASC");
    return Response.json([contract(),contract({source_row_id:"row-2",fase_publicacio:"Anunci de licitació"})]);
  });
  assert.equal((await fetchCouncilContractCatalog()).length,2);
});

test("an incomplete, repeated or out-of-scope council catalogue cannot produce a report", async t => {
  let mode="partial";
  mockFetch(t,url=>url.searchParams.get("$select").includes("total_catalog_rows") ? Response.json([{total_catalog_rows:"2"}]) : Response.json(mode==="partial" ? [contract()] : mode==="duplicate" ? [contract(),contract()] : [contract(),contract({source_row_id:"row-2",nom_organ:"Ajuntament de Vic"})]));
  await assert.rejects(fetchCouncilContractCatalog(),/truncated/);
  mode="duplicate";await assert.rejects(fetchCouncilContractCatalog(),/identity/);
  mode="scope";await assert.rejects(fetchCouncilContractCatalog(),/scope/);
});

test("council review reads past the first thousand published rows", async t => {
  const offsets=[];
  mockFetch(t,url=>{
    if (url.searchParams.get("$select").includes("total_catalog_rows")) return Response.json([{total_catalog_rows:"1001"}]);
    const offset=Number(url.searchParams.get("$offset"));offsets.push(offset);
    return Response.json(Array.from({length:offset === 0 ? 1000 : 1},(_,i)=>({source_row_id:`row-${offset+i}`,nom_organ:ORGAN})));
  });
  assert.equal((await fetchCouncilContractCatalog()).length,1001);
  assert.deepEqual(offsets,[0,1000]);
});

test("plenary catalogue uses every CKAN page and the council's numeric source code", async t => {
  mockFetch(t,url=>{
    assert.equal(url.searchParams.get("resource_id"),"b5d370d0-7916-48b6-8a69-3c7fa62a1467");
    assert.equal(JSON.parse(url.searchParams.get("filters")).CODI_ENS,824010007);
    return Response.json({success:true,result:{total:1,records:[{CODI_ACTA:"ple-2026",DATA_ACORD:"2026-05-26T00:00:00",TIPUS:"Ordinària","ENLLAÇ_ACTA":"https://media.seu-e.cat/acteca/824010007/2026/acta.pdf"}]}});
  });
  assert.equal((await fetchPlenaryCatalog())[0].codiActa,"ple-2026");
});
