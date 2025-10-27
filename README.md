# Estratego WebApp

Aplicacion para el analisis prematch y la simulacion de brackets de torneos ATP/WTA.
El frontend utiliza Next.js 14 con TailwindCSS y se apoya en funciones SQL desplegadas en Supabase.

---

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Proyecto Supabase con las tablas y funciones del directorio `sql/`
- Variables de entorno del frontend:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `ODDS_API_KEY` *(opcional, activa la consulta de cuotas de The Odds API)*
  - `ODDS_CACHE_TTL_MINUTES` *(opcional, minutos que mantiene la cache; por defecto 180)*
  - `ODDS_CACHE_DISABLED` *(opcional, establece `true` para saltar la cache)*

---

## Puesta en marcha (local)

```bash
cd frontend
npm install
npm run dev
```

Disponible en http://localhost:3000.

---

## Funcionalidades principales

### Analisis Prematch Extendido

- Endpoint `POST /api/prematch`.
- Invoca `public.get_extended_prematch_summary` y devuelve, para cada jugador:
  - % de victorias por ano, superficie y mes.
  - % de victorias frente a TOP10.
  - Score de adaptacion a la pista (court speed).
  - Ranking mas reciente + score normalizado (transformacion exponencial).
  - Dias desde el ultimo partido; genera alertas por exceso o falta de ritmo.
  - Head to head y ultimo enfrentamiento.
  - Ronda defendida respecto al ano anterior.
  - Nuevos scores: `ranking_score`, `h2h_score`, `motivation_score`.
  - Alertas textuales (falta de ritmo, exceso de partidos, retiro).
  - Ventaja de localia comparando `players.ioc` con `tournaments.country`.
  - Cuotas h2h (The Odds API): muestra la cuota decimal (Pinnacle por defecto), resalta cuando el modelo detecta valor y cachea la respuesta para ahorrar llamadas.
- Los pesos de cada metrica se mantienen en `estratego_v1.prematch_metric_weights`.

### Simulacion de Torneos

- `POST /api/simulate`: ejecuta `public.simulate_full_tournament`, tomando la probabilidad prematch para cada partido.
- `POST /api/simulate/multiple`: lanza la simulacion N veces y persiste resultados en `public.simulation_results`.
- `POST /api/reset`: reconstruye el cuadro (`draw_matches`) con la informacion original.
- `GET /api/tournament/[tourney_id]`: expone el draw actual para renderizarlo en la UI.

### Analytics de simulaciones

- Pagina `/simulation/[tourneyId]/analytics`: muestra apariciones por ronda, top semifinalistas/finalistas y destaca jugadores con home advantage.

---

## Supabase: tablas clave

- `estratego_v1.matches_full`: historial de partidos.
- `estratego_v1.players`: informacion de jugadores (`player_id`, `ioc`, etc.).
- `estratego_v1.rankings_snapshot_v2`: ranking y puntos asociados a cada match.
- `estratego_v1.h2h`: head-to-head normalizado.
- `estratego_v1.tournaments`: metadatos (fecha, superficie, pais anfitrion).
- `estratego_v1.court_speed_ranking_norm`: ranking de velocidad de pista.
- `estratego_v1.prematch_metric_weights`: pesos configurables para el analisis prematch.
- `public.draw_matches` / `public.draw_entries`: infraestructura del cuadro principal.
- `public.simulation_results`: resultados acumulados de simulaciones.
- `public.odds_cache`: almacenamiento de cuotas (se crea con `sql/create_odds_cache.sql`).

---

## Funciones disponibles en `sql/`

| Script | Descripcion |
|--------|-------------|
| `get_extended_prematch_summary.sql` | Calcula metricas, scores y alertas de dos jugadores (usa `rankings_snapshot_v2`, evalua localia, genera alertas). |
| `build_draw_matches.sql` | Reconstruye la primera ronda en `draw_matches` apoyandose en `draw_entries` y `tournaments_info.draw_size`. |
| `create_odds_cache.sql` | Define la tabla `odds_cache`, indices y politicas basicas para cachear cuotas y reducir llamadas a The Odds API. |
| `simulate_full_tournament.sql` | Simula un torneo completo promoviendo ganadores segun la probabilidad estimada. |
| `simulate_multiple_runs.sql` | Ejecuta la simulacion completa N veces y persiste los resultados en `simulation_results`. |

> Ejecuta los scripts completos en Supabase (`CREATE OR REPLACE FUNCTION ...`).  
> Tras cada cambio en alguno de estos archivos, vuelve a lanzarlos para mantener la logica sincronizada.

---

## Workflows (GitHub Actions)

- Carga de cuadros (PDF -> CSV -> Supabase).
- Normalizacion e insercion de jugadores (`draw_entries`).
- Ejecucion de `build_draw_matches`.
- Build y tests automaticos del frontend.

---

## Notas tecnicas

- Muchos campos de fechas se almacenan como `INT` (formato `YYYYMMDD`). Usa `TO_DATE`/`EXTRACT` segun corresponda.
- `draw_matches` debe mantener el orden logico (`R32-1` ... `R32-16`).
- Asegurate de que `tournaments_info.draw_size` refleja 16/32/64 antes de ejecutar `build_draw_matches`; de lo contrario solo generara la primera ronda disponible.
- Las cuotas consultadas se cachean en `public.odds_cache` (TTL configurable con `ODDS_CACHE_TTL_MINUTES` o desactivable via `ODDS_CACHE_DISABLED`).

### Ajuste de pesos (ejemplo)

```sql
INSERT INTO estratego_v1.prematch_metric_weights (metric, weight)
VALUES
  ('ranking_score',     0.30),
  ('h2h_score',         0.10),
  ('motivation_score',  0.05),
  ('rest_score',        0.00) -- rest_score solo actua como alerta visual
ON CONFLICT (metric)
DO UPDATE SET weight = EXCLUDED.weight;
```

### Asignacion de paises

```sql
ALTER TABLE estratego_v1.tournaments ADD COLUMN IF NOT EXISTS country CHAR(3);

UPDATE estratego_v1.tournaments
SET country = 'SUI'
WHERE tourney_id IN ('2024-0328','2025-0328');
```

> `country` debe usar el mismo IOC que `estratego_v1.players.ioc` para que la localia funcione.

---

## Documentacion complementaria

- `sql/get_extended_prematch_summary.sql`: logica del analisis prematch y generacion de alertas.
- `sql/create_odds_cache.sql`: tabla e indices necesarios para cachear cuotas de The Odds API.
- `frontend/app/api/prematch/route.ts`: formatea la respuesta, anade metadatos del torneo y gestiona cache/APIs externas.
- `frontend/app/simulation/[tourneyId]/analytics/page.tsx`: obtencion y visualizacion del dashboard de resultados acumulados.

---

Ultima actualizacion: **octubre 2025**
