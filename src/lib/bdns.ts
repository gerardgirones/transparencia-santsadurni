import {
  BDNS_API_URL,
  BDNS_MUNICIPAL_ORGAN_ID,
  BDNS_PORTAL_URL,
  REVALIDATE_SECONDS,
} from "@/config/constants";

interface CallRecord {
  numeroConvocatoria: string;
  descripcion?: string;
  descripcionLeng?: string | null;
  fechaRecepcion?: string;
}

export interface SubsidyCall {
  code: string;
  title: string;
  registeredAt: string;
  budget: number | null;
  procedure: string | null;
  url: string;
  detailUnavailable: boolean;
}

export interface SubsidyCallFilters {
  year?: string;
  search?: string;
  page?: number;
}

export interface SubsidyGrant {
  id: string;
  date: string;
  title: string;
  beneficiary: string;
  amount: number;
  basesUrl: string;
  callUrl: string | null;
}

interface GrantRecord {
  id: number | string;
  fechaConcesion: string;
  convocatoria?: string;
  descripcionCooficial?: string | null;
  beneficiario?: string;
  importe: number;
  urlBR?: string | null;
  numeroConvocatoria?: string;
}

// Use one authoritative concessions catalogue, not a union with its AOC copy.
export async function fetchSubsidyGrants(): Promise<SubsidyGrant[]> {
  const grants = new Map<string, SubsidyGrant>();
  const pageSize = 100;
  let page = 0;
  let total = Infinity;
  while (page * pageSize < total) {
    const url = new URL(`${BDNS_API_URL}/concesiones/busqueda`);
    url.searchParams.set("vpd", "GE");
    url.searchParams.set("tipoAdministracion", "L");
    url.searchParams.set("organos", BDNS_MUNICIPAL_ORGAN_ID);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("order", "codConcesion");
    url.searchParams.set("direccion", "asc");
    const result = await bdnsFetch(url) as { content?: GrantRecord[]; totalElements?: number } | null;
    if (!result || !Array.isArray(result.content) || typeof result.totalElements !== "number" || !Number.isSafeInteger(result.totalElements) || result.totalElements < 0) {
      throw new Error("BDNS returned an invalid grant listing");
    }
    total = result.totalElements;
    if (result.content.length === 0 && grants.size < total) throw new Error("BDNS returned an incomplete grant catalogue");
    for (const record of result.content) {
      const id = String(record?.id ?? "");
      if (!/^\d+$/.test(id) || typeof record.importe !== "number" || !Number.isFinite(record.importe) || !/^\d{4}-\d{2}-\d{2}$/.test(record.fechaConcesion || "")) {
        throw new Error("BDNS returned an invalid grant");
      }
      const callCode = String(record.numeroConvocatoria ?? "");
      grants.set(id, {
        id,
        date: record.fechaConcesion,
        title: record.descripcionCooficial?.trim() || record.convocatoria || "",
        beneficiary: record.beneficiario || "",
        amount: record.importe,
        basesUrl: record.urlBR || "",
        callUrl: /^\d+$/.test(callCode) ? `${BDNS_PORTAL_URL}/convocatoria/${callCode}` : null,
      });
    }
    // A shortened page before the declared end must not look like a full catalogue.
    page += 1;
    if (result.content.length < pageSize && grants.size < total) {
      throw new Error("BDNS returned an incomplete grant catalogue");
    }
  }
  if (grants.size !== total) throw new Error("BDNS returned an incomplete grant catalogue");
  return [...grants.values()];
}

export function resolveSubsidyCallFilters(filters: SubsidyCallFilters = {}) {
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(filters.year);
  return {
    year: /^\d{4}$/.test(filters.year || "") && parsedYear >= 2016 && parsedYear <= currentYear
      ? parsedYear : currentYear,
    search: (filters.search || "").trim().slice(0, 200),
    page: Number.isSafeInteger(filters.page) && filters.page! > 0 && filters.page! <= 10000 ? filters.page! : 1,
  };
}

async function bdnsFetch(url: URL, signal = AbortSignal.timeout(15000)): Promise<unknown> {
  const response = await fetch(url.toString(), {
    next: { revalidate: REVALIDATE_SECONDS },
    signal,
  });
  if (!response.ok) throw new Error(`BDNS API error (${response.status})`);
  return response.json();
}

async function fetchCallDetail(code: string, signal: AbortSignal) {
  const url = new URL(`${BDNS_API_URL}/convocatorias`);
  url.searchParams.set("vpd", "GE");
  url.searchParams.set("numConv", code);
  const result = await bdnsFetch(url, signal) as {
    codigoBDNS?: string;
    presupuestoTotal?: number | null;
    tipoConvocatoria?: string;
  } | null;
  if (!result || String(result.codigoBDNS) !== code) throw new Error("BDNS returned an invalid call detail");
  return {
    budget: typeof result.presupuestoTotal === "number" && Number.isFinite(result.presupuestoTotal) && result.presupuestoTotal >= 0
      ? result.presupuestoTotal : null,
    procedure: typeof result.tipoConvocatoria === "string" ? result.tipoConvocatoria : null,
  };
}

export async function fetchSubsidyCalls(filters: SubsidyCallFilters = {}) {
  const { year, search, page } = resolveSubsidyCallFilters(filters);
  const pageSize = 20;
  const url = new URL(`${BDNS_API_URL}/convocatorias/busqueda`);
  url.searchParams.set("vpd", "GE");
  url.searchParams.set("tipoAdministracion", "L");
  url.searchParams.set("organos", BDNS_MUNICIPAL_ORGAN_ID);
  url.searchParams.set("fechaDesde", `01/01/${year}`);
  url.searchParams.set("fechaHasta", `31/12/${year}`);
  url.searchParams.set("page", String(page - 1));
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("order", "fechaRecepcion");
  url.searchParams.set("direccion", "desc");
  if (search) {
    url.searchParams.set("descripcion", search);
    url.searchParams.set("descripcionTipoBusqueda", "0");
  }

  const result = await bdnsFetch(url) as { content?: CallRecord[]; totalElements?: number } | null;
  if (!result || !Array.isArray(result.content) || !Number.isSafeInteger(result.totalElements) || result.totalElements! < 0) {
    throw new Error("BDNS returned an invalid call listing");
  }
  const data: SubsidyCall[] = result.content.map((record) => {
    if (!record || !/^\d+$/.test(String(record.numeroConvocatoria))) throw new Error("BDNS returned an invalid call code");
    const code = String(record.numeroConvocatoria);
    return {
      code,
      title: record.descripcionLeng?.trim() || record.descripcion || `Convocatòria ${code}`,
      registeredAt: record.fechaRecepcion || "",
      budget: null,
      procedure: null,
      url: `${BDNS_PORTAL_URL}/convocatoria/${code}`,
      detailUnavailable: true,
    };
  });

  // Bound requests to four at a time and give the entire detail stage 12 seconds.
  // A missing detail must not hide a published call or become a zero budget.
  const detailSignal = AbortSignal.timeout(12000);
  for (let offset = 0; offset < data.length && !detailSignal.aborted; offset += 4) {
    await Promise.all(data.slice(offset, offset + 4).map(async (call) => {
      try {
        Object.assign(call, await fetchCallDetail(call.code, detailSignal), { detailUnavailable: false });
      } catch {
        // The official link and listing remain usable if its detail is unavailable.
      }
    }));
  }

  return { data, total: result.totalElements!, year, search, page, pageSize };
}
