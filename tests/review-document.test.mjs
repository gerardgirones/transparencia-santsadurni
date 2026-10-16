import test from "node:test";
import assert from "node:assert/strict";
import "./register-source.mjs";
const { comparePscpPublication, pscpPublicationSource, pscpLocalDate, bdnsCallCode, reviewCaseId } = await import("../src/lib/review-document.ts");
const { readReviewJson, fetchReviewCase } = await import("../src/lib/review-case.ts");
const { reviewCaseText } = await import("../src/lib/review-case-text.ts");

const UUID = "11111111-2222-3333-4444-555555555555";
const URL = `https://contractaciopublica.cat/ca/detall-publicacio/${UUID}/300700407`;
const source = pscpPublicationSource(URL);
const row = {source_row_id:"row-1",codi_expedient:"EXP/1/2025",numero_lot:"1",denominacio_adjudicatari:"EMPRESA DE MOSTRA",identificacio_adjudicatari:"B08000002",import_adjudicacio_sense:"14977.30",valor_estimat_contracte:"14977.3",data_adjudicacio_contracte:"2025-12-01T00:00:00.000",tipus_contracte:"Serveis",codi_cpv:"50700000-2"};
const entry = {expedient:"EXP/1/2025",numeroLot:1,nomAdjudicatari:"EMPRESA DE MOSTRA",nifAdjudicatari:"B08000002",importAdjudicacioSenseIva:14977.3,vec:14977.3,dataAdjudicacio:"2025-11-30T23:00:00.000Z",tipusContracte:{ca:"Serveis"},codiCpv:{codi:"50700000-2"}};
const publication = (items=[entry]) => ({idExpedient:UUID,organ:{nom:"Ajuntament de Sant Sadurní d'Anoia",nif:"P0824000D"},dataPublicacioReal:"2026-02-20T11:00:00Z",publicacio:{expedientId:UUID,dadesBasiquesPublicacio:{publicacioAgregada:true,denominacio:{ca:"Publicació trimestral de mostra"}},dadesPublicacio:{contractesAgregada:items}}});
function mockFetch(t,handler) {const previous=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=previous;});}

test("document review constructs official endpoints only and rejects redirects disguised as links",()=>{
  assert.equal(source.url,"https://contractaciopublica.cat/portal-api/documents-publicacio/json/300700407");
  for (const url of [URL.replace("https:","http:"),URL.replace(".cat/",".cat.evil.test/"),URL.replace(".cat/",".cat:8443/"),URL+"?hash=secret",URL+"#private",URL.replace("https://","https://user:pass@"),"http://127.0.0.1/private"]) assert.equal(pscpPublicationSource(url),null);
  assert.equal(bdnsCallCode("https://www.subvenciones.gob.es/bdnstrans/GE/es/convocatoria/12345"),"12345");
  assert.equal(bdnsCallCode("https://www.subvenciones.gob.es.evil.test/bdnstrans/GE/es/convocatoria/12345"),null);
});

test("PSCP timestamps use the Spanish calendar day in winter and summer without inventing a zone",()=>{
  assert.equal(pscpLocalDate("2025-11-30T23:00:00.000Z"),"2025-12-01");
  assert.equal(pscpLocalDate("2025-05-24T22:00:00.000Z"),"2025-05-25");
  assert.equal(pscpLocalDate("2025-05-25"),"2025-05-25");
  assert.equal(pscpLocalDate("2025-05-24T22:00:00"),null);
  assert.equal(pscpLocalDate("2025-02-30T22:00:00Z"),null);
});

test("case ids resolve from encoded page navigation and decoded route handlers",()=>{
  const id="contractes:proximitat-llindar:row-mock-20";
  assert.equal(reviewCaseId(id),id);
  assert.equal(reviewCaseId(encodeURIComponent(id)),id);
  assert.equal(reviewCaseId("%invalid"),null);
  assert.equal(reviewCaseId("x".repeat(301)),null);
});

test("aggregate review selects the exact expedient and lot instead of comparing a quarterly total",()=>{
  const result = comparePscpPublication(row,publication([{...entry,expedient:"OTHER",importAdjudicacioSenseIva:50000},{...entry,numeroLot:2,vec:80000},entry]),source);
  assert.equal(result.status,"contrastada");
  assert.ok(result.checks.every(check=>check.status === "coincideix"));
  assert.equal(result.checks.find(check=>check.label === "Data d’adjudicació").publication,"2025-12-01");
  assert.equal(result.checks.find(check=>check.label === "Valor estimat sense IVA").publication,"14.977,30 €");
});

test("missing estimated value is not zero and a real difference remains explicit",()=>{
  const result=comparePscpPublication({...row,valor_estimat_contracte:undefined},publication([{...entry,importAdjudicacioSenseIva:14000,vec:undefined}]),source);
  assert.equal(result.checks.find(check=>check.label === "Valor estimat sense IVA").status,"no-comparable");
  assert.equal(result.checks.find(check=>check.label === "Adjudicació sense IVA").status,"difereix");
});

test("supplier ids must be complete to compare and are not reproduced in the digest",()=>{
  const matched=comparePscpPublication(row,publication(),source);
  assert.doesNotMatch(JSON.stringify(matched),/B08000002/);
  const masked=comparePscpPublication({...row,identificacio_adjudicatari:"***1234**"},publication([{...entry,nifAdjudicatari:"***1234**"}]),source);
  assert.equal(masked.checks.find(check=>check.label === "Identificació fiscal de l’adjudicatari").status,"no-comparable");
  const different=comparePscpPublication(row,publication([{...entry,nifAdjudicatari:"B08000004"}]),source);
  assert.equal(different.checks.find(check=>check.label === "Identificació fiscal de l’adjudicatari").status,"difereix");
});

test("ambiguous lots, missing lots and unsupported formats do not become a successful contrast",()=>{
  assert.equal(comparePscpPublication(row,publication([entry,entry]),source).status,"ambigu");
  assert.equal(comparePscpPublication({...row,numero_lot:undefined},publication(),source).status,"no-localitzat");
  assert.equal(comparePscpPublication({...row,codi_expedient:"OTHER"},publication(),source).status,"no-localitzat");
  assert.equal(comparePscpPublication(row,{...publication(),publicacio:{expedientId:UUID}},source).status,"no-compatible");
  const old=comparePscpPublication({...row,numero_lot:undefined},publication([{...entry,numeroLot:undefined}]),source);
  assert.equal(old.status,"contrastada");
  assert.equal(old.checks.find(check=>check.label === "Lot").status,"no-comparable");
});

test("a different council or publication never supplies evidence for this council",()=>{
  for(const value of [{...publication(),organ:{nom:"Ajuntament de Vic",nif:"P0824000D"}},{...publication(),organ:{nom:"Ajuntament de Sant Sadurní d'Anoia",nif:"P0000000A",organContractacioId:4491728}},{...publication(),organ:{nom:"Ajuntament de Sant Sadurní d'Anoia",nif:"P0824000D",organContractacioId:12345}},{...publication(),idExpedient:"other"},null]){
    const result=comparePscpPublication(row,value,source);
    assert.equal(result.status,"no-disponible");
    assert.deepEqual(result.checks,[]);
  }
  assert.equal(comparePscpPublication(row,{...publication(),organ:{nom:"Ajuntament de Sant Sadurní d'Anoia",organContractacioId:4491728}},source).status,"contrastada");
});

test("publication reads reject oversized, failed and legacy XML responses without following redirects",async t=>{
  let mode="xml";
  mockFetch(t,async(_url,options)=>{
    assert.equal(options.redirect,"error");assert.ok(options.signal);
    return mode === "xml" ? new Response("<Notice>legacy XML</Notice>",{headers:{"Content-Type":"application/json"}})
      : mode === "large" ? new Response("{}",{headers:{"Content-Length":"6000000"}})
      : new Response("Unavailable",{status:503});
  });
  await assert.rejects(readReviewJson(source.url,AbortSignal.timeout(1000)),SyntaxError);
  mode="large";await assert.rejects(readReviewJson(source.url,AbortSignal.timeout(1000)),/too large/);
  mode="failed";await assert.rejects(readReviewJson(source.url,AbortSignal.timeout(1000)),/unavailable/);
});

test("case export preserves source differences, limitations and the missing value distinction",()=>{
  const result=reviewCaseText({status:"found",finding:{id:"test",title:"Avís de mostra",section:"contractes",rule:"proximitat-llindar",reason:"Import proper al llindar.",limitation:"No prova fraccionament.",evidence:[{id:"row-1",title:"Servei de mostra",beneficiary:"EMPRESA DE MOSTRA",date:"2025-12-01",amount:null,sourceUrl:URL,publicationUrl:null}]},documents:[{id:"row-1",expedient:"EXP/1/2025",...comparePscpPublication({...row,valor_estimat_contracte:undefined},publication(),source)}],calls:[],omittedCalls:0,timeline:[],checkedAt:"2026-10-16T10:00:00Z",rulesVersion:"v1",documentVersion:"v2",questions:["Consultar l’informe de necessitat."]});
  assert.match(result,/No interpretable/);assert.match(result,/catàleg = No informat; publicació = 14.977,30 €; resultat = no-comparable/);
  assert.ok(result.includes(source.url));assert.match(result,/no és una auditoria independent/);assert.match(result,/informe de necessitat/);
});

test("a missing case cannot trigger arbitrary publication requests",async t=>{
  const urls=[];
  mockFetch(t,async url=>{
    urls.push(String(url));
    return String(url).includes("subvenciones.gob.es") ? Response.json({totalElements:0,content:[]}) : Response.json([{total_catalog_rows:"0"}]);
  });
  assert.equal((await fetchReviewCase("does-not-exist")).status,"missing");
  assert.ok(urls.every(url=>!url.includes("contractaciopublica.cat")));
});

test("a large grouped case reads at most four publications and marks the remaining evidence pending",async t=>{
  let publicationRequests=0;
  const rows=Array.from({length:5},(_,i)=>({...row,nom_organ:"Ajuntament de Sant Sadurní d'Anoia",source_row_id:`row-${i}`,codi_expedient:`EXP/${i}/2025`,identificacio_adjudicatari:"B08000002",procediment:"Contracte menor",fase_publicacio:"Publicació agregada de contractes",resultat:"Adjudicat",enllac_publicacio:{url:URL.replace("300700407",String(300700407+i))}}));
  mockFetch(t,async url=>{
    const u=new globalThis.URL(url);
    if(u.hostname === "analisi.transparenciacatalunya.cat") return Response.json(u.searchParams.get("$select").includes("total_catalog_rows") ? [{total_catalog_rows:"5"}] : rows);
    if(u.hostname === "www.subvenciones.gob.es") return Response.json({totalElements:0,content:[]});
    if(u.hostname === "contractaciopublica.cat") { publicationRequests++;return Response.json(publication(rows.map(item=>({...entry,expedient:item.codi_expedient})))); }
    throw new Error("Unexpected request");
  });
  const data=await fetchReviewCase(encodeURIComponent("contractes:reiteracio-menors:row-0"));
  assert.equal(data.status,"found");assert.equal(publicationRequests,4);
  assert.equal(data.documents.filter(item=>item.status === "contrastada").length,4);
  assert.match(data.documents.at(-1).message,/límit de quatre/);
});

test("BDNS context verifies municipal identity and cannot attach a contract with a colliding row id",async t=>{
  let publicationRequests=0;
  const grant={date:"2025-12-01",title:"Ajut de mostra",beneficiary:"ENTITAT DE MOSTRA",amount:1000,basesUrl:"",callUrl:"https://www.subvenciones.gob.es/bdnstrans/GE/es/convocatoria/12345"};
  mockFetch(t,async url=>{
    const u=new globalThis.URL(url);
    if(u.hostname === "analisi.transparenciacatalunya.cat") return Response.json(u.searchParams.get("$select").includes("total_catalog_rows") ? [{total_catalog_rows:"1"}] : [{...row,nom_organ:"Ajuntament de Sant Sadurní d'Anoia",source_row_id:"1",enllac_publicacio:{url:URL}}]);
    if(u.pathname.endsWith("/busqueda")) return Response.json({totalElements:2,content:[{...grant,id:1,fechaConcesion:grant.date,convocatoria:grant.title,beneficiario:grant.beneficiary,importe:1000,numeroConvocatoria:"12345"},{...grant,id:2,fechaConcesion:grant.date,convocatoria:grant.title,beneficiario:grant.beneficiary,importe:1000,numeroConvocatoria:"12345"}]});
    if(u.hostname === "www.subvenciones.gob.es") return Response.json({codigoBDNS:"12345",organo:{nivel2:"VIC",nivel3:"AYUNTAMIENTO DE VIC"},presupuestoTotal:19000});
    publicationRequests++;throw new Error("Unexpected contract request");
  });
  const data=await fetchReviewCase("subvencions:coincidencia:1");
  assert.equal(data.status,"found");assert.equal(publicationRequests,0);assert.deepEqual(data.documents,[]);
  assert.equal(data.calls[0].status,"no-disponible");assert.equal(data.calls[0].budget,null);
});
