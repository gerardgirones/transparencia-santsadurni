import type { fetchReviewCase } from "@/lib/review-case";

type Case = Extract<NonNullable<Awaited<ReturnType<typeof fetchReviewCase>>>,{status:"found"}>;
export function reviewCaseText(data: Case): string {
  const {finding} = data;
  const lines = ["FITXA DE REVISIÓ CIUTADANA",finding.title,`Identificador: ${finding.id}`,`Consulta: ${data.checkedAt}`,
    `Regles: ${data.rulesVersion} · Contrast: ${data.documentVersion}`,"",finding.reason,finding.limitation,"",
    "Un avís no acredita una irregularitat. Aquest contrast compara publicacions que poden compartir origen; no és una auditoria independent ni valida l’expedient.","","REGISTRES I FONTS"];
  for (const item of finding.evidence) lines.push("",`${item.title} · Registre ${item.id}`,`${item.beneficiary} · ${item.date ?? "Data no informada"}`,
    `Import: ${item.amount === null ? "No interpretable" : item.amount.toLocaleString("ca-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}${finding.section === "contractes" ? " sense IVA" : " concedits"}`,
    item.sourceUrl,...(item.publicationUrl ? [item.publicationUrl] : []));
  lines.push("","CONTRAST DE LA PUBLICACIÓ");
  for (const document of data.documents) {
    lines.push("",`${document.expedient} · ${document.id}`,document.message,...(document.sourceUrl ? [document.sourceUrl] : []));
    for (const check of document.checks) lines.push(`${check.label}: catàleg = ${check.catalog ?? "No informat"}; publicació = ${check.publication ?? "No informat"}; resultat = ${check.status}`);
  }
  for (const call of data.calls) lines.push("",call.title ?? "Convocatòria BDNS",call.message,
    `Pressupost de la convocatòria: ${call.budget === null ? "No informat" : call.budget.toLocaleString("ca-ES")+" €"}. No és un import concedit ni pagat.`,
    `Procediment: ${call.procedure ?? "No informat"}`,...(call.sourceUrl ? [call.sourceUrl] : []),...(call.basesUrl ? [call.basesUrl] : []));
  if (data.omittedCalls) lines.push(`${data.omittedCalls} convocatòries pendents de consulta pel límit de quatre per visita.`);
  if (data.timeline.length) lines.push("","PUBLICACIONS DELS EXPEDIENTS",...data.timeline.map(item=>`${item.date?.slice(0,10) ?? "Sense data"} · ${item.expedient} · lot ${item.lot ?? "no informat"} · ${item.phase} · registre ${item.id}${item.url ? " · "+item.url : ""}`));
  lines.push("","QUÈ CAL COMPROVAR",...data.questions.map((question,index)=>`${index+1}. ${question}`),"",
    "Les fonts poden estar en memòria cau fins a sis hores i poden haver estat corregides després de la consulta. La fitxa no incorpora factures, pagaments ni justificacions internes.");
  return lines.join("\n")+"\n";
}
