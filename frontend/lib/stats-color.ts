// Color del boton de "ver estadisticas" segun la delta de aces del jugador
// (torneo anterior vs misma superficie): verde si esta por encima de su
// media, rojo si esta por debajo, gris si no hay dato todavia.
export function acesDeltaColorClass(delta: number | null | undefined): string {
  if (delta == null) return "text-slate-500 hover:text-slate-200";
  if (delta > 0) return "text-emerald-400 hover:text-emerald-300";
  if (delta < 0) return "text-red-400 hover:text-red-300";
  return "text-slate-500 hover:text-slate-200";
}
