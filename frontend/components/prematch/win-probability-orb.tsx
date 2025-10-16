"use client";

import React, { useMemo } from "react";

export type WinProbabilityOrbProps = {
  label: string;
  value: number | null | undefined;
  description?: string;
};

export function normalizeProbabilityValue(
  probability: number | null | undefined,
): number | null {
  if (probability === null || probability === undefined || Number.isNaN(probability)) {
    return null;
  }

  const finite = Number(probability);
  if (!Number.isFinite(finite)) return null;

  const ratio = finite > 1 ? finite / 100 : finite;
  if (Number.isNaN(ratio)) return null;

  if (ratio < 0) return 0;
  if (ratio > 1) return 1;

  return ratio;
}

export function WinProbabilityOrb({ label, value, description }: WinProbabilityOrbProps) {
  const { clamped, percent, displayPercent, hasValue } = useMemo(() => {
    const normalized = normalizeProbabilityValue(value);
    if (normalized === null) {
      return { clamped: 0, percent: 0, displayPercent: "—", hasValue: false } as const;
    }

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
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-slate-400">Win %</span>
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
        {description ? (
          <p className="text-xs text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function getWinProbabilitySummary(probability: number | null | undefined) {
  const normalized = normalizeProbabilityValue(probability);
  if (normalized === null) {
    return {
      percent: null,
      percentOpponent: null,
    } as const;
  }
  const percent = Math.round(normalized * 100);
  return {
    percent,
    percentOpponent: 100 - percent,
  } as const;
}

