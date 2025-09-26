module.exports = [
"[project]/.next-internal/server/app/api/simulate/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/api/simulate/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// app/api/simulate/route.ts
__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic
]);
const dynamic = "force-dynamic";
function nextRound(r) {
    return r === 'R16' ? 'QF' : r === 'QF' ? 'SF' : r === 'SF' ? 'F' : 'F';
}
function simulate(bracket) {
    const rnd = (n)=>Math.floor(Math.random() * n);
    const copy = JSON.parse(JSON.stringify(bracket));
    const rounds = [
        'R16',
        'QF',
        'SF',
        'F'
    ];
    for (const round of rounds){
        const ms = copy.matches.filter((m)=>m.round === round).sort((a, b)=>a.id.localeCompare(b.id));
        for (const m of ms){
            const favBias = (m.top.seed ?? 99) < (m.bottom.seed ?? 99) ? 58 : 42;
            const coin = rnd(100);
            const win = coin < favBias ? m.top : m.bottom;
            m.winnerId = win.id;
        }
        if (round !== 'F') {
            const winners = ms.map((m)=>m.winnerId === m.top.id ? m.top : m.bottom);
            const next = [];
            for(let i = 0; i < winners.length; i += 2){
                next.push({
                    id: `${nextRound(round)}-${Math.floor(i / 2) + 1}`,
                    round: nextRound(round),
                    top: winners[i],
                    bottom: winners[i + 1]
                });
            }
            copy.matches = copy.matches.filter((m)=>m.round !== nextRound(round)).concat(next);
        }
    }
    return copy;
}
async function POST(req) {
    const body = await req.json();
    const { tournamentId } = body || {};
    if (!tournamentId) return new Response(JSON.stringify({
        error: 'tournamentId requerido'
    }), {
        status: 400
    });
    // 1) Obtener bracket base
    const base = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/tournament/${tournamentId}`).then((r)=>r.json());
    // 2) Simular
    const result = simulate(base);
    return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
            'content-type': 'application/json'
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3b14cbfe._.js.map