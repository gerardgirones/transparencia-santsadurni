export interface TextPage { num: number; text: string }
export interface PlenaryPoint {
  number: number;
  title: string;
  page: number;
  outcome: string | null;
  votes: string | null;
  excerpt: string | null;
  excerptPage: number | null;
}
export interface PlenarySummary {
  pages: number;
  points: PlenaryPoint[];
  method: "extractes";
}

function clean(line: string): string {
  // Attendance lists and personal identity numbers are not part of the digest.
  return line.split(/Codi Validació:/i)[0].trim()
    .replace(/\b(?:\d{8}[-\s]?[A-Z]|[XYZ][-\s]?\d{7}[-\s]?[A-Z])\b/gi, "[identificador personal omès]");
}

function isFurniture(line: string): boolean {
  return /^(Ajuntament de Sant Sadurní|Plaça Ajuntament|Verificació:|Document signat|ACTA DEL PLE|Número:|Data: \d|https?:\/\/|INTERVENCIONS:|HASH del video)/i.test(line);
}

/** Extractive digest: no inferred vote, decision, expenditure or interpretation.
 * Recognises numbered agenda headings and cites each selected source passage.
 */
export function extractPlenarySummary(pages: TextPage[]): PlenarySummary {
  const lines = pages.flatMap(page => page.text.split(/\r?\n/).map(text => ({ page: page.num, text: clean(text) })))
    .filter(line => line.text && !isFurniture(line.text));
  const headings: { index: number; number: number; title: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\d{1,2})\s*\.\s*[-–]\s*(.+)$/.exec(lines[i].text);
    if (!match) continue;
    const number = Number(match[1]);
    // A repeated numbering in legal citations or annexes is not a new agenda item.
    if (headings.length && number <= headings[headings.length - 1].number) continue;
    if (!headings.length && number !== 1) continue;
    headings.push({ index: i, number, title: match[2] });
  }
  const points = headings.map((heading, index): PlenaryPoint => {
    const body = lines.slice(heading.index + 1, headings[index + 1]?.index ?? lines.length);
    const titleParts = [heading.title];
    for (const line of body.slice(0, 6)) {
      if (/^(Favorable|Desfavorable|Retirat|Rebutjat|Tipus de votació|Votaci|A favor|En contra|Abstencions|Fets|Resoluci|Vista |At[eè]s|La |El |Es |S['’]|D['’]acord|PRIMER|SEGON|[A-Z]\))/i.test(line.text)) break;
      titleParts.push(line.text);
      if (titleParts.join(" ").length > 400) break;
    }
    const title = titleParts.join(" ");
    const opening = body.slice(0, 10);
    const outcome = opening.find(line => /^(Favorable|Desfavorable|Retirat|Rebutjat|Sobre la taula)\b/i.test(line.text))?.text ?? null;
    const votes = opening.find(line => /^A favor:\s*\d+/i.test(line.text))?.text ?? null;
    const resolution = body.findIndex(line => /^Resoluci[oó]:?$/i.test(line.text));
    let excerpt: string | null = null;
    let excerptPage: number | null = null;
    if (resolution >= 0) {
      const passage = body.slice(resolution + 1).filter(line => !/^[A-Z]\)\s/.test(line.text));
      const selected: string[] = [];
      for (const line of passage) {
        if (/^(SEGON|TERCER|QUART|CINQU[ÈE]|SIS[ÈE]|ANNEX|Fets i|Tipus de votaci)|^\d+[.)]$/i.test(line.text)) break;
        if (excerptPage === null) excerptPage = line.page;
        selected.push(line.text);
        if (selected.join(" ").length >= 500) break;
      }
      const text = selected.join(" ");
      if (text) excerpt = text.length > 650 ? `${text.slice(0, 650).replace(/\s+\S*$/, "")}…` : text;
    }
    return {number:heading.number,title,page:lines[heading.index].page,outcome,votes,excerpt,excerptPage};
  });
  return {pages:pages.length,points,method:"extractes"};
}
