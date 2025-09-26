module.exports = [
"[project]/.next-internal/server/app/api/tournament/[id]/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

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
"[project]/app/api/tournament/[id]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase.ts [app-route] (ecmascript)");
const dynamic = "force-dynamic";
;
async function GET(request, context) {
    const { id } = context.params;
    const { data: hdr, error: e1 } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("tournaments").select("tourney_id,name,surface,draw_size").eq("tourney_id", id).single();
    if (e1 || !hdr) {
        return new Response(JSON.stringify({
            error: e1?.message || "Torneo no encontrado"
        }), {
            status: 404
        });
    }
    // 2. Partidos
    const { data: rows, error: e2 } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("draw_matches").select("id,round,top_id,bot_id,winner_id").eq("tourney_id", id).order("id", {
        ascending: true
    });
    if (e2) {
        return new Response(JSON.stringify({
            error: e2.message
        }), {
            status: 500
        });
    }
    const list = rows ?? [];
    // 3. Recolectar IDs de jugadores únicos
    const ids = Array.from(new Set(list.flatMap((r)=>[
            r.top_id,
            r.bot_id
        ]).filter(Boolean)));
    const { data: plist, error: e3 } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("players_dim").select("player_id,name,country").in("player_id", ids);
    if (e3) {
        return new Response(JSON.stringify({
            error: e3.message
        }), {
            status: 500
        });
    }
    const pmap = new Map();
    (plist ?? []).forEach((p)=>pmap.set(p.player_id, p));
    // 4. Armar lista de partidos
    const matches = list.map((row)=>{
        const tp = row.top_id ? pmap.get(row.top_id) : null;
        const bp = row.bot_id ? pmap.get(row.bot_id) : null;
        const top = {
            id: row.top_id ?? "TBD",
            name: tp?.name ?? "TBD",
            country: tp?.country ?? undefined
        };
        const bottom = {
            id: row.bot_id ?? "TBD",
            name: bp?.name ?? "TBD",
            country: bp?.country ?? undefined
        };
        return {
            id: row.id,
            round: row.round,
            top,
            bottom,
            winnerId: row.winner_id ?? undefined
        };
    });
    const bracket = {
        tournamentId: hdr.tourney_id,
        event: hdr.name,
        surface: hdr.surface,
        drawSize: hdr.draw_size,
        matches
    };
    return new Response(JSON.stringify(bracket), {
        status: 200,
        headers: {
            "content-type": "application/json"
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0be9ac67._.js.map