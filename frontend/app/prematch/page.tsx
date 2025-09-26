// app/prematch/page.tsx
"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

// ---------------- Types ----------------
type Extras = {
  display_p?: string;
  display_o?: string;
  country_p?: string; // ISO-2
  country_o?: string; // ISO-2
  rank_p?: number | null;
  rank_o?: number | null;
  ytd_wr_p?: number | null; // 0..1
  ytd_wr_o?: number | null; // 0..1
  def_points_p?: number | null;
  def_points_o?: number | null;
  def_title_p?: "champ" | "runner" | null;
  def_title_o?: "champ" | "runner" | null;
};

type Features = {
  deltas?: {
    month?: number | null;
    surface?: number | null;
    speed?: number | null;
    rank_norm?: number | null;
    ytd?: number | null;
  };
};

type PrematchResp = {
  prob_player: number;
  tournament?: {
    name?: string;
    surface?: string;
    bucket?: string;
    month?: number;
  };
  flags?: {
    is_local_p?: boolean;
    is_local_o?: boolean;
    surf_change_p?: boolean;
    surf_change_o?: boolean;
  };
  extras?: Extras;
  features?: Features;
  market_odds?: {
    p?: number;
    o?: number;
  };
};

// ---------------- Helpers ----------------
const pct = (x?: number | null) =>
  x == null ? "—" : `${Math.round((x || 0) * 100)}%`;

const badgeRank = (r?: number | null) => {
  if (r == null) return "bg-gray-100";
  if (r <= 3) return "bg-yellow-200";
  if (r <= 10) return "bg-gray-200";
  if (r <= 20) return "bg-orange-200";
  return "bg-gray-100";
};

const flagUrl = (iso2?: string) =>
  iso2 ? `https://flagcdn.com/48x36/${iso2.toLowerCase()}.png` : "";

const fairOdds = (p: number) => (p > 0 && p < 1 ? 1 / p : null);

function DeltaBar({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const v = value ?? 0;
  const width = Math.min(100, Math.abs(v) * 100);
  const side = v >= 0 ? "justify-end" : "justify-start";
  const color = v >= 0 ? "bg-green-500/70" : "bg-red-500/70";
  return (
    <div className="text-sm">
      <div className="text-xs text-gray-600 mb-1">
        {label}: <span className="font-mono">{(v * 100).toFixed(1)}%</span>
      </div>
      <div
        className={`flex ${side} w-full bg-gray-100 h-2 rounded-full overflow-hidden`}
      >
        <div className={`${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function PrematchPage() {
  const sp = useSearchParams();
  const playerA = sp.get("playerA") || "Player A";
  const playerB = sp.get("playerB") || "Player B";
  const tid = sp.get("tid") || "unknown";

  const [data, setData] = useState<PrematchResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/prematch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerA, playerB, tournamentId: tid }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j: PrematchResp = await res.json();
        setData(j);
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("Error desconocido");
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [playerA, playerB, tid]);

  const p = data?.prob_player ?? 0.5;
  const fairA = fairOdds(p);
  const fairB = fairOdds(1 - p);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">
          Prematch: {playerA} vs {playerB}
        </h1>
        <p className="text-sm text-gray-600">
          Torneo: {data?.tournament?.name || tid} ·{" "}
          {data?.tournament?.surface || "?"} ·{" "}
          {data?.tournament?.bucket || "?"}
        </p>
      </div>

      {loading && <div className="text-sm text-gray-600">Cargando…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* VS Panel */}
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {data.extras?.country_p && (
                    <Image
                      src={flagUrl(data.extras.country_p)}
                      alt="flag"
                      width={24}
                      height={16}
                      className="rounded-sm"
                    />
                  )}
                  <div className="text-lg font-medium">
                    {data.extras?.display_p || playerA}
                  </div>
                </div>
                <div
                  className={`text-xs px-2 py-1 rounded-full ${badgeRank(
                    data.extras?.rank_p
                  )}`}
                >
                  #{data.extras?.rank_p ?? "—"}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {data.extras?.country_o && (
                    <Image
                      src={flagUrl(data.extras.country_o)}
                      alt="flag"
                      width={24}
                      height={16}
                      className="rounded-sm"
                    />
                  )}
                  <div className="text-lg font-medium">
                    {data.extras?.display_o || playerB}
                  </div>
                </div>
                <div
                  className={`text-xs px-2 py-1 rounded-full ${badgeRank(
                    data.extras?.rank_o
                  )}`}
                >
                  #{data.extras?.rank_o ?? "—"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-sm">
                  YTD {playerA}:{" "}
                  <strong>{pct(data.extras?.ytd_wr_p)}</strong>
                </div>
                <div className="text-sm">
                  YTD {playerB}:{" "}
                  <strong>{pct(data.extras?.ytd_wr_o)}</strong>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Prob {playerA}
                </div>
                <div className="w-full h-3 rounded-full bg-gradient-to-r from-red-300 via-yellow-300 to-green-400 relative overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-black/10"
                    style={{ width: `${(1 - p) * 100}%`, right: 0 }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span>
                    Justa {playerA}: {fairA ? fairA.toFixed(2) : "—"}
                  </span>
                  <span>
                    Justa {playerB}: {fairB ? fairB.toFixed(2) : "—"}
                  </span>
                </div>
                {data.market_odds && (
                  <div className="text-xs text-gray-700 mt-2">
                    Mercado → {playerA}: {data.market_odds.p ?? "—"} ·{" "}
                    {playerB}: {data.market_odds.o ?? "—"}
                    {fairA && data.market_odds.p && (
                      <span className="ml-2">
                        Edge {playerA}:{" "}
                        {(
                          ((data.market_odds.p - fairA) / fairA) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* HIST Deltas */}
          <Card className="rounded-2xl lg:col-span-2">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-medium text-gray-700">
                Señales HIST (Δ P−O)
              </h2>
              <DeltaBar label="Mes" value={data.features?.deltas?.month} />
              <DeltaBar
                label="Superficie"
                value={data.features?.deltas?.surface}
              />
              <DeltaBar
                label="Velocidad"
                value={data.features?.deltas?.speed}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <Button asChild variant="secondary">
          <Link href="/">← Volver al bracket</Link>
        </Button>
      </div>
    </div>
  );
}
