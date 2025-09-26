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
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/punycode [external] (punycode, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("punycode", () => require("punycode"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[project]/lib/supabase.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// lib/supabase.ts
__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/module/index.js [app-route] (ecmascript) <locals>");
;
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(("TURBOPACK compile-time value", "https://teqoregcmovuexbohrro.supabase.co"), process.env.SUPABASE_SERVICE_ROLE_KEY || ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcW9yZWdjbW92dWV4Ym9ocnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MzQwMTUsImV4cCI6MjA3MDQxMDAxNX0.skC6f2nM5xrwE6XLzzZEGCW4olb0TPb99HaM9WFbOfo"));
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase.ts [app-route] (ecmascript)");
const dynamic = "force-dynamic";
;
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
    const { tourney_id } = await req.json();
    if (!tourney_id) {
        return new Response(JSON.stringify({
            error: "Missing tourney_id"
        }), {
            status: 400
        });
    }
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].rpc("simulate_next_round", {
        tourney_id
    });
    if (error) {
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500
        });
    }
    return new Response(JSON.stringify({
        ok: true
    }), {
        status: 200
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__70ed5ce0._.js.map