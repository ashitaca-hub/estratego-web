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
};

function WinProbabilityOrb({ label, value }: WinProbabilityOrbProps) {
  const clamped = useMemo(() => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }
    return Math.min(1, Math.max(0, value));
  }, [value]);

  const percent = Math.round(clamped * 100);
  const fillDegree = clamped * 360;
  const hue = 210 - 210 * clamped; // 0 => rojo (hot), 210 => azul (cold)
  const fillColor = `hsl(${hue} 85% 56%)`;
  const glowColor = `hsla(${hue} 85% 56% / 0.45)`;
  const temperatureLabel = percent >= 66 ? "🔥 Hot" : percent <= 33 ? "🧊 Cold" : "🌤 Warm";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative flex h-44 w-44 items-center justify-center rounded-full transition-all"
        style={{
          background: `conic-gradient(${fillColor} ${fillDegree}deg, rgba(148, 163, 184, 0.25) ${fillDegree}deg)`,
          boxShadow: `0 0 35px -8px ${glowColor}, inset 0 0 18px -6px ${glowColor}`,
        }}
        aria-label={`${label}: ${percent}%`}
        role="img"
      >
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-slate-950/70 backdrop-blur">
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400">{label}</span>
          <span className="text-3xl font-semibold text-slate-100">{percent}%</span>
          <span className="text-sm font-semibold" style={{ color: fillColor }}>
            {temperatureLabel}
          </span>
        </div>
      </div>
      <p className="max-w-[12rem] text-center text-xs text-slate-500">
        Cuanto más alto el porcentaje, más intenso brilla la esfera.
      </p>
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
        <div className="grid gap-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg md:grid-cols-[auto,1fr]">
          <WinProbabilityOrb label={`Victoria ${playerA}`} value={probability} />

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
                Los tonos cálidos indican una confianza mayor en el triunfo de {playerA}, mientras que los
                tonos fríos sugieren un escenario más favorable para {playerB}.
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
