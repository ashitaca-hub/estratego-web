"use client";
import React, { Suspense } from "react";
import PrematchInner from "./prematch-inner";

export const dynamic = "force-dynamic"; // asegura que no intente static export

export default function PrematchPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Cargando prematch…</div>}>
      <PrematchInner />
    </Suspense>
  );
}
