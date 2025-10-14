"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, Play } from "lucide-react";
import {
  WinProbabilityOrb,
  getWinProbabilitySummary,
  normalizeProbabilityValue,
} from "@/components/prematch/win-probability-orb";

export type Player = {
  id: string;
  name: string;
  seed?: number | null;
  country?: string;
};

export type Match = {
  id: string;
  round: "R64" | "R32" | "R16" | "QF" | "SF" | "F";
  top: Player;
  bottom: Player;
  winnerId?: string;
};

export type Bracket = {
  tourney_id: string;
  event: string;
  surface: string;
  drawSize: number;
  matches: Match[];
};

const byRound = (matches: Match[], round: Match["round"]) =>
  matches.filter((m) => m.round === round);

function MatchCard({ m, onClick }: { m: Match; onClick?: (m: Match) => void }) {
  const winnerBadge = m.winnerId ? (m.winnerId === m.top.id ? "TOP" : "BOT") : null;
  return (
    <Card
      className="rounded-2xl shadow-sm hover:shadow transition cursor-pointer"
      onClick={() => onClick?.(m)}
    >
      <CardContent className="p-3">
        <div className="text-xs text-gray-500 mb-2">{m.round}</div>
        <div
          className={`flex items-center justify-between text-sm ${
            winnerBadge === "TOP" ? "font-semibold" : ""
          }`}
        >
          <span>
            {m.top.name}
            {m.top.seed ? ` (${m.top.seed})` : ""}
          </span>
          {winnerBadge === "TOP" && (
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              Ganador
            </span>
          )}
        </div>
        <div
          className={`flex items-center justify-between text-sm ${
            winnerBadge === "BOT" ? "font-semibold" : ""
          }`}
        >
          <span>
            {m.bottom.name}
            {m.bottom.seed ? ` (${m.bottom.seed})` : ""}
          </span>
          {winnerBadge === "BOT" && (
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              Ganador
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Column({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="w-64 min-w-64">
      <div className="text-sm font-medium text-gray-600 mb-2 px-1">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type PlayerPrematchStats = {
  win_pct_year: number | null;
  win_pct_surface: number | null;
  win_pct_month: number | null;
  win_pct_vs_top10: number | null;
  court_speed_score: number | null;
  win_score: number | null;
  win_probability: number | null;
  ranking: number | null;
  home_advantage: boolean | null;
  days_since_last: number | null;
};

type PrematchSummary = {
  prob_player: number | null;
  playerA: PlayerPrematchStats;
  playerB: PlayerPrematchStats;
  h2h: {
    total: number;
    wins: number;
    losses: number;
    last_meeting: string | null;
  };
  last_surface: string | null;
  defends_round: string | null;
  court_speed: number | null;
};

const normalizePrematchSummary = (raw: unknown): PrematchSummary => {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const data = asRecord(raw);
  const playerA = asRecord(data?.playerA) ?? null;
  const playerB = asRecord(data?.playerB) ?? null;
  type RawH2h = {
    wins?: unknown;
    losses?: unknown;
    last_meeting?: unknown;
  };

  const h2h = (asRecord(data?.h2h) as RawH2h | null) ?? ({} as RawH2h);
  const meta = (asRecord(data?.meta) ?? data ?? {}) as Record<string, unknown>;

  const asNumber = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
      if (!match) return null;
      const normalized = match[0].includes(",") && !match[0].includes(".")
        ? match[0].replace(",", ".")
        : match[0].replace(/,/g, "");
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const buildPlayer = (p: Record<string, unknown> | null | undefined): PlayerPrematchStats => ({
    win_pct_year: asNumber(p?.win_pct_year),
    win_pct_surface: asNumber(p?.win_pct_surface),
    win_pct_month: asNumber(p?.win_pct_month),
    win_pct_vs_top10: asNumber(p?.win_pct_vs_top10),
    court_speed_score: asNumber(p?.court_speed_score),
    win_score: asNumber(p?.win_score),
    win_probability: asNumber(p?.win_probability),
    ranking: asNumber(p?.ranking),
    home_advantage:
      typeof p?.home_advantage === "boolean"
        ? p.home_advantage
        : typeof p?.home_advantage === "string"
        ? p.home_advantage.toLowerCase() === "true"
        : null,
    days_since_last: asNumber(p?.days_since_last),
  });

  const wins = asNumber(h2h?.wins) ?? 0;
  const losses = asNumber(h2h?.losses) ?? 0;

  const extras = asRecord(data?.extras) ?? null;

  const probabilityCandidates: Array<number | null> = [
    asNumber(data?.prob_player),
    asNumber(data?.probability),
    asNumber(playerA?.win_probability),
    asNumber(extras?.ytd_wr_p),
  ];

  let probability: number | null = null;
  for (const candidate of probabilityCandidates) {
    const normalized = normalizeProbabilityValue(candidate);
    if (normalized !== null) {
      probability = normalized;
      break;
    }
  }

  return {
    prob_player: probability,
    playerA: buildPlayer(playerA),
    playerB: buildPlayer(playerB),
    h2h: {
      wins,
      losses,
      total: wins + losses,
      last_meeting: typeof h2h?.last_meeting === "string" ? h2h.last_meeting : null,
    },
    last_surface: typeof meta?.last_surface === "string" ? meta.last_surface : null,
    defends_round: typeof meta?.defends_round === "string" ? meta.defends_round : null,
    court_speed: asNumber(meta?.court_speed),
  };
};

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  const ratio = Math.abs(value) <= 1 ? value * 100 : value;
  return `${ratio.toFixed(1)}%`;
}

function formatFloat(value: number | null, decimals = 1) {
  if (value == null) return "N/A";
  return `${Number(value).toFixed(decimals)}`;
}

function formatRank(value: number | null) {
  if (value == null) return "N/A";
  return `#${value}`;
}

function formatBool(value: boolean | null) {
  if (value == null) return "N/A";
  return value ? "Sí" : "No";
}

function formatDays(value: number | null) {
  if (value == null) return "N/A";
  return `${value} días`;
}

function StatRow({
  label,
  playerA,
  playerB,
}: {
  label: string;
  playerA: string;
  playerB: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 text-sm text-slate-200">
      <div>{playerA}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 text-center">
        {label}
      </div>
      <div className="text-right">{playerB}</div>
    </div>
  );
}

function PrematchDialog({
  open,
  onOpenChange,
  match,
  bracket,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match?: Match | null;
  bracket: Bracket;
}) {
  const [summary, setSummary] = useState<PrematchSummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match) return;
    const playerAId = Number.parseInt(match.top.id, 10);
    const playerBId = Number.parseInt(match.bottom.id, 10);

    if (Number.isNaN(playerAId) || Number.isNaN(playerBId)) {
      setSummary(null);
      setError("Esperando a que se definan ambos jugadores para el prematch.");
      return;
    }
    const fetchPrematch = async () => {
      setLoading(true);
      setError(null);
      setSummary(null);
      console.log("📦 PrematchDialog payload", {
        playerA_id: playerAId,
        playerB_id: playerBId,
        tourney_id: bracket?.tourney_id,
      });
      try {
        const res = await fetch("/api/prematch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerA_id: playerAId,
            playerB_id: playerBId,
            tourney_id: bracket?.tourney_id, // asegúrate bracket esté en alcance o pásalo como prop
            year: new Date().getFullYear(),
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(`Error del servidor: ${res.status} — ${text}`);
        } else {
          const data = await res.json();
          setSummary(normalizePrematchSummary(data));
        }
      } catch (err) {
        console.error("❌ Error de red al obtener prematch", err);
        setError("Error de red al intentar análisis prematch.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrematch();
  }, [match, bracket]);

  const probability = summary?.prob_player ?? null;
  const { percent, percentOpponent } = useMemo(
    () => getWinProbabilitySummary(probability),
    [probability],
  );

  if (!match) return null;
  const { top, bottom } = match;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] min-h-0 overflow-hidden border border-slate-800 bg-slate-950/95 p-0 text-slate-100 flex flex-col">
        <div className="flex max-h-full min-h-0 flex-col">
          <DialogHeader className="px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-xl">
              Prematch: {top.name} vs {bottom.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
            <div className="space-y-5 text-sm">
              {loading && <div className="text-slate-400">Cargando análisis…</div>}
              {error && <div className="text-red-400">{error}</div>}

              {summary && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-10 md:flex-row md:items-start md:justify-center">
                    <WinProbabilityOrb
                      label={top.name}
                      value={probability}
                      description="El rojo intenso y las chispas indican a este jugador llegando en modo imparable."
                    />
                    <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-slate-700/60 to-transparent md:block" />
                    <WinProbabilityOrb
                      label={bottom.name}
                      value={probability != null ? 1 - probability : null}
                      description="Si el azul glaciar domina, el modelo anticipa un partido cuesta arriba para este jugador."
                    />
                  </div>

                  <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="text-base font-semibold text-slate-100">Resumen rápido</h3>
                    <p className="text-sm text-slate-300">
                      Nuestro modelo otorga a <strong>{top.name}</strong> una probabilidad de victoria del{' '}
                      <strong>{percent !== null ? `${percent}%` : '—'}</strong>, dejando para <strong>{bottom.name}</strong>{' '}
                      el restante <strong>{percentOpponent !== null ? `${percentOpponent}%` : '—'}</strong>.
                    </p>
                    <p className="text-xs text-slate-400">
                      Observa el brillo: cuando una esfera se incendia en rojos ardientes, habla de inercia ganadora; si domina el hielo, el pulso llega congelado.
                    </p>
                  </section>

                  <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70">
                    <div className="border-b border-slate-800/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Comparativa de jugadores
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      <StatRow
                        label="% año"
                        playerA={formatPct(summary.playerA.win_pct_year)}
                        playerB={formatPct(summary.playerB.win_pct_year)}
                      />
                      <StatRow
                        label="% superficie"
                        playerA={formatPct(summary.playerA.win_pct_surface)}
                        playerB={formatPct(summary.playerB.win_pct_surface)}
                      />
                      <StatRow
                        label="% mes"
                        playerA={formatPct(summary.playerA.win_pct_month)}
                        playerB={formatPct(summary.playerB.win_pct_month)}
                      />
                      <StatRow
                        label="% vs Top 10"
                        playerA={formatPct(summary.playerA.win_pct_vs_top10)}
                        playerB={formatPct(summary.playerB.win_pct_vs_top10)}
                      />
                      <StatRow
                        label="Win score"
                        playerA={formatFloat(summary.playerA.win_score, 2)}
                        playerB={formatFloat(summary.playerB.win_score, 2)}
                      />
                      <StatRow
                        label="Prob. victoria"
                        playerA={formatPct(summary.playerA.win_probability)}
                        playerB={formatPct(summary.playerB.win_probability)}
                      />
                      <StatRow
                        label="Court speed score"
                        playerA={formatFloat(summary.playerA.court_speed_score, 1)}
                        playerB={formatFloat(summary.playerB.court_speed_score, 1)}
                      />
                      <StatRow
                        label="Ranking"
                        playerA={formatRank(summary.playerA.ranking)}
                        playerB={formatRank(summary.playerB.ranking)}
                      />
                      <StatRow
                        label="Últimos días"
                        playerA={formatDays(summary.playerA.days_since_last)}
                        playerB={formatDays(summary.playerB.days_since_last)}
                      />
                      <StatRow
                        label="Ventaja local"
                        playerA={formatBool(summary.playerA.home_advantage)}
                        playerB={formatBool(summary.playerB.home_advantage)}
                      />
                    </div>
                  </section>

                  <section className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 via-slate-900/60 to-slate-950/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Head to head</div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-2xl font-semibold text-slate-100">
                            {summary.h2h.wins} - {summary.h2h.losses}
                          </div>
                          <div className="text-xs text-slate-400">
                            Total {summary.h2h.total} partido{summary.h2h.total === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div className="rounded-full border border-slate-800/80 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-300">
                          {top.name.split(' ')[0]} / {bottom.name.split(' ')[0]}
                        </div>
                      </div>
                      {summary.h2h.last_meeting ? (
                        <div className="text-sm text-slate-300">
                          Último duelo: <span className="font-medium text-slate-100">{summary.h2h.last_meeting}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">Sin registro reciente</div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contexto</div>
                      <div className="space-y-2 text-sm text-slate-300">
                        <div>
                          Último torneo similar: <span className="font-medium text-slate-100">{summary.last_surface ?? 'Desconocido'}</span>
                        </div>
                        <div>
                          Defiende puntos de: <span className="font-medium text-slate-100">{summary.defends_round ?? 'Ninguno'}</span>
                        </div>
                        <div>
                          Velocidad estimada de la pista: {summary.court_speed != null ? summary.court_speed : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-800/60 bg-slate-950/90 px-6 py-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function EstrategoBracketApp() {
  const router = useRouter();
  const sp = useSearchParams();
  const tParam = sp.get("t") || "2025-329";
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmMatch, setPmMatch] = useState<Match | null>(null);
  const [tidInput, setTidInput] = useState<string>(tParam);

  useEffect(() => {
    setTidInput(tParam);
  }, [tParam]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/tournament/${tParam}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Bracket = await res.json();
        setBracket(data);
      } catch (err) {
        console.warn("Fallo cargando torneo", err);
        setBracket(null);
      }
    };
    load();
  }, [tParam]);

  const rounds: Match["round"][] = useMemo(
  () => ["R64", "R32", "R16", "QF", "SF", "F"],
  []
);

  const matchesByRound = useMemo(() => {
    const map: Record<string, Match[]> = {};
    for (const r of rounds) {
      map[r] = bracket?.matches
        ? byRound(bracket.matches, r).sort((a, b) => {
            const numA = parseInt(a.id.split("-")[1]);
            const numB = parseInt(b.id.split("-")[1]);
            return numA - numB;
          })
        : [];
    }
    return map;
  }, [bracket, rounds]);

  const onSimulate = async () => {
    if (!bracket) return;
    const simRes = await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tourney_id: bracket.tourney_id }),
    });

    if (!simRes.ok) {
      console.error("❌ Error al simular torneo:", await simRes.text());
      return;
    }

    const res = await fetch(`/api/tournament/${bracket.tourney_id}`);
    const data = (await res.json()) as Bracket;
    setBracket(data);
  };

  const onReset = async () => {
    if (!bracket?.tourney_id) return;

    await fetch("/api/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tourney_id: bracket.tourney_id }),
    });

    const res = await fetch(`/api/tournament/${bracket.tourney_id}`);
    const data: Bracket = await res.json();
    setBracket(data);
  };

  const fetchPrematch = async (m: Match) => {
    if (!bracket) return;

    const playerAId = Number.parseInt(m.top.id, 10);
    const playerBId = Number.parseInt(m.bottom.id, 10);

    if (Number.isNaN(playerAId) || Number.isNaN(playerBId)) {
      console.info("⏭️ Prematch omitido: jugadores sin definir", {
        top: m.top.id,
        bottom: m.bottom.id,
      });
      return;
    }

    const payload = {
      playerA_id: playerAId,
      playerB_id: playerBId,
      tourney_id: bracket.tourney_id,
      year: new Date().getFullYear(),
    };

    console.log("📦 Payload prematch:", payload);

    try {
      const res = await fetch("/api/prematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const summary = await res.json();
      console.log("🔍 Prematch summary:", summary);
    } catch (err) {
      console.error("❌ Error en prematch", err);
    }
  };

  function onOpenPrematch(m: Match) {
    setPmMatch(m);
    setPmOpen(true);
    fetchPrematch(m);
  }

  if (!bracket) {
    return <div className="p-6 text-sm text-gray-600">Cargando torneo…</div>;
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <form
        className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:flex-row md:items-center md:gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (tidInput && tidInput.trim()) {
            router.push(`/?t=${encodeURIComponent(tidInput.trim())}`);
          }
        }}
      >
        <label className="text-xs font-medium text-slate-400 md:w-40">Seleccionar torneo (tourney_id)</label>
        <input
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-700"
          placeholder="p.ej., 2025-429"
          value={tidInput}
          onChange={(e) => setTidInput(e.target.value)}
        />
        <Button type="submit" className="md:ml-2">Cargar</Button>
        <div className="text-xs text-slate-500 md:ml-auto">Actual: {tParam}</div>
      </form>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">{bracket.event}</h1>
          <p className="text-sm text-gray-600">
            Draw {bracket.drawSize} · Superficie: {bracket.surface}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-2xl" onClick={onSimulate}>
            <Play className="w-4 h-4 mr-2" /> Simular
          </Button>
          <Button variant="secondary" className="rounded-2xl" onClick={onReset}>
            Resetear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-6">
          {rounds.map((r: Match["round"], idx) => (
            <React.Fragment key={r}>
              <Column title={r}>
                {matchesByRound[r].length ? (
                  matchesByRound[r].map((m) => (
                    <MatchCard key={m.id} m={m} onClick={onOpenPrematch} />
                  ))
                ) : (
                  <EmptyRound />
                )}
              </Column>
              {idx < rounds.length - 1 && (
                <div className="flex items-center">
                  <ChevronRight className="text-gray-400" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <PrematchDialog open={pmOpen} onOpenChange={setPmOpen} match={pmMatch} bracket={bracket} />
    </div>
  );
}

function EmptyRound() {
  return <div className="text-xs text-gray-500 italic px-1">(esperando simulación)</div>;
}
