# 🎾 Estratego WebApp

Aplicación para análisis **Prematch** y simulación de **brackets de torneos de tenis**, conectada a Supabase (PostgreSQL) y automatizada con GitHub Actions.

---

## 📁 Estructura del proyecto

```
estratego-web/
├── frontend/         → Next.js 14 (TailwindCSS + shadcn/ui)
├── sql/              → Scripts y funciones SQL para Supabase
├── .github/          → Workflows CI/CD (carga cuadros, pruebas)
```

---

## 🚀 Cómo levantar localmente

### 🔧 Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Acceder en: [http://localhost:3000](http://localhost:3000)

---

## 🧠 Funcionalidades

### 🔎 Análisis Prematch

* Comparativa entre 2 jugadores previa al partido.
* Llamada a función SQL: `get_extended_prematch_summary(...)`
* Variables por jugador:

  * % victorias en el año
  * % victorias en superficie
  * % victorias en mismo mes
  * % victorias vs rivales del Top 10
  * Score de adaptación a pista
  * Ranking más reciente
  * Días desde último partido
  * Ventaja de localía
  * Score final ponderado
  * Probabilidad estimada de victoria
* Historial H2H incluido.

> Los pesos de cada métrica se ajustan en la tabla `estratego_v1.prematch_metric_weights`

### 🧬 Simulación de Torneo

* Construcción automática del draw (`build_draw_matches`)
* Simulación completa (`simulate_full_tournament`)
* Requiere `draw_entries` correctamente cargado (desde CSV)
* Cuadro visualizado por rondas en la home (R32, R16, QF, SF, Final)

---

## 🔗 Supabase: Esquema y funciones

**Tablas y vistas:**

* `estratego_v1.matches_full` → Historial de partidos
* `estratego_v1.players` → Info de jugadores (con país `ioc`)
* `estratego_v1.rankings_snapshot` → Rankings por torneo
* `estratego_v1.h2h` → Historial entre jugadores
* `estratego_v1.tournaments` → Info de torneos
* `estratego_v1.court_speed_ranking_norm` → Ranking de velocidad por torneo
* `estratego_v1.prematch_metric_weights` → Pesos para métricas prematch
* `public.draw_matches`, `draw_entries`, `players_min` → Infraestructura de cuadros

**Funciones:**

* `build_draw_matches(tourney_id)`
* `simulate_full_tournament(p_tourney_id)`
* `get_extended_prematch_summary(tourney_id, year, player_a_id, player_b_id)`

---

## ⚙️ Workflows (GitHub Actions)

* Automatización de carga de cuadros desde PDF (parseo → CSV → Supabase)
* Resolución de nombres → `players_dim`
* Inserción en `draw_entries`
* Ejecución automática de `build_draw_matches`

---

## 📦 Notas técnicas

* `tourney_date` puede ser tipo `int` o `date` según tabla.
* El campo `match_id` ya no se usa en lógica de ordenamiento; usamos `tourney_id`.
* `draw_matches` debe mantener el orden lógico (R32-1 … R32-16).
* El frontend trabaja con `players_min` para eficiencia.

---

## 📄 Documentación adicional

Ver [`sql/README-prematch-extended.md`](../sql/README-prematch-extended.md) para detalles completos de la función `get_extended_prematch_summary()`.

---

Última actualización: Octubre 2025
