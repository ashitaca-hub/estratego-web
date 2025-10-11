"use client";
import React, { useEffect, useState } from "react";
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

  return (
    <div className="min-h-screen p-6 md:p-10">
      <h1 className="text-2xl font-semibold mb-4">
        Prematch: {playerA} vs {playerB}
      </h1>
      {loading && <div>Cargando…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {data && (
        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
      )}
      <Button asChild variant="secondary" className="mt-6">
        <Link href="/">← Volver al bracket</Link>
      </Button>
    </div>
  );
}
