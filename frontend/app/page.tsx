"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

type UITournament = {
  tourney_id: string;
  name: string | null;
  surface?: string | null;
  draw_size?: number | null;
  date?: string | null;
  end_date?: string | null;
  year?: number | null;
  month?: number | null;
  is_live?: boolean;
  is_upcoming?: boolean;
  category?: string | null;
  prize_money_local?: number | null;
  prize_money_currency?: string | null;
  category_rank?: number | null;
  category_total?: number | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

function formatPrizeMoney(tournament: UITournament): string | null {
  if (!tournament.category || tournament.prize_money_local == null) return null;
  const amount = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(
    tournament.prize_money_local,
  );
  const currency = tournament.prize_money_currency ?? "";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const rankLabel =
    tournament.category_rank != null && tournament.category_total != null
      ? ` · rank ${tournament.category_rank} de ${tournament.category_total}`
      : "";
  return `${tournament.category} · ${amount} ${symbol}${rankLabel}`;
}

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatDateRange(date?: string | null, endDate?: string | null): string | null {
  if (!date) return null;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };
  if (endDate && endDate !== date) {
    return `${fmt(date)} - ${fmt(endDate)}`;
  }
  return fmt(date);
}

function TournamentChip({
  tournament,
  variant,
  onClick,
}: {
  tournament: UITournament;
  variant: "live" | "upcoming";
  onClick: () => void;
}) {
  const dateLabel = formatDateRange(tournament.date, tournament.end_date);
  const prizeLabel = formatPrizeMoney(tournament);
  const baseClasses =
    variant === "live"
      ? "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500/70 hover:bg-emerald-500/20"
      : "border-sky-500/40 bg-sky-500/10 hover:border-sky-500/70 hover:bg-sky-500/20";

  return (
    <button
      type="button"
      onClick={onClick}
      title={tournament.tourney_id}
      className={`flex min-w-[200px] flex-col gap-1 rounded-lg border px-4 py-3 text-left text-sm text-slate-50 ${baseClasses}`}
    >
      <span className="truncate font-medium">{tournament.name || tournament.tourney_id}</span>
      <span className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        {dateLabel ? <span>{dateLabel}</span> : null}
        {tournament.surface ? <span>· {tournament.surface}</span> : null}
        {tournament.draw_size ? <span>· {tournament.draw_size}</span> : null}
      </span>
      {prizeLabel && <span className="text-[11px] text-amber-300/90">{prizeLabel}</span>}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [tidInput, setTidInput] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [tournaments, setTournaments] = useState<UITournament[]>([]);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [expandedMonths, setExpandedMonths] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    const loadList = async () => {
      setListLoading(true);
      try {
        const res = await fetch("/api/tournaments?limit=500");
        if (res.ok) {
          const j = await res.json();
          setTournaments(Array.isArray(j.items) ? j.items : []);
        } else {
          setTournaments([]);
        }
      } catch {
        setTournaments([]);
      } finally {
        setListLoading(false);
      }
    };
    loadList();
  }, []);

  const goToTournament = (tourneyId: string) => {
    router.push(`/tournament/${encodeURIComponent(tourneyId)}`);
  };

  const liveTournaments = useMemo(() => {
    const toTs = (value?: string | null) =>
      value && typeof value === "string" && value.trim() ? new Date(value).getTime() : 0;
    return tournaments
      .filter((t) => t.is_live)
      .sort((a, b) => toTs(a.date) - toTs(b.date));
  }, [tournaments]);

  const upcomingTournaments = useMemo(() => {
    const toTs = (value?: string | null) =>
      value && typeof value === "string" && value.trim() ? new Date(value).getTime() : 0;
    return tournaments
      .filter((t) => t.is_upcoming)
      .sort((a, b) => toTs(a.date) - toTs(b.date));
  }, [tournaments]);

  const groupedTournaments = useMemo(() => {
    const toTs = (value?: string | null) =>
      value && typeof value === "string" && value.trim() ? new Date(value).getTime() : 0;

    const sorted = [...tournaments.filter((t) => !t.is_live && !t.is_upcoming)].sort((a, b) => {
      const db = toTs(b.date);
      const da = toTs(a.date);
      if (db !== da) return db - da;
      const yb = b.year ?? 0;
      const ya = a.year ?? 0;
      if (yb !== ya) return yb - ya;
      const mb = b.month ?? 0;
      const ma = a.month ?? 0;
      if (mb !== ma) return mb - ma;
      return a.tourney_id < b.tourney_id ? 1 : a.tourney_id > b.tourney_id ? -1 : 0;
    });

    const bucket = new Map<
      string,
      Map<
        string,
        {
          monthKey: string;
          monthLabel: string;
          items: UITournament[];
        }
      >
    >();

    for (const item of sorted) {
      const yearKey = item.year ? String(item.year) : "sin-fecha";
      const monthKey = item.month ? String(item.month) : "0";
      if (!bucket.has(yearKey)) {
        bucket.set(yearKey, new Map());
      }
      const monthsMap = bucket.get(yearKey)!;
      if (!monthsMap.has(monthKey)) {
        const label =
          Number.isFinite(Number(monthKey)) && Number(monthKey) >= 1 && Number(monthKey) <= 12
            ? monthNames[Number(monthKey) - 1]
            : "Sin mes";
        monthsMap.set(monthKey, { monthKey, monthLabel: label, items: [] });
      }
      monthsMap.get(monthKey)!.items.push(item);
    }

    return Array.from(bucket.entries())
      .sort(([a], [b]) => {
        const ya = Number(a);
        const yb = Number(b);
        const aValid = Number.isFinite(ya);
        const bValid = Number.isFinite(yb);
        if (aValid && bValid) return yb - ya;
        if (aValid) return -1;
        if (bValid) return 1;
        return 0;
      })
      .map(([yearKey, monthsMap]) => ({
        yearKey,
        months: Array.from(monthsMap.values()).sort(
          (a, b) => Number(b.monthKey) - Number(a.monthKey),
        ),
      }));
  }, [tournaments]);

  useEffect(() => {
    if (!groupedTournaments.length) {
      setExpandedYears({});
      setExpandedMonths({});
      return;
    }
    const latestYear = groupedTournaments[0]?.yearKey;
    const latestMonth = groupedTournaments[0]?.months?.[0]?.monthKey;

    setExpandedYears((prev) => {
      if (Object.keys(prev).length) return prev;
      return latestYear ? { [latestYear]: true } : {};
    });

    setExpandedMonths((prev) => {
      if (latestYear && latestMonth && !prev[latestYear]) {
        return { ...prev, [latestYear]: { [latestMonth]: true } };
      }
      return prev;
    });
  }, [groupedTournaments]);

  const toggleYear = (yearKey: string) => {
    setExpandedYears((prev) => ({ ...prev, [yearKey]: !prev[yearKey] }));
  };

  const toggleMonth = (yearKey: string, monthKey: string) => {
    setExpandedMonths((prev) => {
      const yearState = prev[yearKey] ?? {};
      return {
        ...prev,
        [yearKey]: { ...yearState, [monthKey]: !yearState[monthKey] },
      };
    });
  };

  return (
    <div className="min-h-screen p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-100">Estratego</h1>

      {(liveTournaments.length > 0 || upcomingTournaments.length > 0) && (
        <div className="mb-6 space-y-4">
          {liveTournaments.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                En juego ahora
              </div>
              <div className="flex flex-wrap gap-2">
                {liveTournaments.map((t) => (
                  <TournamentChip
                    key={`live-${t.tourney_id}`}
                    tournament={t}
                    variant="live"
                    onClick={() => goToTournament(t.tourney_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {upcomingTournaments.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
                Próximamente
              </div>
              <div className="flex flex-wrap gap-2">
                {upcomingTournaments.map((t) => (
                  <TournamentChip
                    key={`upcoming-${t.tourney_id}`}
                    tournament={t}
                    variant="upcoming"
                    onClick={() => goToTournament(t.tourney_id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <form
        className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:flex-row md:items-center md:gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (tidInput && tidInput.trim()) {
            goToTournament(tidInput.trim());
          }
        }}
      >
        <label className="text-xs font-medium text-slate-400 md:w-40">Buscar torneo (tourney_id)</label>
        <input
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-700"
          placeholder="p.ej., 2025-429"
          value={tidInput}
          onChange={(e) => setTidInput(e.target.value)}
        />
        <Button type="submit" className="md:ml-2">Cargar</Button>
      </form>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico</div>
        {listLoading ? (
          <div className="text-xs text-slate-500">Cargando lista...</div>
        ) : groupedTournaments.length === 0 ? (
          <div className="text-xs text-slate-500">Sin datos</div>
        ) : (
          <div className="space-y-3">
            {groupedTournaments.map(({ yearKey, months }) => (
              <div key={yearKey} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => toggleYear(yearKey)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-900/50"
                >
                  <span className="text-sm font-semibold text-slate-100">
                    {yearKey === "sin-fecha" ? "Sin fecha" : yearKey}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      expandedYears[yearKey] ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {expandedYears[yearKey] && (
                  <div className="space-y-2 border-t border-slate-800 p-3">
                    {months.map(({ monthKey, monthLabel, items }) => (
                      <div
                        key={`${yearKey}-${monthKey}`}
                        className="rounded-md border border-slate-800 bg-slate-950/80"
                      >
                        <button
                          type="button"
                          onClick={() => toggleMonth(yearKey, monthKey)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-900"
                        >
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${
                                expandedMonths[yearKey]?.[monthKey] ? "rotate-90" : ""
                              }`}
                            />
                            {monthLabel}
                          </div>
                          <span className="ml-2 shrink-0 text-[11px] text-slate-500">{items.length} torneos</span>
                        </button>
                        {expandedMonths[yearKey]?.[monthKey] && (
                          <div className="space-y-2 border-t border-slate-800 p-2">
                            {items.map((t) => (
                              <button
                                key={t.tourney_id}
                                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                                onClick={() => goToTournament(t.tourney_id)}
                                type="button"
                                title={t.tourney_id}
                              >
                                <div className="min-w-0 flex flex-col">
                                  <span className="truncate">{t.name || t.tourney_id}</span>
                                  {t.surface && (
                                    <span className="text-[11px] text-slate-500">
                                      {t.surface} · {t.draw_size ?? "?"}
                                    </span>
                                  )}
                                </div>
                                <span className="ml-2 text-xs text-slate-500">{t.tourney_id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
