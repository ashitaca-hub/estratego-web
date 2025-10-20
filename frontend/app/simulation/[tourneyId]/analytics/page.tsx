"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type SimulationRow = {
  player_id: number;
  run_number: number;
  reached_round: string;
};

type PlayerInfo = {
  id: number;
  name: string | null;
  country?: string | null;
};

type AggregatedPlayer = {
  playerId: number;
  name: string;
  totals: Record<string, number>;
};

const roundPriority = ["F", "SF", "QF", "R16", "R32", "R64", "R128"];

export default function SimulationAnalyticsPage() {
  const params = useParams<{ tourneyId: string }>();
  const router = useRouter();
  const tourneyId = params?.tourneyId ?? "";

  const [rows, setRows] = useState<SimulationRow[]>([]);
  const [playersMap, setPlayersMap] = useState<Map<number, PlayerInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const playerIds = Array.from(
          new Set(fetched.map((r) => r.player_id).filter((id): id is number => typeof id === "number")),
        );

        if (playerIds.length > 0) {
          const { data: players, error: playersErr } = await supabase
            .from("players_min")
            .select("id, name, country")
            .in("id", playerIds);

          if (playersErr) {
            console.warn("No se pudo cargar players_min:", playersErr.message);
            setPlayersMap(new Map());
          } else {
            setPlayersMap(
              new Map((players ?? []).map((p) => [p.id as number, { id: p.id as number, name: p.name ?? null, country: p.country }])),
            );
          }
        } else {
          setPlayersMap(new Map());
        }
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
      if (typeof row.run_number === "number") {
        set.add(row.run_number);
      }
    }
    return set.size;
  }, [rows]);

  const aggregated = useMemo(() => {
    const roundsPresent = new Set<string>();
    const byPlayer = new Map<number, AggregatedPlayer>();

    for (const row of rows) {
      const round = row.reached_round;
      const playerId = row.player_id;
      if (!playerId || typeof round !== "string") continue;
      roundsPresent.add(round);

      if (!byPlayer.has(playerId)) {
        const playerInfo = playersMap.get(playerId);
        byPlayer.set(playerId, {
          playerId,
          name: playerInfo?.name ?? `Jugador ${playerId}`,
          totals: {},
        });
      }

      const entry = byPlayer.get(playerId)!;
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
          <h1 className="text-2xl font-semibold">Resultados simulados · {tourneyId}</h1>
          <p className="text-sm text-slate-400">
            Runs procesados: {totalRuns || "—"}
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
          Aún no hay simulaciones registradas para este torneo.
        </div>
      ) : (
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
                <tr key={player.playerId} className="hover:bg-slate-900/70">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-100">{player.name}</div>
                    <div className="text-xs text-slate-500">#{player.playerId}</div>
                  </td>
                  {aggregated.rounds.map((round) => {
                    const reached = player.totals[round] ?? 0;
                    const percent =
                      totalRuns > 0
                        ? ((reached / totalRuns) * 100).toLocaleString("es-ES", {
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
      )}
    </div>
  );
}
