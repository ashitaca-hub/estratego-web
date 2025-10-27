# Estratego WebApp

AplicaciÃƒÂ³n para el anÃƒÂ¡lisis **prematch** y la simulaciÃƒÂ³n de brackets de torneos ATP/WTA.  
El frontend estÃƒÂ¡ construido en **Next.js 14** y consume funciones SQL alojadas en **Supabase (PostgreSQL)**.  
El repositorio incluye los scripts SQL necesarios y los workflows de automatizaciÃƒÂ³n (GitHub Actions).

---

## Arquitectura del proyecto

```
estratego-web/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ frontend/                # Next.js 14 + TailwindCSS + shadcn/ui
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ sql/                     # Scripts y funciones SQL para Supabase
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ .github/                 # Workflows CI/CD (carga de cuadros, builds, tests)
```

---

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Proyecto Supabase con las tablas y funciones descritas en `sql/`
- Variables de entorno del frontend:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `ODDS_API_KEY` *(opcional, activa la consulta de cuotas de The Odds API)*
  - `ODDS_CACHE_TTL_MINUTES` *(opcional, minutos que mantiene la caché; por defecto 180)*
  - `ODDS_CACHE_DISABLED` *(opcional, establece `true` para saltar la caché)*

---

## Puesta en marcha (local)

```bash
cd frontend
npm install
npm run dev
```

La aplicaciÃƒÂ³n queda disponible en [http://localhost:3000](http://localhost:3000).

---

## Funcionalidades principales

### AnÃƒÂ¡lisis Prematch Extendido

- Endpoint `POST /api/prematch`.
- Invoca `public.get_extended_prematch_summary` y devuelve, para cada jugador:
  - % de victorias en el aÃƒÂ±o / superficie / mes actual.
  - % de victorias frente a TOP10.
  - Score de adaptaciÃƒÂ³n a la pista (court speed).
  - Ranking mÃƒÂ¡s reciente + score normalizado (transformaciÃƒÂ³n exponencial).
  - DÃƒÂ­as desde el ÃƒÂºltimo partido; se generan alertas si hay exceso o falta de ritmo.
  - Head to head y ÃƒÂºltimo enfrentamiento.
  - Ronda defendida respecto al aÃƒÂ±o anterior.
  - **Nuevos scores**: `ranking_score`, `h2h_score`, `motivation_score`.
  - **Alertas** (mensajes):
    - Falta de ritmo (Ã¢â€°Â¥ 20 dÃƒÂ­as sin competir).
    - Carga de partidos (>6 partidos en 15 dÃƒÂ­as).
    - Retiro en el ÃƒÂºltimo partido.
  - Ventaja de localÃƒÂ­a: se compara el `ioc` del jugador con el paÃƒÂ­s del torneo (`estratego_v1.tournaments.country`).
  - Cuotas h2h (The Odds API): muestra la cuota decimal (Pinnacle por defecto) y resalta cuando el modelo detecta valor frente al precio ofrecido.

> Los pesos de cada mÃƒÂ©trica se mantienen en `estratego_v1.prematch_metric_weights`.  
> Puedes ajustarlos o actualizarlos con los INSERT/UPDATE indicados en la secciÃƒÂ³n de **Notas tÃƒÂ©cnicas**.

### SimulaciÃƒÂ³n de Torneos

- `POST /api/simulate`: ejecuta `public.simulate_full_tournament`, tomando la probabilidad prematch para cada partido y promoviendo ganadores hasta la final.
- `POST /api/simulate/multiple`: lanza la simulaciÃƒÂ³n N veces, registra resultados en `public.simulation_results` y borra las tablas temporales despuÃƒÂ©s de cada iteraciÃƒÂ³n. Usa batching para evitar `statement_timeout`.
- `POST /api/reset`: devuelve el cuadro (`draw_matches`) al estado original.
- `GET /api/tournament/[tourney_id]`: proporciona el draw actual para renderizarlo en la UI.

### Analytics de simulaciones

- PÃƒÂ¡gina `/simulation/[tourneyId]/analytics`:
  - Tabla resumida con apariciones por ronda de cada jugador (conteo y porcentaje).
  - Tarjeta Ã¢â‚¬Å“Top finalistas y semifinalistasÃ¢â‚¬Â (top 4 jugadores).
  - Enriquecida con nombres, banderas y marcadores locales (home advantage).

---

## Supabase: tablas y funciones

### Tablas clave

- `estratego_v1.matches_full`: historial de partidos.
- `estratego_v1.players`: informaciÃƒÂ³n de jugadores (`player_id`, `ioc`, etc.).
- `estratego_v1.rankings_snapshot_v2`: ranking y puntos asociados a cada match (reemplaza la tabla legacy).
- `estratego_v1.h2h`: head-to-head normalizado.
- `estratego_v1.tournaments`: metadatos de torneos (fecha, superficie, paÃƒÂ­s anfitriÃƒÂ³n).
- `estratego_v1.court_speed_ranking_norm`: ranking de velocidad de pista.
- `estratego_v1.prematch_metric_weights`: pesos configurables para el anÃƒÂ¡lisis prematch.
- `public.draw_matches` / `public.draw_entries`: infraestructura del cuadro principal.
- `public.simulation_results`: resultados acumulados por corrida (tourney_id, run_number, player_id, reached_round).

### Funciones disponibles en `sql/`

| Script | DescripciÃƒÂ³n |
|--------|-------------|
| `get_extended_prematch_summary.sql` | Calcula mÃ©tricas, scores y alertas de dos jugadores en un torneo dado (extrae ranking de `rankings_snapshot_v2`, evalÃºa localÃ­a, etc.). |
| `build_draw_matches.sql` | Reconstruye los cruces iniciales (`draw_matches`) a partir de `draw_entries`, tomando el `draw_size` de `tournaments_info`. |
| `create_odds_cache.sql` | Crea la tabla `odds_cache` y polÃ­ticas bÃ¡sicas para cachear cuotas y reducir llamadas a The Odds API. |
| `simulate_full_tournament.sql` | Restaura draw inicial, ejecuta partidos segÃºn probabilidad y promueve ganadores hasta la final. |
| `simulate_multiple_runs.sql` | Ejecuta la simulaciÃ³n completa N veces, limpia tablas temporales y registra resultados en `simulation_results`. |
> Ejecuta los scripts ÃƒÂ­ntegramente en Supabase (`CREATE OR REPLACE FUNCTION ...`).  
> Tras cada pull que modifique estos archivos, vuelve a lanzarlos para mantener la lÃƒÂ³gica sincronizada.

---

## Workflows (GitHub Actions)

- Carga de cuadros (PDF Ã¢â€ â€™ CSV Ã¢â€ â€™ Supabase).
- NormalizaciÃƒÂ³n e inserciÃƒÂ³n de jugadores (`draw_entries`).
- EjecuciÃƒÂ³n de `build_draw_matches`.
- Build y tests automÃƒÂ¡ticos del frontend.

---

## Notas tecnicas

- Muchos campos de fechas se almacenan como `INT` (formato `YYYYMMDD`). Usa `TO_DATE`/`EXTRACT` segun corresponda.
- `draw_matches` debe mantener el orden logico (`R32-1` ... `R32-16`).
- Asegurate de que `tournaments_info.draw_size` refleja 16/32/64 antes de ejecutar `build_draw_matches`; de lo contrario solo generara la primera ronda disponible.
- Las cuotas consultadas se cachean en `public.odds_cache` (TTL configurable con `ODDS_CACHE_TTL_MINUTES`).

### Ajuste de pesos (ejemplo)

```sql
INSERT INTO estratego_v1.prematch_metric_weights (metric, weight)
VALUES
  ('ranking_score',     0.30),
  ('h2h_score',         0.10),
  ('motivation_score',  0.05),
  ('rest_score',        0.00) -- rest_score solo actÃƒÂºa como alerta visual
ON CONFLICT (metric)
DO UPDATE SET weight = EXCLUDED.weight;
```

### AsignaciÃƒÂ³n de paÃƒÂ­ses

```
ALTER TABLE estratego_v1.tournaments ADD COLUMN IF NOT EXISTS country CHAR(3);

UPDATE estratego_v1.tournaments
SET country = 'SUI' -- (ejemplo: Basel)
WHERE tourney_id IN ('2024-0328','2025-0328');
```

> `country` debe usar el mismo IOC que `estratego_v1.players.ioc` para que la localÃƒÂ­a funcione.

---

## DocumentaciÃƒÂ³n complementaria

- `sql/get_extended_prematch_summary.sql`: lÃƒÂ³gica detallada del anÃƒÂ¡lisis prematch y generaciÃƒÂ³n de alertas.
- `frontend/app/api/prematch/route.ts`: formatea la respuesta, aÃƒÂ±ade metadatos del torneo y exporta a `/api/prematch`.
- `frontend/app/simulation/[tourneyId]/analytics/page.tsx`: obtenciÃƒÂ³n y visualizaciÃƒÂ³n del dashboard de resultados acumulados.

---

Ultima actualizacion: **octubre 2025**
