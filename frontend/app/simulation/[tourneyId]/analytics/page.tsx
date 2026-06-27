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
  // Veces que llego AL MENOS a esa ronda (no veces que se quedo justo ahi).
  cumulative: Record<string, number>;
};

const roundPriority = ["W", "F", "SF", "QF", "R16", "R32", "R64", "R128"] as const;
const ROUND_DISPLAY_ORDER = ["R128", "R64", "R32", "R16", "QF", "SF", "F", "W"] as const;
const ROUND_LABELS: Record<string, string> = {
  R128: "R128",
  R64: "R64",
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  F: "FINAL",
  W: "CAMPEÓN",
};

const colorForPercent = (percent: number): string => {
  const clamped = Math.max(0, Math.min(100, percent));
  if (clamped <= 0) return "transparent";
  const alpha = 0.08 + (clamped / 100) * 0.55;
  return `rgba(34, 197, 94, ${alpha.toFixed(3)})`;
};
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
        const pageSize = 1000;
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

          start += safeChunk.length;
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
            .select("player_id, name")
            .in("player_id", numericIds);

          if (playersErr) {
            console.warn("No se pudo cargar players_min:", playersErr.message);
          } else if (players) {
            for (const p of players) {
              const key = String(p.player_id);
              mergedMap.set(key, {
                id: key,
                name: p.name ?? null,
                country: null,
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
          cumulative: {},
        });
      }

      const entry = byPlayer.get(key)!;
      entry.totals[round] = (entry.totals[round] ?? 0) + 1;
    }

    const orderedRounds = ROUND_DISPLAY_ORDER.filter((r) => roundsPresent.has(r));

    // Acumulado: cuantas runs llegaron AL MENOS a esta ronda, sumando esta
    // ronda y todas las posteriores (un jugador eliminado en QF tambien
    // "llego" a R32/R16, asi que esas columnas deben incluirlo).
    for (const player of byPlayer.values()) {
      let running = 0;
      for (let i = orderedRounds.length - 1; i >= 0; i--) {
        const round = orderedRounds[i];
        running += player.totals[round] ?? 0;
        player.cumulative[round] = running;
      }
    }

    const rowsArray = Array.from(byPlayer.values()).sort((a, b) => {
      for (const round of roundPriority) {
        const diff = (b.cumulative[round] ?? 0) - (a.cumulative[round] ?? 0);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      rounds: orderedRounds,
      rows: rowsArray,
    };
  }, [rows, playersMap]);

  const [sortRound, setSortRound] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedPlayers = useMemo(() => {
    if (!sortRound) return aggregated.rows;
    const dirMul = sortDir === "asc" ? 1 : -1;
    return [...aggregated.rows].sort((a, b) => {
      if (sortRound === "__name__") {
        return dirMul * a.name.localeCompare(b.name);
      }
      const diff = (a.cumulative[sortRound] ?? 0) - (b.cumulative[sortRound] ?? 0);
      if (diff !== 0) return dirMul * diff;
      return a.name.localeCompare(b.name);
    });
  }, [aggregated.rows, sortRound, sortDir]);

  const handleSort = (key: string) => {
    if (sortRound === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortRound(key);
      setSortDir("desc");
    }
  };

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
            onClick={() => router.push(`/tournament/${encodeURIComponent(tourneyId)}`)}
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
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-semibold hover:text-slate-200"
                    onClick={() => handleSort("__name__")}
                  >
                    Jugador {sortRound === "__name__" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  {aggregated.rounds.map((round) => (
                    <th
                      key={round}
                      className="cursor-pointer select-none px-4 py-3 font-semibold text-right hover:text-slate-200"
                      onClick={() => handleSort(round)}
                    >
                      {ROUND_LABELS[round] ?? round}{" "}
                      {sortRound === round ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedPlayers.map((player) => (
                  <tr key={player.key} className="hover:bg-slate-900/70">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {player.country ? <span>{player.country}</span> : null}
                        <span className="font-medium text-slate-100">{player.name}</span>
                      </div>
                    </td>
                    {aggregated.rounds.map((round) => {
                      const reached = player.cumulative[round] ?? 0;
                      const percent = effectiveRunCount > 0 ? (reached / effectiveRunCount) * 100 : 0;
                      const percentLabel = percent.toLocaleString("es-ES", {
                        maximumFractionDigits: percent > 0 && percent < 100 ? 1 : 0,
                      });
                      return (
                        <td
                          key={round}
                          className="px-4 py-2 text-right tabular-nums font-medium text-slate-100"
                          style={{ backgroundColor: colorForPercent(percent) }}
                        >
                          {percent > 0 ? `${percentLabel}%` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


