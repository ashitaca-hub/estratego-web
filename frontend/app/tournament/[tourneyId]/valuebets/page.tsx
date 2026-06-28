"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type ValueBetItem = {
  matchId: string;
  round: string;
  favoredPlayer: { id: string; name: string; country: string | null };
  otherPlayer: { id: string; name: string; country: string | null };
  modelProbability: number;
  oddsPrice: number;
  impliedProbability: number;
  valueDiff: number;
  tier: "high" | "good";
  bookmaker: string;
};

type ValueBetResponse = {
  tourney_id: string;
  event: string;
  surface: string;
  scanned: number;
  items: ValueBetItem[];
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatDiff = (value: number) => `+${(value * 100).toFixed(1)} pp`;

export default function ValueBetsPage() {
  const params = useParams<{ tourneyId: string }>();
  const router = useRouter();
  const tourneyId = params?.tourneyId ?? "";

  const [data, setData] = useState<ValueBetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tourneyId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    (async () => {
      try {
        const response = await fetch(
          `/api/tournament/${encodeURIComponent(tourneyId)}/valuebets`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Error ${response.status}`);
        }

        const payload = (await response.json()) as ValueBetResponse;
        if (!controller.signal.aborted) {
          setData(payload);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [tourneyId]);

  return (
    <div className="min-h-screen space-y-6 p-6 md:p-10 text-slate-100 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-slate-100">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
            Value bets
          </h1>
          <div className="text-sm text-slate-400">
            {data ? `${data.event} · ${data.surface}` : "Partidos pendientes donde el modelo difiere de la cuota del mercado por encima del 3%."}
            {data ? ` · Analizados: ${data.scanned}.` : null}
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => router.push(`/tournament/${encodeURIComponent(tourneyId)}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al cuadro
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Buscando value bets...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-600/50 bg-red-950/40 p-4 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          No hay value bets ahora mismo entre los partidos pendientes con cuota disponible.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <div
              key={`${item.matchId}-${item.favoredPlayer.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  {item.round} · {item.bookmaker}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    item.tier === "high"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {item.tier === "high" ? "High" : "Good"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">
                    {item.favoredPlayer.country ? `${item.favoredPlayer.country} ` : ""}
                    {item.favoredPlayer.name}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    vs {item.otherPlayer.country ? `${item.otherPlayer.country} ` : ""}
                    {item.otherPlayer.name}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-400">
                    Modelo {formatPercent(item.modelProbability)} · Mercado {formatPercent(item.impliedProbability)}
                  </div>
                  <div className="text-base font-semibold text-slate-100">
                    {item.oddsPrice.toFixed(2)}{" "}
                    <span className="text-sm font-semibold text-emerald-400">({formatDiff(item.valueDiff)})</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
