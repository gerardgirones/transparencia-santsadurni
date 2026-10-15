"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Inici", icon: "M3 11.5 12 4l9 7.5V20H3Z M9 20v-6h6v6" },
  { href: "/contractes", label: "Contractes", icon: "M7 3h7l5 5v13H7Z M14 3v5h5 M10 12h6 M10 16h6" },
  { href: "/subvencions", label: "Subvencions", icon: "M4 8h16v13H4Z M2 5h20v3H2Z M12 5v16 M12 5C4 5 7-2 12 5Zm0 0c8 0 5-7 0 0Z" },
  { href: "/transparencia", label: "Transparència", icon: "M3 21h18 M5 21V10 M19 21V10 M9 21v-6h6v6 M2 10l10-6 10 6Z" },
  { href: "/plens", label: "Plens", icon: "M4 4h16v12H4Z M8 20h8 M12 16v4 M8 8h8 M8 12h5" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegació principal mòbil" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur xl:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-5">
        {TABS.map(tab => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(`${tab.href}/`));
          return <li key={tab.href}>
            <Link href={tab.href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium ${active ? "text-indigo-600" : "text-gray-600"}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
              {tab.label}
            </Link>
          </li>;
        })}
      </ul>
    </nav>
  );
}
