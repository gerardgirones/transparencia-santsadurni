import Link from "next/link";

export default function CivicTools() {
  return <nav aria-label="Eines de seguiment municipal" className="my-6 grid gap-3 sm:grid-cols-2">
    <Link href="/plens" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100"><span className="font-semibold text-indigo-950">Resums dels plens →</span><p className="mt-1 text-sm text-indigo-900">Punts tractats, votacions i extractes amb la seva pàgina de l’acta.</p></Link>
    <Link href="/revisio" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100"><span className="font-semibold text-slate-950">Revisió ciutadana →</span><p className="mt-1 text-sm text-slate-700">Dades incompletes i patrons de contractes o subvencions per comprovar.</p></Link>
  </nav>;
}
