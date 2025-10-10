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
  const [summary, setSummary] = useState<null | {
    win_pct_year: number | null;
    win_pct_surface: number | null;
    current_rank: number | null;
    h2h: {
      total: number;
      wins: number;
      losses: number;
      last_meeting: string | null;
    };
    home_advantage: boolean;
    last_surface: string | null;
    defends_round: string | null;
    court_speed: number | null;
  }>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match) return;
    const fetchPrematch = async () => {
      setLoading(true);
      setError(null);
      setSummary(null);
      try {
        const res = await fetch("/api/prematch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerA_id: match.top.id,
            playerB_id: match.bottom.id,
            tourney_id: bracket?.tourney_id,  // asegúrate bracket esté en alcance o pásalo como prop
            year: new Date().getFullYear(),
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(`Error del servidor: ${res.status} — ${text}`);
        } else {
          const data = await res.json();
          setSummary(data);
        }
      } catch (err) {
        setError("Error de red al intentar análisis prematch.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrematch();
  }, [match]);

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
                {summary.win_pct_year != null
                  ? `${summary.win_pct_year.toFixed(1)}%`
                  : "N/A"}
              </div>
              <div>
                <strong>% Victorias superficie:</strong>{" "}
                {summary.win_pct_surface != null
                  ? `${summary.win_pct_surface.toFixed(1)}%`
                  : "N/A"}
              </div>
              <div>
                <strong>Ranking actual:</strong>{" "}
                {summary.current_rank != null
                  ? summary.current_rank
                  : "N/A"}
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
                {summary.home_advantage ? "Sí" : "No"}
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
    try {
      const res = await fetch("/api/prematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerA_id: m.top.id,
          playerB_id: m.bottom.id,
          tourney_id: String(bracket.tourney_id),
          year: 2025,
        }),
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
