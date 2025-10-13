"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  WinProbabilityOrb,
  getWinProbabilitySummary,
  normalizeProbabilityValue,
} from "@/components/prematch/win-probability-orb";

// ---------------- Types ----------------
type Extras = {
  display_p?: string;
  display_o?: string;
  country_p?: string; // ISO-2
  country_o?: string; // ISO-2
  rank_p?: number | null;
  rank_o?: number | null;
  ytd_wr_p?: number | null; // 0..1
  ytd_wr_o?: number | null; // 0..1
};

type PlayerSummary = {
  win_pct_year?: number | null;
  win_pct_surface?: number | null;
  ranking?: number | null;
  days_since_last?: number | null;
  home_advantage?: boolean | null;
  win_pct_month?: number | null;
  win_pct_vs_top10?: number | null;
  court_speed_score?: number | null;
  win_score?: number | null;
  win_probability?: number | null;
};

type H2HSummary = {
  wins: number;
  losses: number;
  total: number;
  last_meeting: string | null;
};

type TournamentSummary = {
  name?: string | null;
  surface?: string | null;
  bucket?: string | null;
  month?: number | null;
};

type PrematchResp = {
  prob_player: number | null;
  tournament?: TournamentSummary;
  extras?: Extras;
  playerA?: PlayerSummary;
  playerB?: PlayerSummary;
  h2h?: H2HSummary;
  last_surface?: string | null;
  defends_round?: string | null;
  court_speed?: number | null;
};

const percentFromRatio = (value: number, decimals = 0) => {
  const ratio = Math.abs(value) <= 1 ? value * 100 : value;
  const formatted = Number(ratio.toFixed(decimals));
  return `${formatted}%`;
};

const formatPercentage = (
  value: number | null | undefined,
  { decimals = 0 }: { decimals?: number } = {},
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return percentFromRatio(value, decimals);
};

const formatDecimal = (
  value: number | null | undefined,
  { decimals = 1 }: { decimals?: number } = {},
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return `${Number(value.toFixed(decimals))}`;
};

const formatTournamentMonth = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = value >= 1 && value <= 12 ? value - 1 : value;
  if (!Number.isFinite(normalized)) return `${value}`;

  const date = new Date(2020, normalized, 1);
  const formatter = new Intl.DateTimeFormat("es", { month: "long" });
  const monthName = formatter.format(date);
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} (${value})`;
};

const formatLastMeetingDate = (value: string | null | undefined) => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const formatter = new Intl.DateTimeFormat("es", { dateStyle: "long" });
    return formatter.format(new Date(parsed));
  }

  return trimmed;
};

const formatPlayerMetric = (summary: PlayerSummary | undefined, key: keyof PlayerSummary) => {
  if (!summary) return null;

  const rawValue = summary[key];
  if (rawValue === null || rawValue === undefined) return null;

  switch (key) {
    case "win_pct_year":
    case "win_pct_surface":
    case "win_pct_month":
      return formatPercentage(rawValue as number, { decimals: 0 });
    case "win_pct_vs_top10":
      return formatPercentage(rawValue as number, { decimals: 1 });
    case "win_probability":
      return formatPercentage(rawValue as number, { decimals: 1 });
    case "home_advantage":
      return (rawValue as boolean) ? "Sí" : "No";
    case "days_since_last": {
      if (typeof rawValue !== "number") return null;
      const rounded = Math.round(rawValue);
      const unit = rounded === 1 ? "día" : "días";
      return `${rounded} ${unit}`;
    }
    case "ranking":
      return typeof rawValue === "number" ? `#${Math.round(rawValue)}` : null;
    case "court_speed_score":
      return formatDecimal(rawValue as number, { decimals: 1 });
    case "win_score":
      return formatDecimal(rawValue as number, { decimals: 2 });
    default:
      return typeof rawValue === "number" ? `${rawValue}` : null;
  }
};

const playerMetricDescriptors: Array<{ key: keyof PlayerSummary; label: string }> = [
  { key: "win_probability", label: "Probabilidad estimada de victoria" },
  { key: "win_score", label: "Win score" },
  { key: "win_pct_year", label: "% victorias en el año" },
  { key: "win_pct_surface", label: "% victorias en la superficie" },
  { key: "win_pct_month", label: "% victorias en el mes" },
  { key: "win_pct_vs_top10", label: "% victorias vs Top 10" },
  { key: "ranking", label: "Ranking" },
  { key: "days_since_last", label: "Días desde el último partido" },
  { key: "home_advantage", label: "Ventaja de local" },
  { key: "court_speed_score", label: "Court speed score" },
];

export default function PrematchInner() {
  const sp = useSearchParams();
  const playerA = sp.get("playerA") || "Player A";
  const playerB = sp.get("playerB") || "Player B";
  const tourneyIdParam = sp.get("tourney_id") || sp.get("tid");
  const playerAIdParam = sp.get("playerA_id");
  const playerBIdParam = sp.get("playerB_id");
  const yearParam = sp.get("year");

  const [data, setData] = useState<PrematchResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const playerAId = Number.parseInt(playerAIdParam ?? "", 10);
      const playerBId = Number.parseInt(playerBIdParam ?? "", 10);
      const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();

      if (!tourneyIdParam || Number.isNaN(playerAId) || Number.isNaN(playerBId) || Number.isNaN(year)) {
        setError(
          "Faltan parámetros válidos en la URL (playerA_id, playerB_id, tourney_id o year)."
        );
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/prematch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerA_id: playerAId,
            playerB_id: playerBId,
            tourney_id: tourneyIdParam,
            year,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error ${res.status}: ${text}`);
        }

        const j: PrematchResp = await res.json();
        setData(j);
      } catch (err) {
        setError((err as Error).message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [playerAIdParam, playerBIdParam, tourneyIdParam, yearParam]);

  const probability = useMemo(
    () => normalizeProbabilityValue(data?.prob_player),
    [data?.prob_player],
  );
  const { percent, percentOpponent } = useMemo(
    () => getWinProbabilitySummary(probability),
    [probability],
  );

  const tournamentDetails = useMemo(() => {
    if (!data) return [];

    const items: Array<{ label: string; value: string }> = [];

    if (data.tournament?.name) {
      items.push({ label: "Nombre", value: data.tournament.name });
    }
    if (data.tournament?.surface) {
      items.push({ label: "Superficie", value: data.tournament.surface });
    }
    if (data.tournament?.bucket) {
      items.push({ label: "Categoría", value: data.tournament.bucket });
    }
    if (typeof data.tournament?.month === "number") {
      const label = formatTournamentMonth(data.tournament.month);
      items.push({ label: "Mes", value: label ?? `${data.tournament.month}` });
    }
    if (typeof data.court_speed === "number") {
      const formatted = formatDecimal(data.court_speed, { decimals: 1 });
      if (formatted) {
        items.push({ label: "Court speed score del torneo", value: formatted });
      }
    }
    if (data.last_surface) {
      items.push({ label: "Última superficie disputada", value: data.last_surface });
    }
    if (data.defends_round) {
      items.push({ label: "Puntos a defender", value: data.defends_round });
    }

    return items;
  }, [data]);

  const headToHeadDetails = useMemo(() => {
    if (!data?.h2h) return [];

    const toCount = (value: unknown): number =>
      typeof value === "number" && Number.isFinite(value) ? value : 0;

    const wins = toCount(data.h2h.wins);
    const losses = toCount(data.h2h.losses);
    const totalMatches =
      typeof data.h2h.total === "number" && Number.isFinite(data.h2h.total)
        ? data.h2h.total
        : wins + losses;

    const lastMeeting = formatLastMeetingDate(data.h2h.last_meeting);

    const items: Array<{ label: string; value: string }> = [
      { label: "Marcador", value: `${wins ?? 0} - ${losses ?? 0}` },
      { label: "Total de partidos", value: `${totalMatches}` },
    ];

    if (lastMeeting) {
      items.push({ label: "Último enfrentamiento", value: lastMeeting });
    }

    return items;
  }, [data?.h2h]);

  const contextDetails = useMemo(() => {
    if (!data) return [];

    const items: Array<{ label: string; value: string }> = [];

    if (data.last_surface) {
      items.push({ label: "Última superficie disputada", value: data.last_surface });
    }

    if (data.defends_round) {
      items.push({ label: "Puntos a defender", value: data.defends_round });
    }

    return items;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-950/40 p-6 text-slate-100 md:p-10">
      <h1 className="mb-8 text-3xl font-semibold">
        Prematch: {playerA} vs {playerB}
      </h1>

      {loading && <div className="mb-6 text-sm text-slate-400">Cargando…</div>}
      {error && <div className="mb-6 text-sm text-red-400">{error}</div>}

      {data && (
        <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg xl:grid xl:grid-cols-[minmax(0,360px),1fr] xl:gap-10 xl:space-y-0">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-center xl:flex-col">
            <WinProbabilityOrb
              label={playerA}
              value={probability}
              description="Si la barra se enciende en rojos intensos, el modelo ve a este jugador casi imparable."
            />
            <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-slate-700/60 to-transparent lg:block xl:hidden" />
            <WinProbabilityOrb
              label={playerB}
              value={probability !== null ? 1 - probability : null}
              description="Cuando domina el hielo, la lectura es que este jugador llega con el partido cuesta arriba."
            />
          </div>

          <div className="space-y-5">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-100">Resumen</h2>
              <p className="text-sm text-slate-300">
                Nuestro modelo otorga a <strong>{playerA}</strong> una probabilidad de victoria del
                {" "}
                <strong>{percent !== null ? `${percent}%` : "—"}</strong>, dejando para <strong>{playerB}</strong>
                {" "}
                el restante <strong>{percentOpponent !== null ? `${percentOpponent}%` : "—"}</strong>.
              </p>
              <p className="text-xs text-slate-400">
                Las esferas combinan brillo y textura para representar el clima del partido: cuando un lado
                se cubre de rojos y destellos, el favorito está &ldquo;en llamas&rdquo;; si domina el azul glaciar, el
                panorama luce mucho más helado.
              </p>
            </section>

            {(data.playerA || data.playerB) && (
              <section className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Indicadores por jugador
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { label: playerA, summary: data.playerA },
                    { label: playerB, summary: data.playerB },
                  ].map(({ label, summary }, index) => {
                    if (!summary) return null;

                    const metrics = playerMetricDescriptors
                      .map((descriptor) => {
                        const formatted = formatPlayerMetric(summary, descriptor.key);
                        if (formatted === null) return null;
                        return { ...descriptor, value: formatted };
                      })
                      .filter(Boolean) as Array<{ key: keyof PlayerSummary; label: string; value: string }>;

                    if (metrics.length === 0) return null;

                    return (
                      <div
                        key={`${label}-${index}`}
                        className="space-y-3 rounded-lg border border-slate-800/60 bg-slate-950/60 p-4"
                      >
                        <h4 className="text-base font-semibold text-slate-200">{label}</h4>
                        <dl className="grid grid-cols-1 gap-3 text-sm text-slate-200">
                          {metrics.map((metric) => (
                            <div key={metric.key} className="space-y-1">
                              <dt className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</dt>
                              <dd className="font-medium text-slate-100">{metric.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {tournamentDetails.length > 0 && (
              <section className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Datos del torneo
                </h3>
                <dl className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
                  {tournamentDetails.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{item.label}</dt>
                      <dd className="font-medium text-slate-100">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {headToHeadDetails.length > 0 && (
              <section className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Head to head</h3>
                <dl className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
                  {headToHeadDetails.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{item.label}</dt>
                      <dd className="font-medium text-slate-100">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {contextDetails.length > 0 && (
              <section className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Contexto</h3>
                <dl className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
                  {contextDetails.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{item.label}</dt>
                      <dd className="font-medium text-slate-100">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {data.extras && (
              <section className="space-y-2 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Datos adicionales
                </h3>
                <dl className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
                  {data.extras.display_p && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Nombre P</dt>
                      <dd>{data.extras.display_p}</dd>
                    </div>
                  )}
                  {data.extras.display_o && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Nombre O</dt>
                      <dd>{data.extras.display_o}</dd>
                    </div>
                  )}
                  {data.extras.rank_p !== null && data.extras.rank_p !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Rank P</dt>
                      <dd>{data.extras.rank_p}</dd>
                    </div>
                  )}
                  {data.extras.rank_o !== null && data.extras.rank_o !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Rank O</dt>
                      <dd>{data.extras.rank_o}</dd>
                    </div>
                  )}
                  {data.extras.ytd_wr_p !== null && data.extras.ytd_wr_p !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">WR P</dt>
                      <dd>{Math.round(data.extras.ytd_wr_p * 100)}%</dd>
                    </div>
                  )}
                  {data.extras.ytd_wr_o !== null && data.extras.ytd_wr_o !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">WR O</dt>
                      <dd>{Math.round(data.extras.ytd_wr_o * 100)}%</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </div>
        </div>
      )}

      {data && (
        <details className="mt-6 text-xs text-slate-400">
          <summary className="cursor-pointer text-slate-300">Ver datos crudos</summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-slate-950/60 p-4 text-[11px] text-slate-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}

      <Button asChild variant="secondary" className="mt-8">
        <Link href="/">← Volver al bracket</Link>
      </Button>
    </div>
  );
}
