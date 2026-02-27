export const SOCRATA_BASE_URL =
  "https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json";

export const SOCRATA_DATASET_URL =
  "https://analisi.transparenciacatalunya.cat/Sector-P-blic/Contractaci-del-sector-p-blic-de-la-Generalitat-d/ybgg-dgi6";

export const CLEAN_AMOUNT_FILTER =
  "import_adjudicacio_amb_iva not like '%||%'";

export const CLEAN_AMOUNT_SENSE_FILTER =
  "import_adjudicacio_sense not like '%||%'";

// Data source updates are typically daily; a 6h cache reduces load while staying fresh.
export const REVALIDATE_SECONDS = 21600; // 6 hours cache
export const API_ROUTE_S_MAXAGE_SECONDS = 21600; // 6 hours CDN cache
export const API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS = 86400; // 24 hours

export const DEFAULT_PAGE_SIZE = 50;

export const MINOR_CONTRACT_THRESHOLD = 15000;

export const CONTRACT_TYPES = [
  "Serveis",
  "Subministraments",
  "Obres",
  "Concessió de serveis",
  "Administratiu especial",
  "Altra legislació sectorial",
  "Privat d'Administració Pública",
  "Contracte de serveis especials (annex IV)",
  "Concessió d'obres",
  "Concessió de serveis especials (annex IV)",
] as const;

export const PROCEDURE_TYPES = [
  "Contracte menor",
  "Obert",
  "Obert simplificat abreujat",
  "Obert Simplificat",
  "Obert simplificat",
  "Negociat sense publicitat",
  "Restringit",
  "Tramitació amb mesures de gestió eficient",
  "Altres procediments segons instruccions internes",
  "Concurs de projectes",
  "Licitació amb negociació",
  "Adjudicacions directes no menors",
  "Negociat amb publicitat",
  "Diàleg competitiu",
  "Associació per a la innovació",
] as const;

// CPV (Common Procurement Vocabulary) 2-digit division names in Catalan
export const CPV_DIVISIONS: Record<string, string> = {
  "03": "Productes agrícoles i ramaders",
  "09": "Productes petrolífers i energia",
  "14": "Productes de mineria",
  "15": "Aliments i begudes",
  "16": "Maquinària agrícola",
  "18": "Roba i calçat",
  "19": "Cuir i tèxtils",
  "22": "Impresos i productes relacionats",
  "24": "Productes químics",
  "30": "Maquinària d'oficina i informàtica",
  "31": "Maquinària elèctrica",
  "32": "Equips de telecomunicacions",
  "33": "Equipament mèdic i farmacèutic",
  "34": "Equips de transport",
  "35": "Equips de seguretat i defensa",
  "37": "Instruments musicals i esportius",
  "38": "Equips de laboratori i precisió",
  "39": "Mobiliari i equipament",
  "42": "Maquinària industrial",
  "43": "Maquinària de mineria",
  "44": "Materials de construcció",
  "45": "Obres de construcció",
  "48": "Paquets de programari",
  "50": "Serveis de reparació i manteniment",
  "51": "Serveis d'instal·lació",
  "55": "Serveis d'hostaleria i restauració",
  "60": "Serveis de transport",
  "63": "Serveis auxiliars de transport",
  "64": "Serveis postals i telecomunicacions",
  "65": "Serveis públics (aigua, energia)",
  "66": "Serveis financers i d'assegurances",
  "70": "Serveis immobiliaris",
  "71": "Serveis d'arquitectura i enginyeria",
  "72": "Serveis informàtics (TI)",
  "73": "Serveis d'investigació (R+D)",
  "75": "Serveis d'administració pública",
  "76": "Serveis del sector petroler",
  "77": "Serveis agrícoles i forestals",
  "79": "Serveis empresarials i de consultoria",
  "80": "Serveis d'ensenyament i formació",
  "85": "Serveis sanitaris i socials",
  "90": "Aigües residuals, residus i neteja",
  "92": "Serveis recreatius i culturals",
  "98": "Altres serveis comunitaris",
};

export const SITE_NAME = "transparenciasantsadurni.cat";
export const SITE_DESCRIPTION =
  "Portal ciutadà de transparència de Sant Sadurní d'Anoia: contractes públics, pressupost, subvencions, convenis i retribucions públiques.";
export const SITE_URL = "https://transparenciasantsadurni.cat";
export const GITHUB_URL = "https://github.com/gerardgirones/transparencia-santsadurni";
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;
export const GITHUB_DISCUSSIONS_URL = `${GITHUB_URL}/discussions`;
export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/gerardgirones";
export const CREATOR_NAME = "Ciència de Dades";
export const CREATOR_URL = "https://cienciadedades.cat";

export const MUNICIPAL_SCOPE_ORGAN = "Ajuntament de Sant Sadurní d'Anoia";
export const MUNICIPAL_SCOPE_EXECUTION = "Sant Sadurní d'Anoia";

export const SANT_SADURNI_CODI_ENS = "824010007";
export const AOC_CKAN_BASE_URL = "https://dadesobertes.seu-e.cat/api/3/action/datastore_search";

export const AOC_RESOURCE_IDS = {
  budgetByProgram: "595f8620-7a3c-4e38-8be2-7cffa744cd44",
  contracts: "7448c675-8880-464e-9980-1b92119e59c8",
  plenaryMinutes: "b5d370d0-7916-48b6-8a69-3c7fa62a1467",
  subsidiesGranted: "30798421-5952-4420-a769-d1121beb6534",
  cooperationAgreements: "8747a24f-aa98-4a7e-938a-df81cc16769a",
} as const;

export const OFFICIAL_SOURCES = {
  officialsAndSalaries:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions/alts-carrecs-personal-directiu-i-carrecs-eventuals",
  economicRights:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions/drets-economics-i-carrecs-electes-206",
  budget:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/gestio-economica/pressupost/pressupost/despeses-per-programa",
  budgetExecution:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/gestio-economica/pressupost/execucio-pressupostaria-trimestral",
  decrees:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/accio-de-govern-i-normativa/accio-de-govern-i-grups-politics/resolucions-i-decrets",
  plenaryMinutes:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/accio-de-govern-i-normativa/accio-de-govern-i-grups-politics/actes-de-ple",
  pscpProfile: "https://contractaciopublica.gencat.cat/ecofin_pscp/AppJava/perfil/4491728/customProf",
  subsidiesGranted:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/contractes-convenis-i-subvencions/convenis-i-subvencions/subvencions-atorgades",
  subsidiesCalls:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/contractes-convenis-i-subvencions/convenis-i-subvencions/convocatories-de-subvencions-i-ajuts",
  cooperationAgreements:
    "https://seu-e.cat/ca/web/santsadurnidanoia/govern-obert-i-transparencia/contractes-convenis-i-subvencions/convenis-i-subvencions/convenis-de-col-laboracio",
} as const;
