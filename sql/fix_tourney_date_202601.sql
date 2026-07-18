-- Corrige tourney_date corrupto (placeholder "202601" = año+mes sin dia,
-- en vez de la fecha real YYYYMMDD) para los 3 torneos de la semana del 13
-- de julio de 2026 que llegaban con esa fecha basura. Confirmado con el
-- cuadro oficial: EFG Swiss Open Gstaad, 13-19 julio 2026. Umag y Bastad
-- comparten semana en el calendario ATP.
UPDATE public.tournaments SET tourney_date = 20260713 WHERE tourney_id = '2026-314'; -- Gstaad
UPDATE public.tournaments SET tourney_date = 20260713 WHERE tourney_id = '2026-316'; -- Bastad
UPDATE public.tournaments SET tourney_date = 20260713 WHERE tourney_id = '2026-439'; -- Umag

-- Nota: existe tambien 2016-439 (Umag) con el mismo patron de dato
-- corrupto (201601). No se toca aqui por no tener confirmada la fecha real
-- de esa edicion y no afectar al "en juego ahora" (es historico).
