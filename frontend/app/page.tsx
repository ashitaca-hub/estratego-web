"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";

// -------------------- Types --------------------
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

// -------------------- Helpers --------------------
const byRound = (matches: Match[], round: Match["round"]) =>
  matches.filter((m) => m.round === round);

// -------------------- UI Components --------------------
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match?: Match | null;
}) {
  if (!match) return null;
  const { top, bottom } = match;
  const deeplink = `/prematch?playerA=${encodeURIComponent(
    top.name
  )}&playerB=${encodeURIComponent(bottom.name)}&tid=2025-usa-cincy`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Prematch: {top.name} vs {bottom.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-gray-600">
            Torneo: ATP Cincinnati 2025 · Pista: hard
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-2">
              Qué verás en el detalle
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prob. implícitas y cuotas (p ↔ 1/p).</li>
              <li>
                Señales HIST: ranking, forma, H2H, superficie, defensa puntos.
              </li>
              <li>Badges: Top3, YTD ≥80/90%, etc.</li>
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href={deeplink}>Abrir prematch</Link>
            </Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main App --------------------
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

  // Definimos todas las rondas posibles
  const rounds: Match["round"][] = ["R64", "R32", "R16", "QF", "SF", "F"];

  // Agrupamos los partidos por ronda
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
  }, [bracket]);

  const onSimulate = async () => {
    if (!bracket) return;

    await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tourney_id: bracket.tourney_id }),
    });

    const res = await fetch(`/api/tournament/${bracket.tourney_id}`);
    const data: Bracket = await res.json();
    setBracket(data);
  };

const onReset = async () => {
  if (!bracket?.tourney_id) return;

  await fetch("/api/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tourney_id: bracket.tourney_id }),
  });

  // Volvemos a cargar el torneo desde el backend
  const res = await fetch(`/api/tournament/${bracket.tourney_id}`);
  const data: Bracket = await res.json();
  setBracket(data);
};

  function onOpenPrematch(m: Match) {
    setPmMatch(m);
    setPmOpen(true);
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
          {rounds.map((r, idx) => (
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

      <PrematchDialog open={pmOpen} onOpenChange={setPmOpen} match={pmMatch} />
    </div>
  );
}

function EmptyRound() {
  return (
    <div className="text-xs text-gray-500 italic px-1">
      (esperando simulación)
    </div>
  );
}
