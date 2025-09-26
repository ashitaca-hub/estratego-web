// app/api/prematch/route.ts (proxy a tu backend Flask/Render)
export const dynamic = "force-dynamic";


export async function POST(req: Request) {
const payload = await req.json();
const base = process.env.API_BASE_URL; // p.ej. https://estratego-api.onrender.com
if (!base) return new Response(JSON.stringify({ error: 'API_BASE_URL no configurado' }), { status: 500 });


// Intenta HTML directo; si tu backend devuelve JSON, cambia la URL a /matchup y adapta
const res = await fetch(`${base}/matchup`, {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify(payload),
// Puedes añadir auth headers si tu backend los requiere
});
if (!res.ok) return new Response(JSON.stringify({ error: `Backend ${res.status}` }), { status: 502 });
const data = await res.json();
return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}