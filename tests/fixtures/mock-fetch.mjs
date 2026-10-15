// Opt-in fixtures for build:test and Playwright only. Production never imports
// this module. Unit tests separately assert the real outgoing source filters.
import { answer } from "./socrata.mjs";

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "analisi.transparenciacatalunya.cat") {
    if (process.env.MOCK_ANALYSIS_FAILURE === "1" && url.searchParams.get("$group") === "nom_organ" && url.searchParams.get("$where")?.includes("14900")) {
      return new Response("Simulated source outage", {status:503});
    }
    if (url.pathname.includes("ybgg-dgi6") && !url.searchParams.get("$where")?.includes("Sant Sadurní")) {
      throw new Error("A contract request escaped municipal scope");
    }
    return Response.json(answer(url.searchParams));
  }
  if (url.hostname === "dadesobertes.seu-e.cat") {
    const filters = JSON.parse(url.searchParams.get("filters") || "{}");
    if (!Object.values(filters).map(String).includes("824010007")) throw new Error("An AOC request escaped municipal scope");
    return Response.json({success:true,result:{records:[],total:0}});
  }
  if (url.hostname === "www.subvenciones.gob.es") {
    if (url.pathname.endsWith("/busqueda")) {
      if (url.searchParams.get("organos") !== "413") throw new Error("A BDNS request escaped municipal scope");
      if (url.pathname.includes("concesiones")) {
        return Response.json({totalElements:1,content:[{id:1,fechaConcesion:"2025-12-11",convocatoria:"SUBVENCIÓ CULTURAL DE MOSTRA",beneficiario:"ENTITAT DE MOSTRA",importe:1000,numeroConvocatoria:"933923"}]});
      }
      return Response.json({totalElements:1,content:[{numeroConvocatoria:"933923",descripcionLeng:"CONVOCATÒRIA MUNICIPAL DE MOSTRA",fechaRecepcion:"2026-10-07"}]});
    }
    return Response.json({codigoBDNS:"933923",presupuestoTotal:19000,tipoConvocatoria:"Concurrencia competitiva"});
  }
  if (["seu-e.cat", "www.santsadurni.cat", "santsadurni.cat", "bop.diba.cat"].includes(url.hostname)) {
    // Official documents are optional sections; exercise their unavailable state.
    return new Response("Fixture document unavailable", {status:503});
  }
  return realFetch(input, options);
};
