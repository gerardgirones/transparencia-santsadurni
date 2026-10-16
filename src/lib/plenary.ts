import { unstable_cache } from "next/cache";
import { fetchPlenaryCatalog } from "@/lib/transparency";
import { extractPlenarySummary } from "@/lib/plenary-summary";
import { REVALIDATE_SECONDS } from "@/config/constants";
import { supportedPlenaryPdf } from "@/lib/plenary-source";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

const readSummary = unstable_cache(async (url: string) => {
  if (!supportedPlenaryPdf(url)) throw new Error("Unsupported official plenary document");
  const response = await fetch(url, {redirect:"error",signal:AbortSignal.timeout(20000),next:{revalidate:REVALIDATE_SECONDS}});
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_PDF_BYTES || !response.body) throw new Error("Plenary document unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_PDF_BYTES) throw new Error("Plenary document too large");
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  const data = Buffer.concat(chunks);
  if (!data.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Invalid plenary PDF");
  const { getData } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  PDFParse.setWorker(getData());
  const parser = new PDFParse({data:new Uint8Array(data)});
  try {
    const info = await parser.getInfo();
    if (info.total > 250) throw new Error("Plenary document exceeds supported length");
    const result = await parser.getText();
    return extractPlenarySummary(result.pages);
  } finally { await parser.destroy(); }
}, ["plenary-extractive-summary-v1"], {revalidate:REVALIDATE_SECONDS});

export async function fetchPlenarySummary(id: string) {
  const catalog = await fetchPlenaryCatalog();
  const minute = catalog.find(row => row.codiActa === id);
  if (!minute) return null;
  if (!supportedPlenaryPdf(minute.enllacActa)) return {minute,summary:null,unavailable:true};
  try { return {minute,summary:await readSummary(minute.enllacActa),unavailable:false}; }
  catch (error) {
    console.error("Unable to summarise plenary document", id, error);
    return {minute,summary:null,unavailable:true};
  }
}
