"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
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
import { ChevronRight, Play, Flame } from "lucide-react";
import {
  WinProbabilityOrb,
  getWinProbabilitySummary,
  normalizeProbabilityValue,
} from "@/components/prematch/win-probability-orb";

export type Player = {
  id: string;
  name: string;
  seed?: number | null;
  entryType?: string | null;
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
  extras?: {
    country_p?: string | null;
    country_o?: string | null;
  };
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
    extras: {
      country_p: typeof (extras as any)?.country_p === "string" ? String((extras as any).country_p) : null,
      country_o: typeof (extras as any)?.country_o === "string" ? String((extras as any).country_o) : null,
    },
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
  return value ? "Si" : "No";
}

function formatDays(value: number | null) {
  if (value == null) return "N/A";
  return `${value} dias`;
}

function normalizeRatio01(value: number | null): number {
  if (value == null || Number.isNaN(value as any)) return 0;
  const v = Math.abs(value as number) <= 1 ? Number(value) : Number(value) / 100;
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function ytdBand(ratio01: number): "blue" | "green" | "orange" | "red" {
  const p = ratio01 * 100;
  if (p >= 80) return "red";
  if (p >= 66) return "orange";
  if (p >= 50) return "green";
  return "blue";
}

function bandStyle(ratio01: number) {
  const band = ytdBand(ratio01);
  // RGB stops for bands
  const map: Record<string, { start: [number, number, number]; end: [number, number, number] }> = {
    blue: { start: [96, 165, 250], end: [37, 99, 235] },
    green: { start: [34, 197, 94], end: [22, 163, 74] },
    orange: { start: [245, 158, 11], end: [217, 119, 6] },
    red: { start: [239, 68, 68], end: [220, 38, 38] },
  };
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const alpha = clamp(0.35 + 0.65 * ratio01, 0.2, 0.95);
  const headAlpha = clamp(0.25 + 0.55 * ratio01, 0.2, 0.95);
  const toRgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  const sw = map[band];
  const start = toRgba(sw.start, alpha);
  const end = toRgba(sw.end, alpha);
  const head = toRgba(sw.start, headAlpha);
  const border = toRgba(sw.end, 0.6);
  const showFire = band === "red";
  return { start, end, head, border, showFire };
}

function rankBadge(rank: number | null) {
  if (rank == null || !Number.isFinite(rank)) {
    return { label: "Rank N/A", className: "bg-slate-800 text-slate-300 border border-slate-700" };
  }
  const r = Math.round(rank);
  if (r >= 1 && r <= 5)
    return { label: `#${r} - TOP 5`, className: "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40" };
  if (r <= 10)
    return { label: `#${r} - TOP 10`, className: "bg-slate-300/20 text-slate-200 border border-slate-300/40" };
  if (r <= 20)
    return { label: `#${r} - TOP 20`, className: "bg-amber-600/20 text-amber-400 border border-amber-600/40" };
  if (r <= 50)
    return { label: `#${r} - TOP 50`, className: "bg-orange-700/20 text-orange-400 border border-orange-700/40" };
  return { label: `#${r}`, className: "bg-slate-700/20 text-slate-300 border border-slate-600/40" };
}

function isoToFlag(iso?: string | null) {
  if (!iso) return "";
  let code = iso.trim().toUpperCase();
  if (code.length === 3) {
    const iocToIso2: Record<string, string> = {
      ESP: "ES", ARG: "AR", USA: "US", GBR: "GB", UKR: "UA", GER: "DE", FRA: "FR", ITA: "IT",
      SUI: "CH", NED: "NL", BEL: "BE", SWE: "SE", NOR: "NO", DEN: "DK", CRO: "HR", SRB: "RS",
      BIH: "BA", POR: "PT", POL: "PL", CZE: "CZ", SVK: "SK", SLO: "SI", HUN: "HU", AUT: "AT",
      AUS: "AU", NZL: "NZ", CAN: "CA", MEX: "MX", COL: "CO", CHI: "CL", PER: "PE", ECU: "EC",
      URU: "UY", BOL: "BO", VEN: "VE", BRA: "BR", JPN: "JP", KOR: "KR", CHN: "CN", HKG: "HK",
      TPE: "TW", THA: "TH", VIE: "VN", IND: "IN", PAK: "PK", QAT: "QA", UAE: "AE", KAZ: "KZ",
      UZB: "UZ", GEO: "GE", ARM: "AM", TUR: "TR", GRE: "GR", CYP: "CY", ROU: "RO", BUL: "BG",
      LTU: "LT", LAT: "LV", EST: "EE", FIN: "FI", IRL: "IE", SCO: "GB", WAL: "GB",
    };
    code = iocToIso2[code] || code;
  }
  if (code.length !== 2) return code;
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  const chars = Array.from(code).map((c) => String.fromCodePoint(A + (c.charCodeAt(0) - a)));
  return chars.join("");
}

function decimalOdds(prob: number | null): string {
  if (prob == null) return "-";
  if (prob <= 0) return "-";
  if (prob >= 1) return "-";
  const d = 1 / prob;
  return d.toFixed(2);
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
      console.log("PrematchDialog payload", {
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
            tourney_id: bracket?.tourney_id, // asegurate bracket este en alcance o pasalo como prop
            year: new Date().getFullYear(),
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          setError(`Error del servidor: ${res.status} - ${text}`);
        } else {
          const data = await res.json();
          setSummary(normalizePrematchSummary(data));
        }
      } catch (err) {
        console.error("Error de red al obtener prematch", err);
        setError("Error de red al intentar analisis prematch.");
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

  const oddsA = useMemo(() => decimalOdds(probability), [probability]);
  const oddsB = useMemo(() => decimalOdds(probability != null ? 1 - probability : null), [probability]);
  
const highlight = useMemo(() => {
  if (!summary || !match) return null as null | { text: string };
  const a = summary.playerA;
  const b = summary.playerB;
  type C = { key: keyof typeof a; label: string };
  const cands: C[] = [
    { key: "win_pct_month", label: "% victorias en el mes" },
    { key: "win_pct_vs_top10", label: "% victorias vs Top 10" },
  ];
  let best: { label: string; a: number; b: number } | null = null;
  for (const c of cands) {
    const va = (a as any)?.[c.key];
    const vb = (b as any)?.[c.key];
    if (typeof va === "number" && typeof vb === "number") {
      // placeholder branch removed during cleanup
    }
  }
  // Recalcular correctamente sin .NET Math; usamos JS runtime más abajo
  best = null;
  for (const c of cands) {
    const va = (a as any)?.[c.key] as any;
    const vb = (b as any)?.[c.key] as any;
    if (typeof va === "number" && typeof vb === "number") {
      if (best === null || Math.abs(va - vb) > Math.abs(best.a - best.b)) {
        best = { label: c.label, a: va, b: vb };
      }
    }
  }
  if (!best) return null;
  const who = best.a > best.b ? "A" : best.b > best.a ? "B" : null;
  if (!who) return null;
  const left = formatPct(best.a);
  const right = formatPct(best.b);
  if (left === "N/A" || right === "N/A") return null;
  const topName = match.top.name;
  const bottomName = match.bottom.name;
  const text = (
    who === "A"
      ? `${topName} destaca en ${best.label}: ${left} vs ${right}`
      : `${bottomName} destaca en ${best.label}: ${right} vs ${left}`
  );
  return { text };
}, [summary, match]);
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
              {loading && <div className="text-slate-400">Cargando analisis...</div>}
              {error && <div className="text-red-400">{error}</div>}

              {summary && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-10 md:flex-row md:items-start md:justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <WinProbabilityOrb label={top.name} value={probability} />
                      {(() => {
                        const badge = rankBadge(summary?.playerA?.ranking ?? null);
                        const seed = match?.top?.seed;
                        return (
                          <div className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${badge.className}`}>
                            <span>{badge.label}</span>
                          </div>
                        );
                      })()}
                      {(() => {
                        const chips: any[] = [];
                        const flag = isoToFlag(summary?.extras?.country_p ?? null);
                        if (flag) chips.push(<span key="flag" className="text-base leading-none">{flag}</span>);
                        const seed = match?.top?.seed;
                        if (typeof seed === "number" && Number.isFinite(seed)) {
                          chips.push(
                            <span key="seed" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">#{seed}</span>,
                          );
                        }
                        const et = match?.top?.entryType?.toUpperCase();
                        if (et === 'Q' || et === 'WC') {
                          chips.push(
                            <span key="et" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">{et}</span>,
                          );
                        }
                        return chips.length ? (
                          <div className="flex items-center gap-2">{chips}</div>
                        ) : null;
                      })()}
                    </div>
                    <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-slate-700/60 to-transparent md:block" />
                    <div className="flex flex-col items-center gap-2">
                      <WinProbabilityOrb label={bottom.name} value={probability != null ? 1 - probability : null} />
                      {(() => {
                        const badge = rankBadge(summary?.playerB?.ranking ?? null);
                        const seed = match?.bottom?.seed;
                        return (
                          <div className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${badge.className}`}>
                            <span>{badge.label}</span>
                          </div>
                        );
                      })()}
                      {(() => {
                        const chips: any[] = [];
                        const flag = isoToFlag(summary?.extras?.country_o ?? null);
                        if (flag) chips.push(<span key="flag" className="text-base leading-none">{flag}</span>);
                        const seed = match?.bottom?.seed;
                        if (typeof seed === "number" && Number.isFinite(seed)) {
                          chips.push(
                            <span key="seed" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">#{seed}</span>,
                          );
                        }
                        const et = match?.bottom?.entryType?.toUpperCase();
                        if (et === 'Q' || et === 'WC') {
                          chips.push(
                            <span key="et" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-200">{et}</span>,
                          );
                        }
                        return chips.length ? (
                          <div className="flex items-center gap-2">{chips}</div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="text-base font-semibold text-slate-100">Resumen rapido</h3>
                    <p className="text-sm text-slate-300">
                      Nuestro modelo otorga a <strong>{top.name}</strong> una probabilidad de victoria del{' '}
                      <strong>{percent !== null ? `${percent}%` : '-'}</strong>, dejando para <strong>{bottom.name}</strong>{' '}
                      el restante <strong>{percentOpponent !== null ? `${percentOpponent}%` : '-'}</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
                      <div className="rounded-md border border-slate-800/60 bg-slate-950/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Cuota (decimal)</div>
                        <div className="font-semibold">{top.name}: {oddsA}</div>
                      </div>
                      <div className="rounded-md border border-slate-800/60 bg-slate-950/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Cuota (decimal)</div>
                        <div className="font-semibold">{bottom.name}: {oddsB}</div>
                      </div>
                    </div>
                    {highlight?.text && (
                      <div className="text-xs text-slate-300">Destacado: {highlight.text}</div>
                    )}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70">
                    <div className="border-b border-slate-800/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Comparativa de jugadores
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      <StatRow
                        label="YTD"
                        playerA={formatPct(summary.playerA.win_pct_year)}
                        playerB={formatPct(summary.playerB.win_pct_year)}
                      />
                      <div className="px-4 pb-2">
                        {(() => {
                          const rA = normalizeRatio01(summary.playerA.win_pct_year);
                          const rB = normalizeRatio01(summary.playerB.win_pct_year);
                          const sA = bandStyle(rA);
                          const sB = bandStyle(rB);
                          return (
                            <>
                              <div className="relative h-10 rounded-md border border-slate-800 bg-slate-950/40">
                                {/* eje central */}
                                <div className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 bg-slate-700/30" />

                                {/* varilla izquierda (Player A) */}
                                <div
                                  className="absolute right-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full"
                                  style={{
                                    width: `${rA * 50}%`,
                                    background: `linear-gradient(90deg, ${sA.start} 0%, ${sA.end} 100%)`,
                                  }}
                                />
                                {/* varilla derecha (Player B) */}
                                <div
                                  className="absolute left-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-r-full"
                                  style={{
                                    width: `${rB * 50}%`,
                                    background: `linear-gradient(90deg, ${sB.start} 0%, ${sB.end} 100%)`,
                                  }}
                                />

                                {/* cabeza izquierda */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                                  style={{ left: `calc(50% - ${rA * 50}%)` }}
                                >
                                  <div
                                    className="h-4 w-4 rounded-full"
                                    style={{
                                      border: `1px solid ${sA.border}`,
                                      background: `radial-gradient(circle, ${sA.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)`,
                                    }}
                                  />
                                  {sA.showFire && (
                                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-red-500">
                                      <Flame size={14} />
                                    </div>
                                  )}
                                </div>

                                {/* cabeza derecha */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                                  style={{ left: `calc(50% + ${rB * 50}%)` }}
                                >
                                  <div
                                    className="h-4 w-4 rounded-full"
                                    style={{
                                      border: `1px solid ${sB.border}`,
                                      background: `radial-gradient(circle, ${sB.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)`,
                                    }}
                                  />
                                  {sB.showFire && (
                                    <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-red-500">
                                      <Flame size={14} />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1 grid grid-cols-2 text-[11px] text-slate-400">
                                <div className="text-left">{formatPct(summary.playerA.win_pct_year)}</div>
                                <div className="text-right">{formatPct(summary.playerB.win_pct_year)}</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <StatRow
                        label="% mes"
                        playerA={formatPct(summary.playerA.win_pct_month)}
                        playerB={formatPct(summary.playerB.win_pct_month)}
                      />
                      {(() => {
                        const rA = normalizeRatio01(summary.playerA.win_pct_month);
                        const rB = normalizeRatio01(summary.playerB.win_pct_month);
                        const sA = bandStyle(rA);
                        const sB = bandStyle(rB);
                        return (
                          <div className="px-4 pb-2">
                            <div className="relative h-10 rounded-md border border-slate-800 bg-slate-950/40">
                              <div className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 bg-slate-700/30" />
                              <div className="absolute right-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full" style={{ width: `${rA * 50}%`, background: `linear-gradient(90deg, ${sA.start} 0%, ${sA.end} 100%)` }} />
                              <div className="absolute left-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-r-full" style={{ width: `${rB * 50}%`, background: `linear-gradient(90deg, ${sB.start} 0%, ${sB.end} 100%)` }} />
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% - ${rA * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sA.border}`, background: `radial-gradient(circle, ${sA.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sA.showFire && <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% + ${rB * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sB.border}`, background: `radial-gradient(circle, ${sB.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sB.showFire && <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                            </div>
                            <div className="mt-1 grid grid-cols-2 text-[11px] text-slate-400">
                              <div className="text-left">{formatPct(summary.playerA.win_pct_month)}</div>
                              <div className="text-right">{formatPct(summary.playerB.win_pct_month)}</div>
                            </div>
                          </div>
                        );
                      })()}
                      <StatRow
                        label="% superficie"
                        playerA={formatPct(summary.playerA.win_pct_surface)}
                        playerB={formatPct(summary.playerB.win_pct_surface)}
                      />
                      {(() => {
                        const rA = normalizeRatio01(summary.playerA.win_pct_surface);
                        const rB = normalizeRatio01(summary.playerB.win_pct_surface);
                        const sA = bandStyle(rA);
                        const sB = bandStyle(rB);
                        return (
                          <div className="px-4 pb-2">
                            <div className="relative h-10 rounded-md border border-slate-800 bg-slate-950/40">
                              <div className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 bg-slate-700/30" />
                              <div className="absolute right-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full" style={{ width: `${rA * 50}%`, background: `linear-gradient(90deg, ${sA.start} 0%, ${sA.end} 100%)` }} />
                              <div className="absolute left-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-r-full" style={{ width: `${rB * 50}%`, background: `linear-gradient(90deg, ${sB.start} 0%, ${sB.end} 100%)` }} />
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% - ${rA * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sA.border}`, background: `radial-gradient(circle, ${sA.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sA.showFire && <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% + ${rB * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sB.border}`, background: `radial-gradient(circle, ${sB.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sB.showFire && <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                            </div>
                            <div className="mt-1 grid grid-cols-2 text-[11px] text-slate-400">
                              <div className="text-left">{formatPct(summary.playerA.win_pct_surface)}</div>
                              <div className="text-right">{formatPct(summary.playerB.win_pct_surface)}</div>
                            </div>
                          </div>
                        );
                      })()}
                      <StatRow
                        label="% vs Top 10"
                        playerA={formatPct(summary.playerA.win_pct_vs_top10)}
                        playerB={formatPct(summary.playerB.win_pct_vs_top10)}
                      />
                      {(() => {
                        const rA = normalizeRatio01(summary.playerA.win_pct_vs_top10);
                        const rB = normalizeRatio01(summary.playerB.win_pct_vs_top10);
                        const sA = bandStyle(rA);
                        const sB = bandStyle(rB);
                        return (
                          <div className="px-4 pb-2">
                            <div className="relative h-10 rounded-md border border-slate-800 bg-slate-950/40">
                              <div className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 bg-slate-700/30" />
                              <div className="absolute right-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full" style={{ width: `${rA * 50}%`, background: `linear-gradient(90deg, ${sA.start} 0%, ${sA.end} 100%)` }} />
                              <div className="absolute left-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-r-full" style={{ width: `${rB * 50}%`, background: `linear-gradient(90deg, ${sB.start} 0%, ${sB.end} 100%)` }} />
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% - ${rA * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sA.border}`, background: `radial-gradient(circle, ${sA.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sA.showFire && <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% + ${rB * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sB.border}`, background: `radial-gradient(circle, ${sB.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sB.showFire && <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                            </div>
                            <div className="mt-1 grid grid-cols-2 text-[11px] text-slate-400">
                              <div className="text-left">{formatPct(summary.playerA.win_pct_vs_top10)}</div>
                              <div className="text-right">{formatPct(summary.playerB.win_pct_vs_top10)}</div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      <StatRow label="Prob. victoria" playerA={formatPct(summary.playerA.win_probability)} playerB={formatPct(summary.playerB.win_probability)} />
                      {(() => {
                        const rA = normalizeRatio01(summary.playerA.win_probability);
                        const rB = normalizeRatio01(summary.playerB.win_probability);
                        const sA = bandStyle(rA);
                        const sB = bandStyle(rB);
                        return (
                          <div className="px-4 pb-2">
                            <div className="relative h-10 rounded-md border border-slate-800 bg-slate-950/40">
                              <div className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 bg-slate-700/30" />
                              <div className="absolute right-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full" style={{ width: `${rA * 50}%`, background: `linear-gradient(90deg, ${sA.start} 0%, ${sA.end} 100%)` }} />
                              <div className="absolute left-1/2 top-1/2 h-[3px] -translate-y-1/2 rounded-r-full" style={{ width: `${rB * 50}%`, background: `linear-gradient(90deg, ${sB.start} 0%, ${sB.end} 100%)` }} />
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% - ${rA * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sA.border}`, background: `radial-gradient(circle, ${sA.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sA.showFire && <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `calc(50% + ${rB * 50}%)` }}>
                                <div className="h-4 w-4 rounded-full" style={{ border: `1px solid ${sB.border}`, background: `radial-gradient(circle, ${sB.head} 0%, rgba(15,23,42,0.2) 70%, transparent 100%)` }} />
                                {sB.showFire && <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-red-500"><Flame size={14} /></div>}
                              </div>
                            </div>
                            <div className="mt-1 grid grid-cols-2 text-[11px] text-slate-400">
                              <div className="text-left">{formatPct(summary.playerA.win_probability)}</div>
                              <div className="text-right">{formatPct(summary.playerB.win_probability)}</div>
                            </div>
                          </div>
                        );
                      })()}
                      <StatRow
                        label="Court speed score"
                        playerA={formatFloat(summary.playerA.court_speed_score, 1)}
                        playerB={formatFloat(summary.playerB.court_speed_score, 1)}
                      />
                      <StatRow
                        label="Ultimos dias"
                        playerA={formatDays(summary.playerA.days_since_last)}
                        playerB={formatDays(summary.playerB.days_since_last)}
                      />
                      <StatRow
                        label="Ventaja local"
                        playerA={formatBool(summary.playerA.home_advantage)}
                        playerB={formatBool(summary.playerB.home_advantage)}
                      />
                      <StatRow
                        label="Win score"
                        playerA={formatFloat(summary.playerA.win_score, 2)}
                        playerB={formatFloat(summary.playerB.win_score, 2)}
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
                          Ultimo duelo: <span className="font-medium text-slate-100">{summary.h2h.last_meeting}</span>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">Sin registro reciente</div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contexto</div>
                      <div className="space-y-2 text-sm text-slate-300">
                        <div>
                          Ultimo torneo similar: <span className="font-medium text-slate-100">{summary.last_surface ?? 'Desconocido'}</span>
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


export function EstrategoBracketApp() {
  const router = useRouter();
  const sp = useSearchParams();
  const tParam = sp.get("t") || "2025-329";
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [pmMatch, setPmMatch] = useState<Match | null>(null);
  const [tidInput, setTidInput] = useState<string>(tParam);
  const [listLoading, setListLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Array<{ tourney_id: string; name: string; surface?: string; draw_size?: number }>>([]);

  useEffect(() => {
    setTidInput(tParam);
  }, [tParam]);

  // Load tournaments list (recent)
  useEffect(() => {
    const loadList = async () => {
      setListLoading(true);
      try {
        const res = await fetch("/api/tournaments?limit=30");
        if (res.ok) {
          const j = await res.json();
          setTournaments(Array.isArray(j.items) ? j.items : []);
        } else {
          setTournaments([]);
        }
      } catch {
        setTournaments([]);
      } finally {
        setListLoading(false);
      }
    };
    loadList();
  }, []);

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
      console.error("Error al simular torneo:", await simRes.text());
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
      console.info("Prematch omitido: jugadores sin definir", {
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

    console.log("Payload prematch:", payload);

    try {
      const res = await fetch("/api/prematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const summary = await res.json();
      console.log("Prematch summary:", summary);
    } catch (err) {
      console.error("Error en prematch", err);
    }
  };

  function onOpenPrematch(m: Match) {
    setPmMatch(m);
    setPmOpen(true);
    fetchPrematch(m);
  }

  if (!bracket) {
    return <div className="p-6 text-sm text-gray-600">Cargando torneo...</div>;
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

      {/* Quick list of tournaments */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Torneos recientes</div>
        {listLoading ? (
          <div className="text-xs text-slate-500">Cargando lista...</div>
        ) : tournaments.length === 0 ? (
          <div className="text-xs text-slate-500">Sin datos</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tournaments.map((t) => (
              <button
                key={t.tourney_id}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-sm text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                onClick={() => router.push(`/?t=${encodeURIComponent(t.tourney_id)}`)}
                type="button"
                title={t.tourney_id}
              >
                <span className="truncate">{t.name || t.tourney_id}</span>
                <span className="ml-2 text-xs text-slate-500">{t.tourney_id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">{bracket.event}</h1>
          <p className="text-sm text-gray-600">
            Draw {bracket.drawSize} - Superficie: {bracket.surface}
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
  return <div className="text-xs text-gray-500 italic px-1">(esperando simulacion)</div>;
}


export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Cargando...</div>}>
      <EstrategoBracketApp />
    </Suspense>
  );
}


