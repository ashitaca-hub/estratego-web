"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// aquí va todo tu código de PrematchPage tal cual lo tenías...
export default function PrematchInner() {
  const sp = useSearchParams();
  const playerA = sp.get("playerA") || "Player A";
  const playerB = sp.get("playerB") || "Player B";
  const tid = sp.get("tid") || "unknown";

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await fetch("/api/prematch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerA, playerB, tournamentId: tid }),
      });
      const j = await res.json();
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
      {data && <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>}
      <Button asChild variant="secondary" className="mt-6">
        <a href="/">← Volver al bracket</a>
      </Button>
    </div>
  );
}
