# Estratego WebApp

Aplicación para análisis **prematch** y simulación de brackets de torneos ATP/WTA. El frontend está construido en Next.js 14 y consume funciones SQL alojadas en Supabase (PostgreSQL). El repositorio incluye los scripts SQL necesarios y los workflows que automatizan la carga y simulación de torneos.

---

## Arquitectura del proyecto

```
estratego-web/
├── frontend/                # Next.js 14 + TailwindCSS + shadcn/ui
├── sql/                     # Scripts y funciones SQL para Supabase
└── .github/                 # GitHub Actions (carga de cuadros, pruebas, despliegues)
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

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## Funcionalidades principales

### Análisis Prematch Extendido

La ruta `POST /api/prematch` llama a la función SQL `public.get_extended_prematch_summary`. Para cada jugador devuelve:

- % de victorias en el año y en la superficie del torneo
- % de victorias en el mismo mes y vs. top10
- Score de adaptación a la pista (basado en court speed)
- Ranking más reciente
- Días desde el último partido (con alertas por exceso o falta de ritmo)
- Ventaja de localía (mismo país)
- Ronda defendida en la edición anterior
- **Scores normalizados añadidos recientemente:**
  - `ranking_score`
  - `h2h_score`
  - `rest_score`
  - `motivation_score` (defender puntos / localía)
- Probabilidad ponderada de victoria (`win_probability`)
- Lista de `alerts` generadas en base al descanso y a la defensa de puntos

> Los pesos de cada métrica se almacenan en `estratego_v1.prematch_metric_weights`. Las filas para `ranking_score`, `h2h_score`, `rest_score` y `motivation_score` deben existir (el script añade valores por defecto si faltan).

### Simulación de Torneos

- `POST /api/simulate`: ejecuta `public.simulate_full_tournament`, que toma la probabilidad prematch y promueve ganadores hasta la final.
- `POST /api/simulate/multiple`: permite lanzar la simulación N veces. Cada lote se registra en la tabla `public.simulation_results`.
- Endpoints auxiliares:
  - `POST /api/reset`: limpia un cuadro (devuelve `draw_matches` al estado original).
  - `GET /api/tournament/[tourney_id]`: entrega el cuadro actual para renderizar el bracket.

### Analytics de simulaciones

- Página `simulation/[tourneyId]/analytics` con el agregado de `simulation_results`:
  - Conteo y porcentaje de apariciones en cada ronda por jugador.
  - Tarjeta “Top finalistas y semifinalistas” con los cuatro jugadores más frecuentes.
  - Tabla enriquecida con nombre, bandera (cuando está disponible) y totales.

---

## Supabase: tablas y funciones

### Tablas clave

- `estratego_v1.matches_full` – Historial de partidos ATP/WTA.
- `estratego_v1.players` – Información base de jugadores (incluye `ioc`).
- `estratego_v1.rankings_snapshot` – Ranking por torneo.
- `estratego_v1.h2h` – Head-to-head normalizado.
- `estratego_v1.tournaments` – Metadatos del torneo (fecha, superficie).
- `estratego_v1.court_speed_ranking_norm` – Ranking de velocidad de pista.
- `estratego_v1.prematch_metric_weights` – Pesos para las métricas del análisis prematch.
- `public.draw_matches` / `public.draw_entries` – Infraestructura del cuadro principal.
- `public.simulation_results` – Resultados agregados por simulación (tourney_id, run_number, player_id, reached_round).

### Funciones disponibles en `sql/`

| Archivo | Descripción |
|---------|-------------|
| `simulate_full_tournament.sql` | Restaura el cuadro inicial, simula ronda a ronda usando las probabilidades prematch y registra ganadores. |
| `simulate_multiple_runs.sql` | Ejecuta `simulate_full_tournament` en bucle, limpia tablas temporales y registra cada run en `simulation_results`. Admite `p_reset` para reiniciar resultados. |
| `get_extended_prematch_summary.sql` | Calcula las métricas y probabilidades extendidas para dos jugadores. Devuelve JSON con scores, alertas y motivaciones. |

> Ejecuta estos scripts directamente en el editor SQL de Supabase (`CREATE OR REPLACE FUNCTION …`). Tras cada actualización del repositorio, vuelve a correrlos para mantener la lógica sincronizada.

---

## Workflows (GitHub Actions)

- Procesamiento de cuadros desde PDF ➜ CSV ➜ Supabase.
- Normalización e inserción de jugadores en `draw_entries`.
- Disparadores para `build_draw_matches` y pruebas automáticas.

---

## Notas técnicas

- `tourney_date` puede almacenarse como `INT` (formato YYYYMMDD) o `DATE`. Ajusta las conversiones según tu dataset.
- `draw_matches` debe conservar el orden lógico (`R32-1` … `R32-16`, `R16-1` …).
- El frontend opera contra `players_min` para obtener los nombres visibles en el bracket; asegúrate de mantener esa tabla sincronizada.
- Tras ejecutar simulaciones masivas, puedes reconstruir el cuadro original invocando `build_draw_matches`.

### Ajuste de pesos

```
INSERT INTO estratego_v1.prematch_metric_weights (metric, weight)
VALUES
  ('ranking_score',     0.12),
  ('h2h_score',         0.08),
  ('rest_score',        0.05),
  ('motivation_score',  0.05)
ON CONFLICT (metric)
DO UPDATE SET weight = EXCLUDED.weight;
```

- Ajusta los valores según tus criterios modelísticos.
- Para ver el estado actual: `SELECT * FROM estratego_v1.prematch_metric_weights ORDER BY metric;`

### Alertas de descanso/motivación

- `alerts` se puebla automáticamente con frases como “Lleva 39 días sin competir; posible falta de ritmo.”
- La motivación (`motivation_score`) combina defensa de puntos y bonus por localía (si decides extenderlo).

---

## Documentación complementaria

- `sql/get_extended_prematch_summary.sql` – lógica detallada del análisis prematch.
- `sql/simulate_multiple_runs.sql` – pipeline de simulación por lotes con topes de tamaño y limpieza de tablas temporales.
- `frontend/app/simulation/[tourneyId]/analytics/page.tsx` – obtención y presentación del dashboard de resultados acumulados.

---

Última actualización: octubre 2025
