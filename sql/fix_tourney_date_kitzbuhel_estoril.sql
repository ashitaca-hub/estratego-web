-- Mismo patron de dato corrupto que ya se arreglo para Umag/Bastad/Gstaad
-- (tourney_date = "202601", year+mes sin dia): aparece de nuevo en dos
-- torneos cuyo cuadro se acaba de cargar (2026-319 Kitzbuhel, 2026-7290
-- Estoril), confirmados con el calendario oficial ATP: semana del 20 de
-- julio de 2026 (Generali Open Kitzbuhel / Millennium Estoril Open).
UPDATE estratego_v1.tournaments SET tourney_date = 20260720 WHERE tourney_id = '2026-319';  -- Kitzbuhel
UPDATE estratego_v1.tournaments SET tourney_date = 20260720 WHERE tourney_id = '2026-7290'; -- Estoril

-- De paso, categoria + prize money real (mismo criterio que
-- sql/add_tournament_prize_money.sql), para que estos dos torneos tambien
-- muestren la linea de prize money en las casillas del home.
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-319';  -- Kitzbuhel
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-7290'; -- Estoril
