import { fetchReviewCase } from "@/lib/review-case";
import { reviewCaseText } from "@/lib/review-case-text";

export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const data = await fetchReviewCase(id);
  if (!data || data.status !== "found") return new Response("La fitxa no està disponible a la revisió actual.",{status:data?.status === "unavailable" ? 503 : 404,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
  return new Response(reviewCaseText(data),{headers:{"Content-Type":"text/plain; charset=utf-8","Content-Disposition":'attachment; filename="fitxa-revisio.txt"',"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
