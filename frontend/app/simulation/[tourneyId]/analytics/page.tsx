"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type SimulationRow = {
  player_id: number | string;
  run_number: number | string;
  reached_round: string;
};

type PlayerInfo = {
  id: string;
  name: string | null;
  country?: string | null;
};

type AggregatedPlayer = {
  key: string;
  playerId: number | null;
  displayId: string;
  name: string;
  country: string | null;
  totals: Record<string, number>;
};

const roundPriority = ["F", "SF", "QF", "R16", "R32", "R64", "R128"] as const;
const roundLevelMap = new Map<string, number>(
  roundPriority.map((round, index) => [round, roundPriority.length - index]),
);

type BellChartBar = {
  key: string;
  name: string;
  displayId: string;
  country: string | null;
  highestRound: string;
  highestLevel: number;
  highestCount: number;
  averageLevel: number;
  totalAppearances: number;
  intensity: number;
};

const arrangeBellOrder = <T,>(items: T[]): T[] => {
  if (items.length === 0) return [];
  if (items.length === 1) return items.slice();

  const slots: Array<T | null> = new Array(items.length).fill(null);
  let centre = Math.floor(items.length / 2);
  slots[centre] = items[0];

  let left = centre - 1;
  let right = centre + 1;
  let index = 1;

  while (index < items.length) {
    if (left >= 0) {
      slots[left] = items[index];
      left -= 1;
      index += 1;
      if (index >= items.length) break;
    }

    if (right < items.length) {
      slots[right] = items[index];
      right += 1;
      index += 1;
    }
  }

  return slots.filter((slot): slot is T => slot !== null);
};

function BellCurveChart({
  data,
  axisRounds,
  maxLevel,
  totalRuns,
}: {
  data: BellChartBar[];
  axisRounds: string[];
  maxLevel: number;
  totalRuns: number;
}) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
        Aun no hay datos de simulaciones para graficar.
      </div>
    );
  }

  const axisEntries = axisRounds
    .map((round) => {
      const level = roundLevelMap.get(round) ?? 0;
      const normalized =
        maxLevel > 1 ? ((level - 1) / (maxLevel - 1)) * 100 : 100;
      return {
        round,
        level,
        position: Math.max(0, Math.min(100, normalized)),
      };
    })
    .sort((a, b) => a.level - b.level);

  const normalizeLevel = (level: number) => {
    if (maxLevel <= 1) return 100;
    const raw = ((level - 1) / (maxLevel - 1)) * 100;
    return Math.max(6, Math.min(100, raw));
  };

  const formatPercent = (value: number) =>
    `${(value * 100).toFixed(value === 1 ? 0 : value >= 0.1 ? 1 : 2)}%`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Distribucion de rondas alcanzadas
          </h2>
          <p className="text-xs text-slate-400">
            Barras ordenadas tipo campana: mas avanzan, mas centradas y con color mas intenso.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Runs considerados: {totalRuns > 0 ? totalRuns : "0"}
        </div>
      </div>

      <div className="relative mt-4">
        <div className="absolute left-0 top-0 bottom-0 w-16">
          {axisEntries.map((entry) => (
            <div
              key={entry.round}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-slate-500"
              style={{ bottom: `${entry.position}%` }}
            >
              {entry.round}
            </div>
          ))}
        </div>
        <div className="pl-16">
          <div className="relative h-64">
            <div className="pointer-events-none absolute inset-0">
              {axisEntries.map((entry) => (
                <div
                  key={`line-${entry.round}`}
                  className="absolute inset-x-0 border-t border-slate-800/60"
                  style={{ bottom: `${entry.position}%` }}
                />
              ))}
              <div className="absolute inset-y-0 left-0 border-l border-slate-800/80" />
              <div className="absolute bottom-0 inset-x-0 border-t border-slate-800/80" />
            </div>
            <div className="relative h-full overflow-x-auto">
              <div className="flex h-full items-end justify-center gap-6 px-6">
                {data.map((bar) => {
                  const heightPct = normalizeLevel(bar.highestLevel);
                  const intensity = Math.max(0, Math.min(1, bar.intensity));
                  const baseHue = 196;
                  const baseSat = 82;
                  const maxLight = 70;
                  const minLight = 28;
                  const lightness =
                    maxLight - intensity * (maxLight - minLight);
                  const gradientTail = Math.max(12, lightness - 6);
                  const shadowLight = Math.max(8, lightness - 12);
                  const barColor = `hsl(${baseHue} ${baseSat}% ${lightness}%)`;
                  const shadowOpacity = 0.25 + intensity * 0.35;
                  const shadowColor = `hsla(${baseHue}, ${baseSat}%, ${shadowLight}%, ${shadowOpacity})`;
                  const percentage =
                    totalRuns > 0 ? bar.highestCount / totalRuns : 0;

                  return (
                    <div
                      key={bar.key}
                      className="flex min-w-[110px] flex-col items-center gap-2 text-center"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        {bar.highestRound}
                      </div>
                      <div className="flex h-full w-14 items-end justify-center">
                        <div
                          className="relative flex w-full items-end justify-center"
                          style={{ height: "100%" }}
                        >
                          <div
                            className="w-full rounded-t-lg border border-slate-700/50"
                            style={{
                              height: `${heightPct}%`,
                              background: `linear-gradient(180deg, ${barColor} 0%, hsl(${baseHue} ${baseSat}% ${gradientTail}%) 100%)`,
                              boxShadow: `0px 10px 25px ${shadowColor}`,
                            }}
                          >
                            <div className="absolute inset-x-0 top-2 text-[11px] font-semibold text-slate-900/80">
                              {bar.highestCount}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {percentage > 0 ? formatPercent(percentage) : "0%"}
                      </div>
                      <div className="text-xs font-medium text-slate-100">
                        {bar.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        #{bar.displayId}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SimulationAnalyticsPage() {
  const params = useParams<{ tourneyId: string }>();
  const router = useRouter();
  const tourneyId = params?.tourneyId ?? "";

  const [rows, setRows] = useState<SimulationRow[]>([]);
  const [playersMap, setPlayersMap] = useState<Map<string, PlayerInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState<number | null>(null);

  useEffect(() => {
    if (!tourneyId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const pageSize = 2000;
        let start = 0;
        let fetched: SimulationRow[] = [];

        while (true) {
          const { data: chunk, error: chunkErr } = await supabase
            .from("simulation_results")
            .select("player_id, run_number, reached_round")
            .eq("tourney_id", tourneyId)
            .order("run_number", { ascending: true })
            .order("player_id", { ascending: true })
            .range(start, start + pageSize - 1);

          if (chunkErr) {
            throw new Error(chunkErr.message);
          }

          const safeChunk = chunk ?? [];
          fetched = fetched.concat(safeChunk);

          if (safeChunk.length < pageSize) {
            break;
          }

          start += pageSize;
        }

        setRows(fetched);

        const { data: runCountData, error: runCountErr } = await supabase.rpc(
          "simulation_results_run_count",
          { p_tourney_id: tourneyId },
        );
        if (!runCountErr && typeof runCountData === "number") {
          setRunCount(runCountData);
        } else {
          setRunCount(null);
        }

        const numericIds = Array.from(
          new Set(
            fetched
              .map((r) => Number(r.player_id))
              .filter((id) => Number.isFinite(id)),
          ),
        );

        const mergedMap = new Map<string, PlayerInfo>();

        if (numericIds.length > 0) {
          const { data: players, error: playersErr } = await supabase
            .from("players_min")
            .select("id, name, country")
            .in("id", numericIds);

          if (playersErr) {
            console.warn("No se pudo cargar players_min:", playersErr.message);
          } else if (players) {
            for (const p of players) {
              const rawId = p.id;
              const key = String(rawId);
              mergedMap.set(key, {
                id: key,
                name: p.name ?? null,
                country: p.country,
              });
            }
          }
        }

        try {
          const res = await fetch(`/api/tournament/${encodeURIComponent(tourneyId)}`);
          if (res.ok) {
            const bracketData = await res.json();
            const matches = Array.isArray(bracketData?.matches) ? bracketData.matches : [];
            for (const match of matches) {
              if (match?.top?.id != null) {
                const key = String(match.top.id);
                const existing = mergedMap.get(key);
                const name = match.top.name ?? existing?.name ?? null;
                const country = match.top.country ?? existing?.country ?? null;
                mergedMap.set(key, { id: key, name, country });
              }
              if (match?.bottom?.id != null) {
                const key = String(match.bottom.id);
                const existing = mergedMap.get(key);
                const name = match.bottom.name ?? existing?.name ?? null;
                const country = match.bottom.country ?? existing?.country ?? null;
                mergedMap.set(key, { id: key, name, country });
              }
            }
          }
        } catch (bracketErr) {
          console.warn("No se pudo cargar bracket para nombres:", bracketErr);
        }

        setPlayersMap(mergedMap);
      } catch (err) {
        console.error("Error cargando resultados de simulacion:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tourneyId]);

  const totalRuns = useMemo(() => {
    const set = new Set<number>();
    for (const row of rows) {
      const runNum = Number(row.run_number);
      if (Number.isFinite(runNum)) {
        set.add(runNum);
      }
    }
    return set.size;
  }, [rows]);

  const effectiveRunCount = runCount ?? totalRuns;

  const aggregated = useMemo(() => {
    const roundsPresent = new Set<string>();
    const byPlayer = new Map<string, AggregatedPlayer>();

    for (const row of rows) {
      const round = row.reached_round;
      const key = String(row.player_id);
      if (!key || typeof round !== "string") continue;
      roundsPresent.add(round);

      if (!byPlayer.has(key)) {
        const playerInfo = playersMap.get(key);
        const numericId = Number(row.player_id);
        const displayId = Number.isFinite(numericId) ? String(numericId) : key;
        const rawName = playerInfo?.name ?? null;
        const displayName =
          rawName && rawName.trim().length > 0 ? rawName.trim() : `Jugador ${displayId}`;
        byPlayer.set(key, {
          key,
          playerId: Number.isFinite(numericId) ? numericId : null,
          displayId,
          name: displayName,
          country: playerInfo?.country ?? null,
          totals: {},
        });
      }

      const entry = byPlayer.get(key)!;
      entry.totals[round] = (entry.totals[round] ?? 0) + 1;
    }

    const orderedRounds = roundPriority.filter((r) => roundsPresent.has(r));

    const rowsArray = Array.from(byPlayer.values()).sort((a, b) => {
      for (const round of roundPriority) {
        const diff = (b.totals[round] ?? 0) - (a.totals[round] ?? 0);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      rounds: orderedRounds,
      rows: rowsArray,
    };
  }, [rows, playersMap]);

  const bellChart = useMemo(() => {
    if (!aggregated.rows.length) {
      return {
        bars: [] as BellChartBar[],
        axisRounds: aggregated.rounds.length ? aggregated.rounds : Array.from(roundPriority),
        maxLevel: roundPriority.length,
      };
    }

    const bars: BellChartBar[] = [];

    for (const player of aggregated.rows) {
      let highestLevel = 0;
      let highestRound = "";
      let highestCount = 0;
      let totalAppearances = 0;
      let weightedLevels = 0;

      for (const round of roundPriority) {
        const appearances = player.totals[round] ?? 0;
        if (appearances <= 0) continue;
        const level = roundLevelMap.get(round) ?? 0;
        totalAppearances += appearances;
        weightedLevels += appearances * level;

        if (
          level > highestLevel ||
          (level === highestLevel && appearances > highestCount)
        ) {
          highestLevel = level;
          highestRound = round;
          highestCount = appearances;
        }
      }

      if (!totalAppearances || !highestRound) continue;

      const averageLevel =
        totalAppearances > 0 ? weightedLevels / totalAppearances : 0;
      const intensity =
        effectiveRunCount > 0
          ? Math.max(0, Math.min(1, highestCount / effectiveRunCount))
          : 0;

      bars.push({
        key: player.key,
        name: player.name,
        displayId: player.displayId,
        country: player.country ?? null,
        highestRound,
        highestLevel,
        highestCount,
        averageLevel,
        totalAppearances,
        intensity,
      });
    }

    const sorted = bars.sort((a, b) => {
      const avgDiff = b.averageLevel - a.averageLevel;
      if (Math.abs(avgDiff) > 1e-6) return avgDiff;
      const levelDiff = b.highestLevel - a.highestLevel;
      if (levelDiff !== 0) return levelDiff;
      const intensityDiff = b.intensity - a.intensity;
      if (Math.abs(intensityDiff) > 1e-6) return intensityDiff;
      return a.name.localeCompare(b.name);
    });

    const orderedBars = arrangeBellOrder(sorted);
    const axisRounds =
      aggregated.rounds.length > 0 ? aggregated.rounds : Array.from(roundPriority);

    const axisMaxLevel =
      axisRounds.length > 0
        ? axisRounds.reduce((max, round) => {
            const level = roundLevelMap.get(round) ?? 0;
            return level > max ? level : max;
          }, 1)
        : roundPriority.length;

    return {
      bars: orderedBars,
      axisRounds,
      maxLevel: axisMaxLevel,
    };
  }, [aggregated.rows, aggregated.rounds, effectiveRunCount]);

  const topPerformers = useMemo(() => {
    if (aggregated.rows.length === 0) return [];

    return aggregated.rows
      .map((player) => ({
        key: player.key,
        playerId: player.playerId,
        displayId: player.displayId,
        name: player.name,
        country: player.country,
        finals: player.totals["F"] ?? 0,
        semis: player.totals["SF"] ?? 0,
      }))
      .filter((entry) => entry.finals > 0 || entry.semis > 0)
      .sort((a, b) => {
        const byFinals = b.finals - a.finals;
        if (byFinals !== 0) return byFinals;
        return b.semis - a.semis;
      })
      .slice(0, 4);
  }, [aggregated.rows, aggregated.rounds]);

  if (!tourneyId) {
    return (
      <div className="min-h-screen p-6 text-sm text-slate-200">
        <p>Falta el identificador del torneo.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 p-6 md:p-10 text-slate-100 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Resultados simulados - {tourneyId}</h1>
          <p className="text-sm text-slate-400">
            Runs procesados: {effectiveRunCount > 0 ? effectiveRunCount : "0"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push(`/?t=${encodeURIComponent(tourneyId)}`)}
          >
            Volver al cuadro
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Inicio</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
          Cargando resultados...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-800/70 bg-red-950/40 p-6 text-sm text-red-200">
          No se pudieron cargar los resultados: {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
          Aun no hay simulaciones registradas para este torneo.
        </div>
      ) : (
        <div className="space-y-6">
          <BellCurveChart
            data={bellChart.bars}
            axisRounds={bellChart.axisRounds}
            maxLevel={bellChart.maxLevel}
            totalRuns={effectiveRunCount}
          />
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Jugador</th>
                  {aggregated.rounds.map((round) => (
                    <th key={round} className="px-4 py-3 font-semibold text-right">
                      {round}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {aggregated.rows.map((player) => (
                  <tr key={player.key} className="hover:bg-slate-900/70">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">{player.name}</span>
                          {player.country ? (
                            <span className="text-xs text-slate-400">{player.country}</span>
                          ) : null}
                        </div>
                      <div className="text-xs text-slate-500">#{player.displayId}</div>
                    </div>
                  </td>
                    {aggregated.rounds.map((round) => {
                      const reached = player.totals[round] ?? 0;
                    const percent =
                      effectiveRunCount > 0
                        ? ((reached / effectiveRunCount) * 100).toLocaleString("es-ES", {
                              maximumFractionDigits: reached > 0 && reached < totalRuns ? 1 : 0,
                            })
                          : "0";
                      return (
                        <td key={round} className="px-4 py-2 text-right tabular-nums">
                          <div>{reached}</div>
                          <div className="text-xs text-slate-500">{percent}%</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {topPerformers.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-100">Top finalistas y semifinalistas</h2>
                <span className="text-xs text-slate-400">
                  Referencia sobre {effectiveRunCount > 0 ? `${effectiveRunCount} runs` : "0 runs"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Jugador</th>
                      <th className="px-4 py-2 text-right font-semibold">Finales</th>
                      <th className="px-4 py-2 text-right font-semibold">Semifinales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topPerformers.map((player) => {
                      const finalsPct =
                        effectiveRunCount > 0 && player.finals > 0
                          ? ((player.finals / effectiveRunCount) * 100).toFixed(
                              player.finals === effectiveRunCount ? 0 : 1,
                            )
                          : null;
                      const semisPct =
                        effectiveRunCount > 0 && player.semis > 0
                          ? ((player.semis / effectiveRunCount) * 100).toFixed(
                              player.semis === effectiveRunCount ? 0 : 1,
                            )
                          : null;

                      return (
                        <tr key={player.key} className="hover:bg-slate-900/70">
                          <td className="px-4 py-2">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-100">{player.name}</span>
                                {player.country ? (
                                  <span className="text-xs text-slate-400">{player.country}</span>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-500">
                                #{player.displayId}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {player.finals}
                            {finalsPct ? (
                              <span className="ml-1 text-xs text-slate-500">({finalsPct}%)</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {player.semis}
                            {semisPct ? (
                              <span className="ml-1 text-xs text-slate-500">({semisPct}%)</span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}


