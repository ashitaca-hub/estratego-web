# Estratego WebApp

Aplicación para el análisis **prematch** y la simulación de brackets de torneos ATP/WTA.  
El frontend está construido en **Next.js 14** y consume funciones SQL alojadas en **Supabase (PostgreSQL)**.  
El repositorio incluye los scripts SQL necesarios y los workflows de automatización (GitHub Actions).

---

## Arquitectura del proyecto

```
estratego-web/
├── frontend/                # Next.js 14 + TailwindCSS + shadcn/ui
├── sql/                     # Scripts y funciones SQL para Supabase
└── .github/                 # Workflows CI/CD (carga de cuadros, builds, tests)
```

---

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Proyecto Supabase con las tablas y funciones descritas en `sql/`
- Variables de entorno del frontend:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Puesta en marcha (local)

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en [http://localhost:3000](http://localhost:3000).

---

## Funcionalidades principales

### Análisis Prematch Extendido

- Endpoint `POST /api/prematch`.
- Invoca `public.get_extended_prematch_summary` y devuelve, para cada jugador:
  - % de victorias en el año / superficie / mes actual.
  - % de victorias frente a TOP10.
  - Score de adaptación a la pista (court speed).
  - Ranking más reciente + score normalizado (transformación exponencial).
  - Días desde el último partido; se generan alertas si hay exceso o falta de ritmo.
  - Head to head y último enfrentamiento.
  - Ronda defendida respecto al año anterior.
  - **Nuevos scores**: `ranking_score`, `h2h_score`, `motivation_score`.
  - **Alertas** (mensajes):
    - Falta de ritmo (≥ 20 días sin competir).
    - Carga de partidos (>6 partidos en 15 días).
    - Retiro en el último partido.
  - Ventaja de localía: se compara el `ioc` del jugador con el país del torneo (`estratego_v1.tournaments.country`).

> Los pesos de cada métrica se mantienen en `estratego_v1.prematch_metric_weights`.  
> Puedes ajustarlos o actualizarlos con los INSERT/UPDATE indicados en la sección de **Notas técnicas**.

### Simulación de Torneos

- `POST /api/simulate`: ejecuta `public.simulate_full_tournament`, tomando la probabilidad prematch para cada partido y promoviendo ganadores hasta la final.
- `POST /api/simulate/multiple`: lanza la simulación N veces, registra resultados en `public.simulation_results` y borra las tablas temporales después de cada iteración. Usa batching para evitar `statement_timeout`.
- `POST /api/reset`: devuelve el cuadro (`draw_matches`) al estado original.
- `GET /api/tournament/[tourney_id]`: proporciona el draw actual para renderizarlo en la UI.

### Analytics de simulaciones

- Página `/simulation/[tourneyId]/analytics`:
  - Tabla resumida con apariciones por ronda de cada jugador (conteo y porcentaje).
  - Tarjeta “Top finalistas y semifinalistas” (top 4 jugadores).
  - Enriquecida con nombres, banderas y marcadores locales (home advantage).

---

## Supabase: tablas y funciones

### Tablas clave

- `estratego_v1.matches_full`: historial de partidos.
- `estratego_v1.players`: información de jugadores (`player_id`, `ioc`, etc.).
- `estratego_v1.rankings_snapshot_v2`: ranking y puntos asociados a cada match (reemplaza la tabla legacy).
- `estratego_v1.h2h`: head-to-head normalizado.
- `estratego_v1.tournaments`: metadatos de torneos (fecha, superficie, país anfitrión).
- `estratego_v1.court_speed_ranking_norm`: ranking de velocidad de pista.
- `estratego_v1.prematch_metric_weights`: pesos configurables para el análisis prematch.
- `public.draw_matches` / `public.draw_entries`: infraestructura del cuadro principal.
- `public.simulation_results`: resultados acumulados por corrida (tourney_id, run_number, player_id, reached_round).

### Funciones disponibles en `sql/`

| Script | Descripción |
|--------|-------------|
| `get_extended_prematch_summary.sql` | Calcula métricas, scores y alertas de dos jugadores en un torneo dado (extrae ranking de `rankings_snapshot_v2`, evalúa localía, etc.). |
| `simulate_full_tournament.sql` | Restaura draw inicial, ejecuta partidos según probabilidad y promueve ganadores hasta la final. |
| `simulate_multiple_runs.sql` | Ejecuta la simulación completa N veces, limpia tablas temporales y registra resultados en `simulation_results`. |

> Ejecuta los scripts íntegramente en Supabase (`CREATE OR REPLACE FUNCTION ...`).  
> Tras cada pull que modifique estos archivos, vuelve a lanzarlos para mantener la lógica sincronizada.

---

## Workflows (GitHub Actions)

- Carga de cuadros (PDF → CSV → Supabase).
- Normalización e inserción de jugadores (`draw_entries`).
- Ejecución de `build_draw_matches`.
- Build y tests automáticos del frontend.

---

## Notas técnicas

- Muchos campos de fechas se almacenan como `INT` (formato `YYYYMMDD`). Usa `TO_DATE`/`EXTRACT` según corresponda.
- `draw_matches` debe mantener el orden lógico (`R32-1` ... `R32-16`).
- El frontend obtiene nombres desde `players_min`; mantén esa tabla sincronizada para reflejar las últimas altas.
- Después de simulaciones masivas, puedes rearmar el cuadro llamando a `build_draw_matches`.

### Ajuste de pesos (ejemplo)

```sql
INSERT INTO estratego_v1.prematch_metric_weights (metric, weight)
VALUES
  ('ranking_score',     0.30),
  ('h2h_score',         0.10),
  ('motivation_score',  0.05),
  ('rest_score',        0.00) -- rest_score solo actúa como alerta visual
ON CONFLICT (metric)
DO UPDATE SET weight = EXCLUDED.weight;
```

### Asignación de países

```
ALTER TABLE estratego_v1.tournaments ADD COLUMN IF NOT EXISTS country CHAR(3);

UPDATE estratego_v1.tournaments
SET country = 'SUI' -- (ejemplo: Basel)
WHERE tourney_id IN ('2024-0328','2025-0328');
```

> `country` debe usar el mismo IOC que `estratego_v1.players.ioc` para que la localía funcione.

---

## Documentación complementaria

- `sql/get_extended_prematch_summary.sql`: lógica detallada del análisis prematch y generación de alertas.
- `frontend/app/api/prematch/route.ts`: formatea la respuesta, añade metadatos del torneo y exporta a `/api/prematch`.
- `frontend/app/simulation/[tourneyId]/analytics/page.tsx`: obtención y visualización del dashboard de resultados acumulados.

---

Última actualización: **octubre 2025**
