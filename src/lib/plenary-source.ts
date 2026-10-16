import { SANT_SADURNI_CODI_ENS } from "@/config/constants";

export function supportedPlenaryPdf(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "media.seu-e.cat" && !url.port && !url.username && !url.password &&
      url.pathname.startsWith(`/acteca/${SANT_SADURNI_CODI_ENS}/`);
  } catch { return false; }
}
