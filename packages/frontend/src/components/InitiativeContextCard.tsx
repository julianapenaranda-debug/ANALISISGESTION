interface InitiativeContextCardProps {
  tribu: string;
  squad: string;
  tipoIniciativa: string;
  anioEjecucion: string;
  avanceEsperado: number | null;
  avanceReal: number | null;
}

/**
 * Returns the progress bar color for Avance Real based on the difference
 * with Avance Esperado.
 * - Red (#DC2626) when avanceReal is more than 10pp behind avanceEsperado
 * - Green (#009056) when within 10pp
 */
export function getProgressBarColor(
  avanceEsperado: number,
  avanceReal: number,
): string {
  return avanceEsperado - avanceReal > 10 ? '#DC2626' : '#009056';
}

export default function InitiativeContextCard({
  tribu,
  squad,
  tipoIniciativa,
  anioEjecucion,
  avanceEsperado,
  avanceReal,
}: InitiativeContextCardProps) {
  const allEmpty =
    !tribu &&
    !squad &&
    !tipoIniciativa &&
    !anioEjecucion &&
    avanceEsperado === null &&
    avanceReal === null;

  if (allEmpty) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-400">
        Contexto de iniciativa no disponible
      </div>
    );
  }

  const badges: { label: string; value: string }[] = [
    { label: 'Tribu', value: tribu || '—' },
    { label: 'Squad', value: squad || '—' },
    { label: 'Tipo de Iniciativa', value: tipoIniciativa || '—' },
    { label: 'Año', value: anioEjecucion || '—' },
  ];

  const bothAvailable = avanceEsperado !== null && avanceReal !== null;
  const realColor = bothAvailable
    ? getProgressBarColor(avanceEsperado!, avanceReal!)
    : '#009056';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <span
            key={b.label}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700"
          >
            <span className="font-medium text-gray-500">{b.label}:</span>
            {b.value}
          </span>
        ))}
      </div>

      {/* Dual progress bar section */}
      <div className="space-y-2">
        {/* Avance Esperado */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 font-medium">Avance Esperado</span>
            <span className="text-gray-700 font-semibold">
              {avanceEsperado !== null ? `${avanceEsperado}%` : 'Sin datos'}
            </span>
          </div>
          {avanceEsperado !== null ? (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(Math.max(avanceEsperado, 0), 100)}%`,
                  backgroundColor: '#009056',
                }}
              />
            </div>
          ) : (
            <div className="w-full h-2 bg-gray-100 rounded-full" />
          )}
        </div>

        {/* Avance Real */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 font-medium">Avance Real</span>
            <span className="text-gray-700 font-semibold">
              {avanceReal !== null ? `${avanceReal}%` : 'Sin datos'}
            </span>
          </div>
          {avanceReal !== null ? (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(Math.max(avanceReal, 0), 100)}%`,
                  backgroundColor: realColor,
                }}
              />
            </div>
          ) : (
            <div className="w-full h-2 bg-gray-100 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}
