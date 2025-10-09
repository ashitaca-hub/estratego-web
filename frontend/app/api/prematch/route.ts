// app/api/prematch/route.ts
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    console.error("❌ Prematch: error leyendo JSON payload", err);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
  }

  const base = process.env.API_BASE_URL;
  if (!base) {
    console.error("❌ Prematch: API_BASE_URL no configurado");
    return new Response(JSON.stringify({ error: 'API_BASE_URL no configurado' }), { status: 500 });
  }

  console.log("🔁 Prematch: enviando payload = ", payload);

  let res;
  try {
    res = await fetch(`${base}/matchup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("❌ Prematch: error de red al llamar backend", err);
    return new Response(JSON.stringify({ error: "Error de red al backend" }), { status: 502 });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ Prematch: backend retornó status ${res.status}`, text);
    return new Response(JSON.stringify({ error: `Backend status ${res.status}`, detail: text }), {
      status: 502,
    });
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error("❌ Prematch: respuesta no es JSON", text);
    return new Response(JSON.stringify({ error: "Respuesta inválida del backend" }), { status: 502 });
  }

  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}
