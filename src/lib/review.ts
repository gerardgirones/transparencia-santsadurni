import { cache } from "react";
import { fetchCouncilContractCatalog } from "@/lib/api";
import { fetchSubsidyGrants } from "@/lib/bdns";
import { loadData } from "@/lib/data-result";
import { reviewContracts, reviewGrants, reviewDate, REVIEW_VERSION } from "@/lib/review-rules";

export const fetchReviewReport = cache(async () => {
  const [contracts,grants] = await Promise.all([
    loadData("catàleg complet de contractes de l’Ajuntament",fetchCouncilContractCatalog),
    loadData("catàleg complet de concessions BDNS",fetchSubsidyGrants),
  ]);
  const checkedAt = new Date().toISOString();
  const today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin"}).format(new Date(checkedAt));
  return {
    checkedAt, version:REVIEW_VERSION,
    contracts: {total:contracts.data?.length ?? null,unavailable:contracts.unavailable,
      latest:contracts.data?.map(row => reviewDate(row.data_adjudicacio_contracte)).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null},
    grants: {total:grants.data?.length ?? null,unavailable:grants.unavailable,
      latest:grants.data?.map(row => row.date).sort().at(-1) ?? null},
    findings:[...reviewContracts(contracts.data ?? [],today),...reviewGrants(grants.data ?? [],today)]
      .sort((a,b) => (b.evidence[0].date ?? "").localeCompare(a.evidence[0].date ?? "") || a.id.localeCompare(b.id)),
  };
});
