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
  const tid = sp.get("tid") || "unknown";

  const [data, setData] = useState<PrematchResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await fetch("/api/prematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerA, playerB, tournamentId: tid }),
      });
      const j: PrematchResp = await res.json();
      setData(j);
      setLoading(false);
    };
    run();
  }, [playerA, playerB, tid]);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <h1 className="text-2xl font-semibold mb-4">
        Prematch: {playerA} vs {playerB}
      </h1>
      {loading && <div>Cargando…</div>}
      {data && (
        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
      )}
      <Button asChild variant="secondary" className="mt-6">
        <Link href="/">← Volver al bracket</Link>
      </Button>
    </div>
  );
}
