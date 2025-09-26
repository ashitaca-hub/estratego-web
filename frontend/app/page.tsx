"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";

/**
 * Estratego Web App – MVP (single-file demo)
 * ------------------------------------------------------
 * Bracket UI (R16 → QF → SF → Final) + Simulación + Prematch dialog
 */

// -------------------- Types --------------------
export type Player = {
  id: string;
  name: string;
  seed?: number | null;
  country?: string; // ISO-2 for flags
};

export type Match = {
  id: string;
  round: "R16" | "QF" | "SF" | "F";
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

// -------------------- Mock data --------------------
const MOCK: Bracket = {
  tourney_id: "2025-329",
  event: "Tokyo 2025",
  surface: "hard",
  drawSize: 16,
  matches: [
    { id: "R16-1", round: "R16", top: { id: "sinner", name: "J. Sinner", seed: 1, country: "IT" }, bottom: { id: "thompson", name: "J. Thompson", seed: null, country: "AU" } },
    { id: "R16-2", round: "R16", top: { id: "bublik", name: "A. Bublik", seed: 15, country: "KZ" }, bottom: { id: "paul", name: "T. Paul", seed: null, country: "US" } },
    { id: "R16-3", round: "R16", top: { id: "rune", name: "H. Rune", seed: 8, country: "DK" }, bottom: { id: "de-minaur", name: "A. de Minaur", seed: 9, country: "AU" } },
    { id: "R16-4", round: "R16", top: { id: "berrettini", name: "M. Berrettini", seed: null, country: "IT" }, bottom: { id: "shelton", name: "B. Shelton", seed: 12, country: "US" } },
    { id: "R16-5", round: "R16", top: { id: "alcaraz", name: "C. Alcaraz", seed: 2, country: "ES" }, bottom: { id: "musetti", name: "L. Musetti", seed: 13, country: "IT" } },
    { id: "R16-6", round: "R16", top: { id: "medvedev", name: "D. Medvedev", seed: 3, country: "RU" }, bottom: { id: "tiafoe", name: "F. Tiafoe", seed: 14, country: "US" } },
    { id: "R16-7", round: "R16", top: { id: "zverev", name: "A. Zverev", seed: 5, country: "DE" }, bottom: { id: "rublev", name: "A. Rublev", seed: 6, country: "RU" } },
    { id: "R16-8", round: "R16", top: { id: "humbert", name: "U. Humbert", seed: 7, country: "FR" }, bottom: { id: "fritz", name: "T. Fritz", seed: 10, country: "US" } },
  ],
};

// -------------------- Helpers --------------------
const byRound = (matches: Match[], round: Match["round"]) =>
  matches.filter((m) => m.round === round);

function nextRound(prev: Match["round"]): Match["round"] {
  switch (prev) {
    case "R16":
      return "QF";
    case "QF":
      return "SF";
    case "SF":
      return "F";
    default:
      return "F";
  }
}

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
        console.warn("Fallo cargando torneo; usando MOCK", err);
        setBracket(MOCK);
      }
    };
    load();
  }, []);

  const r16 = useMemo(
    () =>
      bracket?.matches
        ? byRound(bracket.matches, "R16").sort((a, b) => a.id.localeCompare(b.id))
        : [],
    [bracket]
  );

  const qf = useMemo(
    () =>
      bracket?.matches
        ? byRound(bracket.matches, "QF").sort((a, b) => a.id.localeCompare(b.id))
        : [],
    [bracket]
  );

  const sf = useMemo(
    () =>
      bracket?.matches
        ? byRound(bracket.matches, "SF").sort((a, b) => a.id.localeCompare(b.id))
        : [],
    [bracket]
  );

  const f = useMemo(
    () =>
      bracket?.matches
        ? byRound(bracket.matches, "F").sort((a, b) => a.id.localeCompare(b.id))
        : [],
    [bracket]
  );

  const onSimulate = async () => {
    if (!bracket) return;

    await fetch("/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tourney_id: bracket.tourney_id }),
    });

    const res = await fetch("/api/tournament/2025-329");
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
        <Button className="rounded-2xl" onClick={onSimulate}>
          <Play className="w-4 h-4 mr-2" /> Simular
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-6">
          <Column title="R16">
            {r16.map((m) => (
              <MatchCard key={m.id} m={m} onClick={onOpenPrematch} />
            ))}
          </Column>
          <div className="flex items-center">
            <ChevronRight className="text-gray-400" />
          </div>
          <Column title="QF">
            {qf.length ? (
              qf.map((m) => (
                <MatchCard key={m.id} m={m} onClick={onOpenPrematch} />
              ))
            ) : (
              <EmptyRound />
            )}
          </Column>
          <div className="flex items-center">
            <ChevronRight className="text-gray-400" />
          </div>
          <Column title="SF">
            {sf.length ? (
              sf.map((m) => (
                <MatchCard key={m.id} m={m} onClick={onOpenPrematch} />
              ))
            ) : (
              <EmptyRound />
            )}
          </Column>
          <div className="flex items-center">
            <ChevronRight className="text-gray-400" />
          </div>
          <Column title="Final">
            {f.length ? (
              f.map((m) => (
                <MatchCard key={m.id} m={m} onClick={onOpenPrematch} />
              ))
            ) : (
              <EmptyRound />
            )}
          </Column>
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
