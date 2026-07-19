-- Prize money + categoria ATP real por torneo (temporada 2026), para mostrar
-- en las casillas de "En juego ahora / Proximamente" del home junto con el
-- rank del torneo dentro de su categoria (calculado en la API, no aqui).
--
-- prize_money_local / prize_money_currency: importe oficial en su moneda de
-- reporte (la ATP fija los minimos de categoria en EUR incluso para sedes en
-- GBP/USD/AUD, así que la moneda "local" no siempre coincide con la moneda
-- del pais anfitrion -- se respeta la que publica cada fuente).
-- prize_money_usd: equivalente en USD, para poder comparar/rankear torneos
-- de la misma categoria que reportan en monedas distintas. Convertido con
-- tipos de cambio del 19/07/2026 (EUR/USD 1.1446, GBP/USD 1.3452,
-- AUD/USD 0.6937) cuando la fuente no publicaba ya un total en USD.
--
-- Fuentes: paginas especificas por torneo de perfect-tennis.com (cifras
-- 2026 confirmadas, verificadas por fetch directo, no por la tabla resumen
-- agregada del sitio que dio una cifra duplicada sospechosa entre dos
-- torneos distintos y no se uso).
--
-- public.tournaments es una VISTA de solo columnas explicitas sobre
-- estratego_v1.tournaments (confirmado via pg_get_viewdef), no una tabla:
-- el ALTER TABLE va sobre la tabla real, y hay que recrear la vista para
-- que exponga las columnas nuevas.

ALTER TABLE estratego_v1.tournaments
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS prize_money_local NUMERIC,
  ADD COLUMN IF NOT EXISTS prize_money_currency TEXT,
  ADD COLUMN IF NOT EXISTS prize_money_usd NUMERIC;

CREATE OR REPLACE VIEW public.tournaments AS
SELECT tourney_id,
       name,
       level,
       surface,
       draw_size,
       tourney_date,
       created_at,
       category,
       prize_money_local,
       prize_money_currency,
       prize_money_usd
FROM estratego_v1.tournaments;

UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 700045, prize_money_currency = 'USD', prize_money_usd = 700045 WHERE tourney_id = '2026-301'; -- Auckland
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 700045, prize_money_currency = 'USD', prize_money_usd = 700045 WHERE tourney_id = '2026-336'; -- Hong Kong
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 800045, prize_money_currency = 'USD', prize_money_usd = 800045 WHERE tourney_id = '2026-339'; -- Brisbane (lado ATP de evento combinado)
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 700045, prize_money_currency = 'USD', prize_money_usd = 700045 WHERE tourney_id = '2026-8998'; -- Adelaide
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-375'; -- Montpellier / Open Occitanie
UPDATE estratego_v1.tournaments SET category = 'Grand Slam', prize_money_local = 111500000, prize_money_currency = 'AUD', prize_money_usd = 77347550 WHERE tourney_id = '2026-580'; -- Australian Open
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2833335, prize_money_currency = 'USD', prize_money_usd = 2833335 WHERE tourney_id = '2026-424'; -- Dallas
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2462660, prize_money_currency = 'EUR', prize_money_usd = 2818761 WHERE tourney_id = '2026-407'; -- Rotterdam / ABN AMRO Open
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 700045, prize_money_currency = 'USD', prize_money_usd = 700045 WHERE tourney_id = '2026-499'; -- Delray Beach
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2833335, prize_money_currency = 'USD', prize_money_usd = 2833335 WHERE tourney_id = '2026-451'; -- Doha
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 2469450, prize_money_currency = 'USD', prize_money_usd = 2469450 WHERE tourney_id = '2026-6932'; -- Rio de Janeiro
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2469450, prize_money_currency = 'USD', prize_money_usd = 2469450 WHERE tourney_id = '2026-807'; -- Acapulco
UPDATE estratego_v1.tournaments SET category = 'Challenger', prize_money_local = 107000, prize_money_currency = 'USD', prize_money_usd = 107000 WHERE tourney_id = '2026-8996'; -- Santiago (Challenger 75, no ATP Tour)
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 3311005, prize_money_currency = 'USD', prize_money_usd = 3311005 WHERE tourney_id = '2026-495'; -- Dubai
UPDATE estratego_v1.tournaments SET category = 'Masters 1000', prize_money_local = 9415725, prize_money_currency = 'USD', prize_money_usd = 9415725 WHERE tourney_id = '2026-404'; -- Indian Wells Masters (lado ATP)
UPDATE estratego_v1.tournaments SET category = 'Masters 1000', prize_money_local = 9415725, prize_money_currency = 'USD', prize_money_usd = 9415725 WHERE tourney_id = '2026-403'; -- Miami Masters (lado ATP)
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 700045, prize_money_currency = 'USD', prize_money_usd = 700045 WHERE tourney_id = '2026-717'; -- Houston
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-360'; -- Marrakech
UPDATE estratego_v1.tournaments SET category = 'Masters 1000', prize_money_local = 6309095, prize_money_currency = 'EUR', prize_money_usd = 7221390 WHERE tourney_id = '2026-410'; -- Monte Carlo Masters
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2950310, prize_money_currency = 'EUR', prize_money_usd = 3376925 WHERE tourney_id = '2026-425'; -- Barcelona
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2561110, prize_money_currency = 'EUR', prize_money_usd = 2931447 WHERE tourney_id = '2026-308'; -- Munich (subio de ATP250 a ATP500 en 2026)
UPDATE estratego_v1.tournaments SET category = 'Masters 1000', prize_money_local = 8235540, prize_money_currency = 'EUR', prize_money_usd = 9426399 WHERE tourney_id = '2026-1536'; -- Madrid Masters (lado ATP)
UPDATE estratego_v1.tournaments SET category = 'Masters 1000', prize_money_local = 8235540, prize_money_currency = 'EUR', prize_money_usd = 9426399 WHERE tourney_id = '2026-416'; -- Rome Masters (lado ATP)
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-322'; -- Geneva
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 768220, prize_money_currency = 'EUR', prize_money_usd = 879305 WHERE tourney_id = '2026-321'; -- Stuttgart
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 723535, prize_money_currency = 'EUR', prize_money_usd = 828158 WHERE tourney_id = '2026-440'; -- 's-Hertogenbosch
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2583330, prize_money_currency = 'EUR', prize_money_usd = 2956880 WHERE tourney_id = '2026-311'; -- Queen's Club
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2583330, prize_money_currency = 'EUR', prize_money_usd = 2956880 WHERE tourney_id = '2026-500'; -- Halle
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-8994'; -- Mallorca
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 773465, prize_money_currency = 'EUR', prize_money_usd = 885308 WHERE tourney_id = '2026-741'; -- Eastbourne
UPDATE estratego_v1.tournaments SET category = 'Grand Slam', prize_money_local = 64200000, prize_money_currency = 'GBP', prize_money_usd = 86361840 WHERE tourney_id = '2026-540'; -- Wimbledon
UPDATE estratego_v1.tournaments SET category = 'ATP500', prize_money_local = 2219670, prize_money_currency = 'EUR', prize_money_usd = 2540634 WHERE tourney_id = '2026-414'; -- Hamburg
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-316'; -- Bastad
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-314'; -- Gstaad
UPDATE estratego_v1.tournaments SET category = 'ATP250', prize_money_local = 612620, prize_money_currency = 'EUR', prize_money_usd = 701205 WHERE tourney_id = '2026-439'; -- Umag
