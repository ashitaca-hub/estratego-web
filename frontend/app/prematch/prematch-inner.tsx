"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
};

type PrematchResp = {
  prob_player: number;
  tournament?: { name?: string; surface?: string; bucket?: string; month?: number };
  extras?: Extras;
};

type WinProbabilityOrbProps = {
  label: string;
  value: number | null | undefined;
  description?: string;
};

function WinProbabilityOrb({ label, value, description }: WinProbabilityOrbProps) {
  const { clamped, percent, displayPercent, hasValue } = useMemo(() => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { clamped: 0, percent: 0, displayPercent: "—", hasValue: false } as const;
    }
    const normalized = Math.min(1, Math.max(0, value));
    const computedPercent = Math.round(normalized * 100);
    return {
      clamped: normalized,
      percent: computedPercent,
      displayPercent: `${computedPercent}%`,
      hasValue: true,
    } as const;
  }, [value]);

  const theme = clamped >= 0.5 ? "heat" : "ice";
  const intensity = hasValue ? (theme === "heat" ? clamped : 1 - clamped) : 0;
  const fillDegree = hasValue ? clamped * 360 : 0;

  const fillColor = useMemo(() => {
    if (theme === "heat") {
      return `hsl(${18 - intensity * 6} 92% ${56 - intensity * 14}%)`;
    }
    return `hsl(${205 + intensity * 18} 82% ${62 + intensity * 8}%)`;
  }, [intensity, theme]);

  const trackColor = theme === "heat" ? "rgba(100, 116, 139, 0.32)" : "rgba(30, 58, 138, 0.28)";
  const glowColor =
    theme === "heat"
      ? `rgba(255, 95, 0, ${0.5 + intensity * 0.45})`
      : `rgba(56, 189, 248, ${0.45 + intensity * 0.45})`;

  const auraGradient = useMemo(() => {
    if (theme === "heat") {
      return [
        `radial-gradient(circle at 30% 22%, rgba(255, 255, 255, ${0.18 + intensity * 0.28}) 0%, transparent 45%)`,
        `radial-gradient(circle at 70% 18%, rgba(255, 158, 10, ${0.32 + intensity * 0.4}) 0%, transparent 60%)`,
        `radial-gradient(circle at 60% 78%, rgba(255, 45, 85, ${0.28 + intensity * 0.32}) 0%, transparent 65%)`,
      ].join(", ");
    }
    return [
      `radial-gradient(circle at 28% 24%, rgba(255, 255, 255, ${0.16 + intensity * 0.24}) 0%, transparent 45%)`,
      `radial-gradient(circle at 68% 30%, rgba(56, 189, 248, ${0.3 + intensity * 0.42}) 0%, transparent 62%)`,
      `radial-gradient(circle at 55% 80%, rgba(14, 165, 233, ${0.28 + intensity * 0.32}) 0%, transparent 65%)`,
    ].join(", ");
  }, [intensity, theme]);

  const temperatureLabel = useMemo(() => {
    if (!hasValue) return "Sin datos";
    if (clamped >= 0.92) return "🔥 En llamas";
    if (clamped >= 0.78) return "🔥 Muy caliente";
    if (clamped >= 0.62) return "🌤 Favorable";
    if (clamped >= 0.45) return "⚖️ Parejo";
    if (clamped >= 0.28) return "🧊 Fresco";
    if (clamped >= 0.12) return "❄️ Frío";
    return "🧊 Congelado";
  }, [clamped, hasValue]);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative h-48 w-48" aria-label={`${label}: ${displayPercent}`} role="img">
        <div
          className="absolute inset-[-18%] rounded-full opacity-80 blur-2xl transition-all duration-700"
          style={{
            background: auraGradient,
            filter: `blur(${22 + intensity * 14}px)`,
          }}
        />
        <div className="absolute inset-0 rounded-full bg-slate-950/70 shadow-[0_18px_46px_-20px_rgba(15,23,42,0.9)]" />
        <div
          className="absolute inset-[12px] rounded-full border border-white/10"
          style={{
            background: `conic-gradient(${fillColor} ${fillDegree}deg, ${trackColor} ${fillDegree}deg)`,
            boxShadow: `0 0 ${32 + intensity * 36}px -10px ${glowColor}, inset 0 0 ${18 + intensity * 18}px -6px ${glowColor}`,
          }}
        />
        <div className="absolute inset-[40px] rounded-full bg-slate-950/80 shadow-inner shadow-slate-950/60 backdrop-blur-sm" />
        <div className="absolute inset-[46px] flex flex-col items-center justify-center gap-1 rounded-full">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-slate-400">
            Win %
          </span>
          <span className="text-lg font-semibold text-slate-200">{label}</span>
          <span className="text-4xl font-bold text-slate-50">{displayPercent}</span>
          <span className="text-sm font-semibold" style={{ color: fillColor }}>
            {temperatureLabel}
          </span>
        </div>
      </div>

      <div className="flex w-48 flex-col gap-2">
        <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-slate-900/80 shadow-inner">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${hasValue ? percent : 0}%`,
              background: `linear-gradient(90deg, ${glowColor}, ${fillColor})`,
              boxShadow: `0 0 ${12 + intensity * 18}px ${glowColor}`,
            }}
          />
        </div>
        <p className="text-xs text-slate-400">
          {description ??
            "La intensidad del color refleja qué tan encendido o helado llega el jugador al duelo."}
        </p>
      </div>
    </div>
  );
}

export default function PrematchInner() {
  const sp = useSearchParams();
  const playerA = sp.get("playerA") || "Player A";
  const playerB = sp.get("playerB") || "Player B";
  const tourneyIdParam = sp.get("tourney_id") || sp.get("tid");
  const playerAIdParam = sp.get("playerA_id");
  const playerBIdParam = sp.get("playerB_id");
  const yearParam = sp.get("year");

  const [data, setData] = useState<PrematchResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const playerAId = Number.parseInt(playerAIdParam ?? "", 10);
      const playerBId = Number.parseInt(playerBIdParam ?? "", 10);
      const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();

      if (!tourneyIdParam || Number.isNaN(playerAId) || Number.isNaN(playerBId) || Number.isNaN(year)) {
        setError(
          "Faltan parámetros válidos en la URL (playerA_id, playerB_id, tourney_id o year)."
        );
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/prematch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerA_id: playerAId,
            playerB_id: playerBId,
            tourney_id: tourneyIdParam,
            year,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Error ${res.status}: ${text}`);
        }

        const j: PrematchResp = await res.json();
        setData(j);
      } catch (err) {
        setError((err as Error).message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [playerAIdParam, playerBIdParam, tourneyIdParam, yearParam]);

  const probability = data?.prob_player ?? null;
  const percent = probability !== null ? Math.round(Math.max(0, Math.min(1, probability)) * 100) : null;
  const percentOpponent = percent !== null ? 100 - percent : null;

  return (
    <div className="min-h-screen bg-slate-950/40 p-6 text-slate-100 md:p-10">
      <h1 className="mb-8 text-3xl font-semibold">
        Prematch: {playerA} vs {playerB}
      </h1>

      {loading && <div className="mb-6 text-sm text-slate-400">Cargando…</div>}
      {error && <div className="mb-6 text-sm text-red-400">{error}</div>}

      {data && (
        <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg xl:grid xl:grid-cols-[minmax(0,360px),1fr] xl:gap-10 xl:space-y-0">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-center xl:flex-col">
            <WinProbabilityOrb
              label={playerA}
              value={probability}
              description="Si la barra se enciende en rojos intensos, el modelo ve a este jugador casi imparable."
            />
            <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-slate-700/60 to-transparent lg:block xl:hidden" />
            <WinProbabilityOrb
              label={playerB}
              value={probability !== null ? 1 - probability : null}
              description="Cuando domina el hielo, la lectura es que este jugador llega con el partido cuesta arriba."
            />
          </div>

          <div className="space-y-5">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-100">Resumen</h2>
              <p className="text-sm text-slate-300">
                Nuestro modelo otorga a <strong>{playerA}</strong> una probabilidad de victoria del
                {" "}
                <strong>{percent !== null ? `${percent}%` : "—"}</strong>, dejando para <strong>{playerB}</strong>
                {" "}
                el restante <strong>{percentOpponent !== null ? `${percentOpponent}%` : "—"}</strong>.
              </p>
              <p className="text-xs text-slate-400">
                Las esferas combinan brillo y textura para representar el clima del partido: cuando un lado
                se cubre de rojos y destellos, el favorito está &ldquo;en llamas&rdquo;; si domina el azul glaciar, el
                panorama luce mucho más helado.
              </p>
            </section>

            {data.tournament && (
              <section className="space-y-2 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Torneo
                </h3>
                <ul className="text-sm text-slate-200">
                  {data.tournament.name && <li>Nombre: {data.tournament.name}</li>}
                  {data.tournament.surface && <li>Superficie: {data.tournament.surface}</li>}
                  {data.tournament.bucket && <li>Categoria: {data.tournament.bucket}</li>}
                  {typeof data.tournament.month === "number" && (
                    <li>Mes: {data.tournament.month}</li>
                  )}
                </ul>
              </section>
            )}

            {data.extras && (
              <section className="space-y-2 rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Datos adicionales
                </h3>
                <dl className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
                  {data.extras.display_p && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Nombre P</dt>
                      <dd>{data.extras.display_p}</dd>
                    </div>
                  )}
                  {data.extras.display_o && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Nombre O</dt>
                      <dd>{data.extras.display_o}</dd>
                    </div>
                  )}
                  {data.extras.rank_p !== null && data.extras.rank_p !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Rank P</dt>
                      <dd>{data.extras.rank_p}</dd>
                    </div>
                  )}
                  {data.extras.rank_o !== null && data.extras.rank_o !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">Rank O</dt>
                      <dd>{data.extras.rank_o}</dd>
                    </div>
                  )}
                  {data.extras.ytd_wr_p !== null && data.extras.ytd_wr_p !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">WR P</dt>
                      <dd>{Math.round(data.extras.ytd_wr_p * 100)}%</dd>
                    </div>
                  )}
                  {data.extras.ytd_wr_o !== null && data.extras.ytd_wr_o !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">WR O</dt>
                      <dd>{Math.round(data.extras.ytd_wr_o * 100)}%</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </div>
        </div>
      )}

      {data && (
        <details className="mt-6 text-xs text-slate-400">
          <summary className="cursor-pointer text-slate-300">Ver datos crudos</summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-slate-950/60 p-4 text-[11px] text-slate-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}

      <Button asChild variant="secondary" className="mt-8">
        <Link href="/">← Volver al bracket</Link>
      </Button>
    </div>
  );
}
