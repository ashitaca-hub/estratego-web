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
type OutcomeLineEntry = {
  key: string;
  surname: string;
  playerName: string;
  displayId: string;
  country: string | null;
  percentage: number;
  count: number;
  kind: "final" | "semi";
};

const extractSurname = (name: string, fallback: string): string => {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const lower = last.toLowerCase();
  if (["de", "del", "da", "dos", "van", "von", "la"].includes(lower) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return last;
};

function TopOutcomeLinesChart({
  finals,
  semis,
}: {
  finals: OutcomeLineEntry[];
  semis: OutcomeLineEntry[];
}) {
  const entries = [...finals, ...semis];

  if (!entries.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
        Aun no hay datos suficientes para mostrar finales o semifinales.
      </div>
    );
  }

  const chartHeight = 220;
  const legend = [
    { label: "Final", color: "hsl(2 88% 58%)" },
    { label: "Semifinal", color: "hsl(210 86% 55%)" },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Top 5 finales y semifinales
          </h2>
          <p className="text-xs text-slate-400">
            Lineas verticales: rojo para finales, azul para semifinales. La altura refleja el porcentaje de runs alcanzados.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="h-1.5 w-6 rounded-full"
                style={{ background: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-6 overflow-x-auto">
        <div className="relative h-[260px] min-w-[420px]">
          <div className="absolute inset-0 border-l border-b border-slate-800/80" />
          {Array.from({ length: 5 }).map((_, idx) => {
            const value = (idx + 1) * 20;
            return (
              <div
                key={value}
                className="absolute inset-x-0 border-t border-slate-800/40 text-[11px] text-slate-500"
                style={{ bottom: `${value}%` }}
              >
                <span className="absolute -left-14 -translate-y-1/2">{value}%</span>
              </div>
            );
          })}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-6 px-6">
            {entries.map((entry) => {
              const color =
                entry.kind === "final"
                  ? "hsl(2 88% 58%)"
                  : "hsl(210 86% 55%)";
              const muted = entry.kind === "final" ? "hsl(2 80% 80%)" : "hsl(210 65% 76%)";
              const height = Math.max(4, Math.min(chartHeight, (entry.percentage / 100) * chartHeight));

              return (
                <div
                  key={`${entry.kind}-${entry.key}`}
                  className="flex min-w-[85px] flex-col items-center gap-2 text-center"
                >
                  <div className="text-xs font-semibold text-slate-100">
                    {entry.percentage.toFixed(entry.percentage === 100 ? 0 : 1)}%
                  </div>
                  <div className="flex h-[220px] w-10 items-end justify-center">
                    <div className="relative flex w-px flex-col items-center justify-end">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${height}px`,
                          background: `linear-gradient(180deg, ${color} 0%, ${muted} 100%)`,
                        }}
                      >
                        &nbsp;
                      </div>
                      <div
                        className="absolute -top-2 h-2.5 w-2.5 rounded-full border border-slate-950"
                        style={{ background: color }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-medium text-slate-100">
                      {entry.surname}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      #{entry.displayId}
                    </span>
                  </div>
                </div>
              );
            })}
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


  const effectiveRunCount = useMemo(
    () => (runCount != null ? runCount : totalRuns),
    [runCount, totalRuns],
  );

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

  const topFinals = useMemo(() => {
    if (!aggregated.rows.length || effectiveRunCount <= 0) return [] as OutcomeLineEntry[];
    return aggregated.rows
      .map((player) => {
        const finals = player.totals["F"] ?? 0;
        const percentage = effectiveRunCount > 0 ? (finals / effectiveRunCount) * 100 : 0;
        return {
          key: player.key,
          surname: extractSurname(player.name, player.displayId),
          playerName: player.name,
          displayId: player.displayId,
          country: player.country ?? null,
          percentage,
          count: finals,
          kind: "final" as const,
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.percentage - a.percentage;
      })
      .slice(0, 5);
  }, [aggregated.rows, effectiveRunCount]);

  const topSemis = useMemo(() => {
    if (!aggregated.rows.length || effectiveRunCount <= 0) return [] as OutcomeLineEntry[];
    return aggregated.rows
      .map((player) => {
        const semis = player.totals["SF"] ?? 0;
        const percentage = effectiveRunCount > 0 ? (semis / effectiveRunCount) * 100 : 0;
        return {
          key: player.key,
          surname: extractSurname(player.name, player.displayId),
          playerName: player.name,
          displayId: player.displayId,
          country: player.country ?? null,
          percentage,
          count: semis,
          kind: "semi" as const,
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.percentage - a.percentage;
      })
      .slice(0, 5);
  }, [aggregated.rows, effectiveRunCount]);

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
          <TopOutcomeLinesChart finals={topFinals} semis={topSemis} />
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


