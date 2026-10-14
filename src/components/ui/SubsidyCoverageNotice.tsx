import { OFFICIAL_SOURCES } from "@/config/constants";
import { formatDate } from "@/lib/utils";

interface Props {
  coverage: { latestGrantDate: string | null; currentYear: number; totalRecords: number };
}

export default function SubsidyCoverageNotice({ coverage }: Props) {
  const latestYear = coverage.latestGrantDate ? Number(coverage.latestGrantDate.slice(0, 4)) : null;
  const missingCurrentYear = latestYear === null || latestYear < coverage.currentYear;
  return (
    <div className={`mb-6 rounded-lg border p-4 text-sm ${missingCurrentYear ? "border-amber-200 bg-amber-50 text-amber-900" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
      <p>
        Font: dades obertes de l’AOC · {coverage.totalRecords} concessions publicades.
        {coverage.latestGrantDate ? ` Darrera concessió disponible: ${formatDate(coverage.latestGrantDate)}.` : " No hi ha concessions disponibles a la font."}
      </p>
      {missingCurrentYear && (
        <p className="mt-2">
          La font consultada encara no inclou concessions de {coverage.currentYear}. Això no permet afirmar
          que l’Ajuntament no hagi atorgat subvencions aquest any. Les convocatòries i els ajuts previstos
          es publiquen separadament de les concessions.
        </p>
      )}
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <a href={OFFICIAL_SOURCES.subsidiesGranted} target="_blank" rel="noopener noreferrer" className="underline">Concessions al portal oficial</a>
        <a href={OFFICIAL_SOURCES.subsidiesCalls} target="_blank" rel="noopener noreferrer" className="underline">Convocatòries de subvencions</a>
        <a href="https://www.infosubvenciones.es/bdnstrans/GE/es/concesiones" target="_blank" rel="noopener noreferrer" className="underline">Consultar la BDNS</a>
      </p>
    </div>
  );
}
