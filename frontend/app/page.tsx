"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Play } from "lucide-react";

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
  ranking: number | null;
  home_advantage: boolean | null;
  days_since_last: number | null;
};

type PrematchSummary = {
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

const defaultPlayerStats: PlayerPrematchStats = {
  win_pct_year: null,
  win_pct_surface: null,
  ranking: null,
  home_advantage: null,
  days_since_last: null,
};

const normalizePrematchSummary = (raw: unknown): PrematchSummary => {
  const data = raw as Record<string, unknown> | null;
  const playerA = data?.playerA ?? {};
  const playerB = data?.playerB ?? {};
  const h2h = data?.h2h ?? {};
  const meta = data?.meta ?? data ?? {};

  const asNumber = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const buildPlayer = (p: Record<string, unknown> | null | undefined): PlayerPrematchStats => ({
    win_pct_year: asNumber(p?.win_pct_year),
    win_pct_surface: asNumber(p?.win_pct_surface),
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

  return {
    playerA: { ...defaultPlayerStats, ...buildPlayer(playerA) },
    playerB: { ...defaultPlayerStats, ...buildPlayer(playerB) },
    h2h: {
      wins,
      losses,
      total: wins + losses,
      last_meeting: h2h?.last_meeting ?? null,
    },
    last_surface: typeof meta?.last_surface === "string" ? meta.last_surface : null,
    defends_round: typeof meta?.defends_round === "string" ? meta.defends_round : null,
    court_speed: asNumber(meta?.court_speed),
  };
};

function formatPct(value: number | null) {
  if (value == null) return "N/A";
  return `${value.toFixed(1)}%`;
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

  if (!match) return null;
  const { top, bottom } = match;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Prematch: {top.name} vs {bottom.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {loading && <div className="text-gray-500">Cargando análisis…</div>}
          {error && <div className="text-red-500">{error}</div>}

          {summary && (
            <div className="space-y-3">
              <div>
                <strong>% Victorias año:</strong>{" "}
                {`${top.name}: ${formatPct(summary.playerA.win_pct_year)} · ${bottom.name}: ${formatPct(summary.playerB.win_pct_year)}`}
              </div>
              <div>
                <strong>% Victorias superficie:</strong>{" "}
                {`${top.name}: ${formatPct(summary.playerA.win_pct_surface)} · ${bottom.name}: ${formatPct(summary.playerB.win_pct_surface)}`}
              </div>
              <div>
                <strong>Ranking actual:</strong>{" "}
                {`${top.name}: ${formatRank(summary.playerA.ranking)} · ${bottom.name}: ${formatRank(summary.playerB.ranking)}`}
              </div>
              <div>
                <strong>Días desde el último partido:</strong>{" "}
                {`${top.name}: ${formatDays(summary.playerA.days_since_last)} · ${bottom.name}: ${formatDays(summary.playerB.days_since_last)}`}
              </div>
              <div>
                <strong>H2H:</strong> {summary.h2h.total} partidos —{" "}
                {top.name}: {summary.h2h.wins}, {bottom.name}:{" "}
                {summary.h2h.losses}
                {summary.h2h.last_meeting
                  ? ` • Último: ${summary.h2h.last_meeting}`
                  : ""}
              </div>
              <div>
                <strong>Ventaja local:</strong>{" "}
                {`${top.name}: ${formatBool(summary.playerA.home_advantage)} · ${bottom.name}: ${formatBool(summary.playerB.home_advantage)}`}
              </div>
              <div>
                <strong>Última superficie jugada:</strong>{" "}
                {summary.last_surface || "Desconocida"}
              </div>
              <div>
                <strong>Defiende ronda:</strong>{" "}
                {summary.defends_round || "Ninguna"}
              </div>
              <div>
                <strong>Velocidad de pista:</strong>{" "}
                {summary.court_speed != null
                  ? summary.court_speed
                  : "N/A"}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function EstrategoBracketApp() {
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmMatch, setPmMatch] = useState<Match | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/tournament/2025-329");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Bracket = await res.json();
        setBracket(data);
      } catch (err) {
        console.warn("Fallo cargando torneo", err);
        setBracket(null);
      }
    };
    load();
  }, []);

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
