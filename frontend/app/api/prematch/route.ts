// app/api/prematch/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

type PlayerSummary = {
  win_pct_year: number | null;
  win_pct_surface: number | null;
  ranking: number | null;
  home_advantage: boolean | null;
  days_since_last: number | null;
  win_pct_month: number | null;
  win_pct_vs_top10: number | null;
  court_speed_score: number | null;
  win_score: number | null;
  win_probability: number | null;
  defends_round?: string | null;
  ranking_score?: number | null;
  h2h_score?: number | null;
  rest_score?: number | null;
  motivation_score?: number | null;
  alerts?: string[] | null;
  points_current?: number | null;
  points_previous?: number | null;
  points_delta?: number | null;
  last_results?: string[] | null;
};

type TournamentSummary = {
  name: string | null;
  surface: string | null;
  bucket: string | null;
  month: number | null;
};

type ExtrasSummary = {
  display_p: string | null;
  display_o: string | null;
  country_p: string | null;
  country_o: string | null;
  rank_p: number | null;
  rank_o: number | null;
  ytd_wr_p: number | null;
  ytd_wr_o: number | null;
};

type OddsPlayerSummary = {
  name: string | null;
  price: number | null;
  implied_probability: number | null;
  value_diff: number | null;
  is_value: boolean;
};

type MatchOddsSummary = {
  sport_key: string;
  bookmaker: string;
  last_update: string | null;
  playerA: OddsPlayerSummary | null;
  playerB: OddsPlayerSummary | null;
  value_pick?: "playerA" | "playerB";
  value_message?: string;
};

type PrematchSummaryResponse = {
  prob_player: number | null;
  playerA: PlayerSummary;
  playerB: PlayerSummary;
  h2h: {
    wins: number;
    losses: number;
    total: number;
    last_meeting: string | null;
  };
  last_surface: string | null;
  defends_round: string | null;
  court_speed: number | null;
  court_speed_rank?: number | null;
  surface_reported?: string | null;
  tournament?: TournamentSummary;
  extras?: ExtrasSummary;
  odds?: MatchOddsSummary;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const normalized = match[0].includes(",") && !match[0].includes(".")
      ? match[0].replace(",", ".")
      : match[0].replace(/,/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeProbability = (value: number | null): number | null => {
  if (value === null || Number.isNaN(value)) return null;

  const ratio = value > 1 ? value / 100 : value;
  if (!Number.isFinite(ratio)) return null;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;

  return ratio;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return null;
};

const asString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
  return null;
};

const asStringArray = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    const mapped = value
      .map(asString)
      .filter((item): item is string => item !== null && item.trim().length > 0);
    return mapped.length > 0 ? mapped : null;
  }

  const single = asString(value);
  if (single) return [single];
  return null;
};

const hasTruthyValue = (obj: Record<string, unknown>): boolean => {
  return Object.values(obj).some((value) => value !== null && value !== undefined);
};

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_DEFAULT_REGIONS = process.env.ODDS_REGIONS ?? "eu";
const ODDS_DEFAULT_MARKETS = process.env.ODDS_MARKETS ?? "h2h";
const ODDS_DEFAULT_ODDS_FORMAT = process.env.ODDS_FORMAT ?? "decimal";
const ODDS_DEFAULT_DATE_FORMAT = process.env.ODDS_DATE_FORMAT ?? "iso";
const ODDS_DEFAULT_BOOKMAKER = (process.env.ODDS_BOOKMAKER ?? "Pinnacle").toLowerCase();
const ODDS_VALUE_THRESHOLD = Number.isNaN(Number.parseFloat(process.env.ODDS_VALUE_THRESHOLD ?? ""))
  ? 0.03
  : Number.parseFloat(process.env.ODDS_VALUE_THRESHOLD ?? "0.03");
const ODDS_TOURNAMENT_OVERRIDES: Record<string, string> = {
  "atp paris masters": "tennis_atp_paris_masters",
  "atp paris": "tennis_atp_paris_masters",
  "paris masters": "tennis_atp_paris_masters",
  "rolex paris masters": "tennis_atp_paris_masters",
  "atp shanghai masters": "tennis_atp_shanghai_masters",
  "atp finals": "tennis_atp_finals",
  "wta finals": "tennis_wta_finals",
  "wta elite trophy": "tennis_wta_elite_trophy",
  "swiss indoors basel": "tennis_atp_basel",
  "atp basel": "tennis_atp_basel",
  "atp geneva open": "tennis_atp_geneva_open",
  "asb classic": "tennis_atp_auckland",
  "auckland open": "tennis_atp_auckland",
  "adelaide international": "tennis_atp_adelaide",
};
const ODDS_CACHE_TABLE = process.env.ODDS_CACHE_TABLE ?? "odds_cache";
const ODDS_CACHE_TTL_MINUTES = (() => {
  const raw = Number.parseFloat(process.env.ODDS_CACHE_TTL_MINUTES ?? "");
  return Number.isFinite(raw) ? raw : 180;
})();
const ODDS_CACHE_DISABLED = (process.env.ODDS_CACHE_DISABLED ?? "false").toLowerCase() === "true";
const BETFAIR_APP_KEY = process.env.BETFAIR_APP_KEY;
const BETFAIR_SESSION_TOKEN = process.env.BETFAIR_SESSION_TOKEN;
const BETFAIR_BEST_PRICES_DEPTH = Number(process.env.BETFAIR_BEST_PRICES_DEPTH ?? "1") || 1;

type NameMatchData = {
  original: string;
  normalized: string | null;
  aliases: string[];
  lastName: string | null;
};

const normalizeNameForOdds = (name?: string | null): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const buildNameMatchData = (name?: string | null): NameMatchData => {
  const normalized = normalizeNameForOdds(name);
  if (!normalized) {
    return { original: name ?? "", normalized: null, aliases: [], lastName: null };
  }
  const parts = normalized.split(" ");
  const lastName = parts.length ? parts[parts.length - 1] : null;
  const firstName = parts.length ? parts[0] : null;
  const aliases = new Set<string>();
  aliases.add(normalized);
  if (lastName) aliases.add(lastName);
  if (firstName && lastName) {
    aliases.add(`${firstName} ${lastName}`);
    aliases.add(`${firstName[0]} ${lastName}`);
    aliases.add(`${firstName[0]}. ${lastName}`);
  }
  return {
    original: name ?? normalized,
    normalized,
    aliases: Array.from(aliases),
    lastName,
  };
};

const aliasMatches = (candidate: string | null | undefined, target: NameMatchData): boolean => {
  const normalizedCandidate = normalizeNameForOdds(candidate);
  if (!normalizedCandidate || !target.normalized) return false;
  if (target.aliases.includes(normalizedCandidate)) return true;
  if (target.lastName && normalizedCandidate.endsWith(target.lastName)) return true;
  return target.aliases.some(
    (alias) =>
      normalizedCandidate.includes(alias) ||
      alias.includes(normalizedCandidate) ||
      normalizedCandidate.replace(/\s+/g, "") === alias.replace(/\s+/g, ""),
  );
};

const sanitizeNameInput = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const collectOutcomeNames = (event: any): string[] => {
  const names: string[] = [];
  if (Array.isArray(event?.bookmakers)) {
    for (const book of event.bookmakers) {
      if (!Array.isArray(book?.markets)) continue;
      for (const market of book.markets) {
        if (!Array.isArray(market?.outcomes)) continue;
        for (const outcome of market.outcomes) {
          if (typeof outcome?.name === "string") {
            names.push(outcome.name);
          }
        }
      }
    }
  }
  return names;
};

const matchesPlayersStrict = (event: any, playerA: NameMatchData, playerB: NameMatchData): boolean => {
  const outcomeNames = collectOutcomeNames(event);
  const matchTarget = (target: NameMatchData): boolean => {
    if (aliasMatches(event?.home_team, target)) return true;
    if (aliasMatches(event?.away_team, target)) return true;
    return outcomeNames.some((name) => aliasMatches(name, target));
  };
  return matchTarget(playerA) && matchTarget(playerB);
};

const matchesPlayersLoose = (
  event: any,
  playerA: NameMatchData,
  playerB: NameMatchData,
  normalizedEventHint?: string | null,
): boolean => {
  const lowerDesc = `${event?.sport_title ?? ""} ${event?.home_team ?? ""} ${event?.away_team ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const containsTarget = (target: NameMatchData): boolean => {
    if (!target.lastName) return false;
    return lowerDesc.includes(target.lastName);
  };

  const outcomeNames = collectOutcomeNames(event).join(" ").toLowerCase();
  const containsTargetInOutcome = (target: NameMatchData): boolean => {
    if (!target.lastName) return false;
    return outcomeNames.includes(target.lastName);
  };

  const aMatches =
    containsTarget(playerA) ||
    containsTargetInOutcome(playerA) ||
    aliasMatches(event?.home_team, playerA) ||
    aliasMatches(event?.away_team, playerA);
  const bMatches =
    containsTarget(playerB) ||
    containsTargetInOutcome(playerB) ||
    aliasMatches(event?.home_team, playerB) ||
    aliasMatches(event?.away_team, playerB);

  if (aMatches && bMatches) return true;

  if (normalizedEventHint && lowerDesc.includes(normalizedEventHint)) {
    return aMatches || bMatches;
  }

  return false;
};

const normalizeKeySegment = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
};

const buildPlayerKey = (playerA: NameMatchData, playerB: NameMatchData): string => {
  const normalize = (data: NameMatchData) =>
    normalizeKeySegment(data.normalized) ?? normalizeKeySegment(data.original) ?? "";
  return [normalize(playerA), normalize(playerB)].sort().join("|");
};

const buildEventScope = (
  normalizedEventHintLower: string | null,
  tournament?: TournamentSummary | null,
): string | null => {
  const parts = new Set<string>();
  if (normalizedEventHintLower) parts.add(normalizedEventHintLower);
  if (tournament?.name) {
    const normalized = normalizeKeySegment(tournament.name);
    if (normalized) parts.add(normalized);
  }
  if (tournament?.bucket) {
    const normalized = normalizeKeySegment(tournament.bucket);
    if (normalized) parts.add(normalized);
  }
  if (parts.size === 0) return null;
  return Array.from(parts).join(" | ");
};

const buildCutoffIso = () =>
  new Date(Date.now() - ODDS_CACHE_TTL_MINUTES * 60 * 1000).toISOString();

const loadOddsFromCache = async (
  playerKey: string,
  eventScope: string | null,
): Promise<MatchOddsSummary | null> => {
  if (ODDS_CACHE_DISABLED) return null;
  try {
    let query = supabase
      .from(ODDS_CACHE_TABLE)
      .select("data, sport_key, updated_at")
      .eq("player_key", playerKey)
      .gte("updated_at", buildCutoffIso())
      .order("updated_at", { ascending: false })
      .limit(1);

    if (eventScope) {
      query = query.eq("event_scope", eventScope);
    } else {
      query = query.is("event_scope", null);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn("[odds] cache load error", { error, playerKey, eventScope });
      return null;
    }
    if (!data) return null;

    console.info("[odds] cache hit", {
      playerKey,
      eventScope,
      updated_at: data.updated_at,
      sport_key: data.sport_key,
    });

    return data.data as MatchOddsSummary;
  } catch (err) {
    console.warn("[odds] cache load exception", { err, playerKey, eventScope });
    return null;
  }
};

const saveOddsToCache = async (
  playerKey: string,
  eventScope: string | null,
  odds: MatchOddsSummary,
) => {
  if (ODDS_CACHE_DISABLED) return;
  try {
    const payload = {
      player_key: playerKey,
      event_scope: eventScope,
      sport_key: odds.sport_key,
      data: odds,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from(ODDS_CACHE_TABLE)
      .upsert(payload, { onConflict: "player_key,event_scope" });
    if (error) {
      console.warn("[odds] cache save error", { error, playerKey, eventScope });
    }
  } catch (err) {
    console.warn("[odds] cache save exception", { err, playerKey, eventScope });
  }
};

const inferTourPrefix = (tournament?: TournamentSummary | null, extras?: ExtrasSummary | null): "atp" | "wta" => {
  const combined = `${tournament?.name ?? ""} ${tournament?.bucket ?? ""} ${extras?.display_p ?? ""} ${extras?.display_o ?? ""}`.toLowerCase();
  return combined.includes("wta") ? "wta" : "atp";
};

const slugifyTournament = (tournamentName: string, prefix: "atp" | "wta"): string | null => {
  const normalized = tournamentName.toLowerCase().replace(/^(atp|wta)\s+/, "");
  const slug = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!slug) return null;
  return `tennis_${prefix}_${slug}`;
};

const determineSportKeyCandidates = (
  tournament?: TournamentSummary | null,
  extras?: ExtrasSummary | null,
  eventNameHint?: string | null,
): { sportKey: string; forceMatch?: boolean }[] => {
  const candidates: string[] = [];
  const prefix = inferTourPrefix(tournament, extras);
  const normalizedName = tournament?.name?.trim().toLowerCase() ?? null;
  const normalizedEventHint = eventNameHint?.trim().toLowerCase() ?? null;

  if (normalizedName && ODDS_TOURNAMENT_OVERRIDES[normalizedName]) {
    candidates.push(ODDS_TOURNAMENT_OVERRIDES[normalizedName]);
  }

  if (normalizedName) {
    const slugCandidate = slugifyTournament(normalizedName, prefix);
    if (slugCandidate) candidates.push(slugCandidate);
  }

  if (normalizedEventHint) {
    if (ODDS_TOURNAMENT_OVERRIDES[normalizedEventHint]) {
      candidates.push(ODDS_TOURNAMENT_OVERRIDES[normalizedEventHint]);
    }
    const slugFromHint = slugifyTournament(normalizedEventHint, prefix);
    if (slugFromHint) candidates.push(slugFromHint);

    if (normalizedEventHint.includes("paris")) {
      candidates.push("tennis_atp_paris_masters");
      candidates.push("tennis_wta_paris");
    }
    if (normalizedEventHint.includes("basel")) {
      candidates.push("tennis_atp_basel");
      candidates.push("tennis_atp_swiss_indoors_basel");
    }
    if (normalizedEventHint.includes("shanghai")) {
      candidates.push("tennis_atp_shanghai_masters");
    }
    if (normalizedEventHint.includes("madrid")) {
      candidates.push(`tennis_${prefix}_madrid_open`);
    }
  }

  candidates.push(`tennis_${prefix}`);

  const unique = Array.from(new Set(candidates));
  return unique.map((sportKey, idx) => ({
    sportKey,
    forceMatch: idx === 0 && sportKey !== `tennis_${prefix}`,
  }));
};

const pickPreferredBookmaker = (bookmakers: any[]): any | null => {
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) return null;
  const preferred = bookmakers.find((b) => {
    const key = typeof b.key === "string" ? b.key.toLowerCase() : "";
    const title = typeof b.title === "string" ? b.title.toLowerCase() : "";
    return key === ODDS_DEFAULT_BOOKMAKER || title === ODDS_DEFAULT_BOOKMAKER;
  });
  return preferred ?? bookmakers[0];
};

const pickMarket = (markets: any[]): any | null => {
  if (!Array.isArray(markets) || markets.length === 0) return null;
  const byKey = markets.find((m) => m?.key === "h2h");
  return byKey ?? markets[0];
};

const formatOddsNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const computeOddsForOutcome = (price: number | null): { implied: number | null } => {
  if (price == null) return { implied: null };
  return { implied: price > 0 ? 1 / price : null };
};

type BetfairRunnerPrice = { price: number; size: number };
type BetfairRunner = { selectionId: number; runnerName: string; ex?: { availableToBack?: BetfairRunnerPrice[] } };

const fetchBetfairOdds = async (
  playerAName: string,
  playerBName: string,
  tournamentName?: string | null,
): Promise<MatchOddsSummary | null> => {
  if (!BETFAIR_APP_KEY || !BETFAIR_SESSION_TOKEN) return null;
  if (!playerAName || !playerBName) return null;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Application": BETFAIR_APP_KEY,
    "X-Authentication": BETFAIR_SESSION_TOKEN,
  };

  const textQuery = `${playerAName} ${playerBName}`;
  const listEventsBody = {
    filter: {
      eventTypeIds: ["2"], // tennis
      textQuery,
      ...(tournamentName ? { eventName: tournamentName } : {}),
    },
    maxResults: 20,
  };

  const listEvents = await fetch(
    "https://api.betfair.com/exchange/betting/rest/v1.0/listEvents/",
    { method: "POST", headers, body: JSON.stringify(listEventsBody), cache: "no-store" },
  );

  if (!listEvents.ok) return null;
  const events = (await listEvents.json()) as Array<{ event: { id: string; name: string } }>;
  if (!Array.isArray(events) || !events.length) return null;

  const normalizedA = playerAName.toLowerCase();
  const normalizedB = playerBName.toLowerCase();

  const targetEvent = events.find((e) => {
    const n = (e.event?.name ?? "").toLowerCase();
    return n.includes(normalizedA) && n.includes(normalizedB);
  }) ?? events[0];

  const eventId = targetEvent?.event?.id;
  if (!eventId) return null;

  const listMarketsBody = {
    filter: { eventIds: [eventId], marketTypeCodes: ["MATCH_ODDS"] },
    maxResults: 5,
    marketProjection: ["RUNNER_METADATA"],
  };

  const listMarkets = await fetch(
    "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/",
    { method: "POST", headers, body: JSON.stringify(listMarketsBody), cache: "no-store" },
  );
  if (!listMarkets.ok) return null;
  const markets = (await listMarkets.json()) as Array<{ marketId: string; runners: BetfairRunner[] }>;
  const marketId = markets?.[0]?.marketId;
  if (!marketId) return null;

  const listBookBody = {
    marketIds: [marketId],
    priceProjection: {
      priceData: ["EX_BEST_OFFERS"],
      exBestOffersOverrides: { bestPricesDepth: BETFAIR_BEST_PRICES_DEPTH },
    },
  };

  const listBook = await fetch(
    "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/",
    { method: "POST", headers, body: JSON.stringify(listBookBody), cache: "no-store" },
  );
  if (!listBook.ok) return null;
  const books = (await listBook.json()) as Array<{ runners: BetfairRunner[] }>;
  const runners = books?.[0]?.runners ?? [];
  if (!runners.length) return null;

  const pickPrice = (name: string): number | null => {
    const norm = name.trim().toLowerCase();
    const runner = runners.find((r) => (r.runnerName ?? "").toLowerCase().includes(norm));
    const price = runner?.ex?.availableToBack?.[0]?.price;
    return typeof price === "number" && price > 0 ? price : null;
  };

  const priceA = pickPrice(playerAName);
  const priceB = pickPrice(playerBName);

  if (priceA == null && priceB == null) return null;

  return {
    sport_key: "betfair",
    bookmaker: "betfair-exchange",
    last_update: new Date().toISOString(),
    playerA: {
      name: playerAName,
      price: priceA,
      implied_probability: priceA ? 1 / priceA : null,
      value_diff: null,
      is_value: false,
    },
    playerB: {
      name: playerBName,
      price: priceB,
      implied_probability: priceB ? 1 / priceB : null,
      value_diff: null,
      is_value: false,
    },
  };
};

type FetchOddsInput = {
  playerAName?: string | null;
  playerBName?: string | null;
  tournament?: TournamentSummary | null;
  extras?: ExtrasSummary | null;
  eventNameHint?: string | null;
  playerAProbability: number | null;
  playerBProbability: number | null;
};

const fetchMatchOdds = async (input: FetchOddsInput): Promise<MatchOddsSummary | null> => {
  if (!ODDS_API_KEY) {
    console.info("[odds] ODDS_API_KEY not configured; skipping odds retrieval");
    return null;
  }
  const { playerAName, playerBName, tournament, extras, eventNameHint } = input;
  if (!playerAName || !playerBName) return null;
  const normalizedEventHintLower = eventNameHint ? eventNameHint.toLowerCase() : null;

  const playerAData = buildNameMatchData(playerAName);
  const playerBData = buildNameMatchData(playerBName);
  if (!playerAData.normalized || !playerBData.normalized) return null;

  const playerKey = buildPlayerKey(playerAData, playerBData);
  const eventScope = buildEventScope(normalizedEventHintLower, tournament);
  const cachedOdds = await loadOddsFromCache(playerKey, eventScope);
  if (cachedOdds) {
    console.info("[odds] returning cached odds", {
      playerKey,
      eventScope,
      sport_key: cachedOdds.sport_key,
    });
    return cachedOdds;
  }
  const sportKeyEntries = determineSportKeyCandidates(tournament, extras, eventNameHint);
  console.info("[odds] attempting odds lookup", {
    playerA: playerAData.original,
    playerB: playerBData.original,
    sportKeys: sportKeyEntries.map((entry) => entry.sportKey),
    tournament: tournament?.name ?? null,
  });

  for (const entry of sportKeyEntries) {
    const { sportKey, forceMatch } = entry;
    try {
      const url = new URL(`${ODDS_API_BASE}/sports/${sportKey}/odds`);
      url.searchParams.set("apiKey", ODDS_API_KEY);
      url.searchParams.set("regions", ODDS_DEFAULT_REGIONS);
      url.searchParams.set("markets", ODDS_DEFAULT_MARKETS);
      url.searchParams.set("oddsFormat", ODDS_DEFAULT_ODDS_FORMAT);
      url.searchParams.set("dateFormat", ODDS_DEFAULT_DATE_FORMAT);

      console.info("[odds] fetch", { sportKey, url: url.toString() });

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 404) continue;
        const body = await response.text();
        console.warn("[odds] API response not OK", { sportKey, status: response.status, body });
        continue;
      }

      const events: any[] = await response.json();
      if (!Array.isArray(events)) continue;

      const strictMatches = events.filter((item) => matchesPlayersStrict(item, playerAData, playerBData));
      let event = strictMatches[0] ?? null;

      if (!event && forceMatch) {
        const looseMatches = events.filter((item) =>
          matchesPlayersLoose(item, playerAData, playerBData, normalizedEventHintLower),
        );
        if (looseMatches.length) {
          event = looseMatches[0];
          console.info("[odds] loose match selected", {
            sportKey,
            eventId: event?.id ?? null,
            home_team: event?.home_team,
            away_team: event?.away_team,
          });
        }
      }

      if (!event) continue;
      console.info("[odds] matched event", {
        sportKey,
        eventId: event.id ?? null,
        home_team: event.home_team,
        away_team: event.away_team,
        commence_time: event.commence_time,
        bookmakers: Array.isArray(event.bookmakers) ? event.bookmakers.map((b: any) => b.key ?? b.title).slice(0, 5) : [],
      });

      const bookmaker = pickPreferredBookmaker(event.bookmakers ?? []);
      if (!bookmaker) continue;
      const market = pickMarket(bookmaker.markets ?? []);
      if (!market || !Array.isArray(market.outcomes)) continue;

      const findOutcome = (target: NameMatchData): any | null => {
        const byAlias = market.outcomes.find((outcome: any) => aliasMatches(outcome?.name, target));
        if (byAlias) return byAlias;
        if (aliasMatches(event.home_team, target)) {
          const homeOutcome = market.outcomes.find(
            (outcome: any) => aliasMatches(outcome?.name, buildNameMatchData(event.home_team)),
          );
          if (homeOutcome) return homeOutcome;
        }
        if (aliasMatches(event.away_team, target)) {
          const awayOutcome = market.outcomes.find(
            (outcome: any) => aliasMatches(outcome?.name, buildNameMatchData(event.away_team)),
          );
          if (awayOutcome) return awayOutcome;
        }
        return null;
      };

      const outcomeA = findOutcome(playerAData);
      const outcomeB = findOutcome(playerBData);
      if (!outcomeA || !outcomeB) continue;

      const priceA = formatOddsNumber(outcomeA.price ?? outcomeA.odds);
      const priceB = formatOddsNumber(outcomeB.price ?? outcomeB.odds);
      const { implied: impliedA } = computeOddsForOutcome(priceA);
      const { implied: impliedB } = computeOddsForOutcome(priceB);

      const valueDiffA =
        impliedA != null && input.playerAProbability != null ? input.playerAProbability - impliedA : null;
      const valueDiffB =
        impliedB != null && input.playerBProbability != null ? input.playerBProbability - impliedB : null;

      let valuePick: "playerA" | "playerB" | undefined;
      if (valueDiffA != null && valueDiffA >= ODDS_VALUE_THRESHOLD) {
        valuePick = "playerA";
      } else if (valueDiffB != null && valueDiffB >= ODDS_VALUE_THRESHOLD) {
        valuePick = "playerB";
      }

      let valueMessage: string | undefined;
      if (valuePick === "playerA" && valueDiffA != null) {
        valueMessage = `${playerAData.original} tiene valor frente a la cuota ${bookmaker.title ?? bookmaker.key
          } (${(valueDiffA * 100).toFixed(1)} pp)`;
      } else if (valuePick === "playerB" && valueDiffB != null) {
        valueMessage = `${playerBData.original} tiene valor frente a la cuota ${bookmaker.title ?? bookmaker.key
          } (${(valueDiffB * 100).toFixed(1)} pp)`;
      }

      console.info("[odds] returning odds", {
        sportKey,
        bookmaker: bookmaker.key ?? bookmaker.title,
        priceA,
        priceB,
        impliedA,
        impliedB,
        valueDiffA,
        valueDiffB,
      });

      const oddsSummary: MatchOddsSummary = {
        sport_key: sportKey,
        bookmaker: typeof bookmaker.title === "string" && bookmaker.title.trim().length > 0 ? bookmaker.title : bookmaker.key ?? "bookmaker",
        last_update: bookmaker.last_update ?? null,
        playerA: {
          name: playerAData.original,
          price: priceA,
          implied_probability: impliedA,
          value_diff: valueDiffA,
          is_value: Boolean(valueDiffA != null && valueDiffA >= ODDS_VALUE_THRESHOLD),
        },
        playerB: {
          name: playerBData.original,
          price: priceB,
          implied_probability: impliedB,
          value_diff: valueDiffB,
          is_value: Boolean(valueDiffB != null && valueDiffB >= ODDS_VALUE_THRESHOLD),
        },
        value_pick: valuePick,
        value_message: valueMessage,
      };
      await saveOddsToCache(playerKey, eventScope, oddsSummary);
      return oddsSummary;
    } catch (err) {
      console.warn("[odds] error fetching odds", { sportKey, err });
    }
  }

  console.info("[odds] no odds found", {
    playerA: playerAData.original,
    playerB: playerBData.original,
    sportKeys: sportKeyEntries.map((entry) => entry.sportKey),
    playerKey,
    eventScope,
  });

  return null;
};

const fetchPlayerDisplayName = async (playerId: number): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .schema("estratego_v1")
      .from("players_min")
      .select("display_name,name")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error || !data) return null;
    const display = typeof data.display_name === "string" && data.display_name.trim().length > 0 ? data.display_name : null;
    const fallback = typeof data.name === "string" && data.name.trim().length > 0 ? data.name : null;
    return display ?? fallback;
  } catch (err) {
    console.warn("Error fetching player display name", playerId, err);
    return null;
  }
};

const pickNumber = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = asNumber(source[key]);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
};

const pickBoolean = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = asBoolean(source[key]);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
};

const buildPlayer = (
  base: Record<string, unknown>,
  keys: string[],
  fallbackPrefixes: string[],
): PlayerSummary => {
  let playerRecord: Record<string, unknown> | null = null;
  for (const candidate of keys) {
    playerRecord = asRecord(base[candidate]);
    if (playerRecord) break;
  }

  const getFromPrefixes = <T>(
    extractor: (source: Record<string, unknown>, prefix: string) => T | null,
  ): T | null => {
    for (const prefix of fallbackPrefixes) {
      const fromPrefix = extractor(base, prefix);
      if (fromPrefix !== null && fromPrefix !== undefined) {
        return fromPrefix;
      }
    }
    return null;
  };

  const winPctYear =
    pickNumber(playerRecord, [
      "win_pct_year",
      "win_pct_season",
      "ytd_win_pct",
      "ytd_wr",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_year`,
        `win_pct_year_${prefix}`,
        `${prefix}_win_pct_season`,
        `win_pct_season_${prefix}`,
        `${prefix}_ytd_win_pct`,
        `ytd_win_pct_${prefix}`,
        `${prefix}_ytd_wr`,
        `ytd_wr_${prefix}`,
      ]),
    );
  const winPctSurface =
    pickNumber(playerRecord, [
      "win_pct_surface",
      "surface_win_pct",
      "surface_wr",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_surface`,
        `win_pct_surface_${prefix}`,
        `${prefix}_surface_win_pct`,
        `surface_win_pct_${prefix}`,
        `${prefix}_surface_wr`,
        `surface_wr_${prefix}`,
      ]),
    );
  const ranking =
    pickNumber(playerRecord, ["ranking", "rank", "current_rank"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_ranking`,
        `ranking_${prefix}`,
        `${prefix}_rank`,
        `rank_${prefix}`,
        `${prefix}_current_rank`,
        `current_rank_${prefix}`,
      ]),
    );
  const homeAdvantage =
    pickBoolean(playerRecord, ["home_advantage", "is_home", "is_local"]) ??
    getFromPrefixes((source, prefix) =>
      pickBoolean(source, [
        `${prefix}_home_advantage`,
        `home_advantage_${prefix}`,
        `${prefix}_is_home`,
        `is_home_${prefix}`,
        `${prefix}_is_local`,
        `is_local_${prefix}`,
      ]),
    );
  const daysSinceLast =
    pickNumber(playerRecord, [
      "days_since_last",
      "days_since_last_match",
      "days_since_last_game",
      "days_since_match",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_days_since_last`,
        `days_since_last_${prefix}`,
        `${prefix}_days_since_last_match`,
        `days_since_last_match_${prefix}`,
        `${prefix}_days_since_match`,
        `days_since_match_${prefix}`,
      ]),
    );
  const winPctMonth =
    pickNumber(playerRecord, [
      "win_pct_month",
      "win_pct_this_month",
      "win_pct_last_30",
      "win_pct_30d",
      "monthly_win_pct",
      "last_30_wr",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_month`,
        `win_pct_month_${prefix}`,
        `${prefix}_win_pct_this_month`,
        `win_pct_this_month_${prefix}`,
        `${prefix}_win_pct_last_30`,
        `win_pct_last_30_${prefix}`,
        `${prefix}_win_pct_30d`,
        `win_pct_30d_${prefix}`,
        `${prefix}_monthly_win_pct`,
        `monthly_win_pct_${prefix}`,
        `${prefix}_last_30_wr`,
        `last_30_wr_${prefix}`,
      ]),
    );
  const winPctVsTop10 =
    pickNumber(playerRecord, [
      "win_pct_vs_top10",
      "win_pct_vs_top_10",
      "win_pct_top10",
      "top10_win_pct",
      "pct_vs_top10",
      "pct_vs_top_10",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_vs_top10`,
        `win_pct_vs_top10_${prefix}`,
        `${prefix}_win_pct_vs_top_10`,
        `win_pct_vs_top_10_${prefix}`,
        `${prefix}_win_pct_top10`,
        `win_pct_top10_${prefix}`,
        `${prefix}_top10_win_pct`,
        `top10_win_pct_${prefix}`,
        `${prefix}_pct_vs_top10`,
        `pct_vs_top10_${prefix}`,
        `${prefix}_pct_vs_top_10`,
        `pct_vs_top_10_${prefix}`,
      ]),
    );
  const courtSpeedScore =
    pickNumber(playerRecord, [
      "court_speed_score",
      "court_speed",
      "court_speed_index",
      "court_speed_rating",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_court_speed_score`,
        `court_speed_score_${prefix}`,
        `${prefix}_court_speed`,
        `court_speed_${prefix}`,
        `${prefix}_court_speed_index`,
        `court_speed_index_${prefix}`,
        `${prefix}_court_speed_rating`,
        `court_speed_rating_${prefix}`,
      ]),
    );
  const winScore =
    pickNumber(playerRecord, ["win_score", "win_rating", "win_index"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_score`,
        `win_score_${prefix}`,
        `${prefix}_win_rating`,
        `win_rating_${prefix}`,
        `${prefix}_win_index`,
        `win_index_${prefix}`,
      ]),
    );
  const winProbability =
    pickNumber(playerRecord, [
      "win_probability",
      "probability",
      "win_prob",
      "predicted_win_pct",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_probability`,
        `win_probability_${prefix}`,
        `${prefix}_probability`,
        `probability_${prefix}`,
        `${prefix}_win_prob`,
        `win_prob_${prefix}`,
        `${prefix}_predicted_win_pct`,
        `predicted_win_pct_${prefix}`,
      ]),
    );
  const defendsRound =
    asString(playerRecord?.["defends_round"]) ??
    asString(playerRecord?.["last_year_round"]) ??
    getFromPrefixes((source, prefix) =>
      asString(
        source[`${prefix}_defends_round`] ??
          source[`${prefix}_last_year_round`] ??
          source[`defends_round_${prefix}`] ??
          source[`last_year_round_${prefix}`],
      ),
    );
  const rankingScore =
    pickNumber(playerRecord, ["ranking_score"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [`${prefix}_ranking_score`, `ranking_score_${prefix}`]),
    );
  const h2hScore =
    pickNumber(playerRecord, ["h2h_score"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [`${prefix}_h2h_score`, `h2h_score_${prefix}`]),
    );
  const restScore =
    pickNumber(playerRecord, ["rest_score"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [`${prefix}_rest_score`, `rest_score_${prefix}`]),
    );
  const motivationScore =
    pickNumber(playerRecord, ["motivation_score"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [`${prefix}_motivation_score`, `motivation_score_${prefix}`]),
    );

  const pointsCurrent =
    pickNumber(playerRecord, ["points_current", "current_points"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_points_current`,
        `points_current_${prefix}`,
        `${prefix}_current_points`,
        `current_points_${prefix}`,
      ]),
    );

  const pointsPrevious =
    pickNumber(playerRecord, ["points_previous", "previous_points", "points_last_year"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_points_previous`,
        `points_previous_${prefix}`,
        `${prefix}_previous_points`,
        `previous_points_${prefix}`,
        `${prefix}_points_last_year`,
        `points_last_year_${prefix}`,
      ]),
    );

  const pointsDelta =
    pickNumber(playerRecord, ["points_delta", "points_diff", "points_difference"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_points_delta`,
        `points_delta_${prefix}`,
        `${prefix}_points_diff`,
        `points_diff_${prefix}`,
        `${prefix}_points_difference`,
        `points_difference_${prefix}`,
      ]),
    );

  const alerts =
    asStringArray(playerRecord?.["alerts"]) ??
    getFromPrefixes((source, prefix) => {
      const fromPrefix = source[`${prefix}_alerts`] ?? source[`alerts_${prefix}`];
      return asStringArray(fromPrefix);
    });

  const rawLastResults =
    asStringArray(playerRecord?.["last_results"]) ??
    getFromPrefixes((source, prefix) => {
      const fromPrefix = source[`${prefix}_last_results`] ?? source[`last_results_${prefix}`];
      return asStringArray(fromPrefix);
    });

  const normalizedLastResults =
    rawLastResults
      ?.map((value) => {
        const upper = value.trim().toUpperCase();
        if (upper.startsWith("W")) return "W";
        if (upper.startsWith("L")) return "L";
        return upper;
      })
      .slice(0, 5) ?? null;

  return {
    win_pct_year: winPctYear,
    win_pct_surface: winPctSurface,
    ranking,
    home_advantage: homeAdvantage,
    days_since_last: daysSinceLast,
    win_pct_month: winPctMonth,
    win_pct_vs_top10: winPctVsTop10,
    court_speed_score: courtSpeedScore,
    win_score: winScore,
   win_probability: winProbability,
    defends_round: defendsRound,
    ranking_score: rankingScore,
    h2h_score: h2hScore,
    rest_score: restScore,
    motivation_score: motivationScore,
    points_current: pointsCurrent,
    points_previous: pointsPrevious,
    points_delta: pointsDelta,
    alerts,
    last_results: normalizedLastResults && normalizedLastResults.length > 0 ? normalizedLastResults : undefined,
  };
};

const parseExtras = (base: Record<string, unknown>): ExtrasSummary | undefined => {
  const rawExtras = base.extras ?? base.extra ?? base.player_extras;
  let extrasRecord = asRecord(rawExtras);

  if (!extrasRecord && typeof rawExtras === "string") {
    try {
      const parsed = JSON.parse(rawExtras);
      extrasRecord = asRecord(parsed);
    } catch {
      extrasRecord = null;
    }
  }

  if (!extrasRecord) return undefined;

  const formatted: ExtrasSummary = {
    display_p: asString(extrasRecord?.["display_p"]),
    display_o: asString(extrasRecord?.["display_o"]),
    country_p: asString(extrasRecord?.["country_p"]),
    country_o: asString(extrasRecord?.["country_o"]),
    rank_p: asNumber(extrasRecord?.["rank_p"]),
    rank_o: asNumber(extrasRecord?.["rank_o"]),
    ytd_wr_p: asNumber(extrasRecord?.["ytd_wr_p"]),
    ytd_wr_o: asNumber(extrasRecord?.["ytd_wr_o"]),
  };

  return hasTruthyValue(formatted as Record<string, unknown>) ? formatted : undefined;
};

const parseTournament = (base: Record<string, unknown>): TournamentSummary | undefined => {
  const rawTournament = base.tournament ?? base.tourney ?? base.event;
  const tournamentRecord = asRecord(rawTournament) ?? null;

  const formatted: TournamentSummary = {
    name:
      asString(tournamentRecord?.["name"]) ??
      asString(base["tournament_name"]) ??
      asString(base["event_name"]),
    surface:
      asString(tournamentRecord?.["surface"]) ??
      asString(base["tournament_surface"]) ??
      asString(base["surface"]),
    bucket:
      asString(tournamentRecord?.["bucket"]) ??
      asString(tournamentRecord?.["category"]) ??
      asString(base["tournament_bucket"]) ??
      asString(base["category"]),
    month: asNumber(tournamentRecord?.["month"]) ?? asNumber(base["tournament_month"]),
  };

  return hasTruthyValue(formatted as Record<string, unknown>) ? formatted : undefined;
};

const formatPrematchSummary = (raw: unknown): PrematchSummaryResponse => {
  const base = Array.isArray(raw) ? raw[0] : raw;
  const baseRecord = asRecord(base) ?? {};

  const playerA = buildPlayer(baseRecord, ["playerA", "player_a", "player_p", "p"], [
    "player_a",
    "playerA",
    "player_p",
    "p",
  ]);
  const playerB = buildPlayer(baseRecord, ["playerB", "player_b", "player_o", "o"], [
    "player_b",
    "playerB",
    "player_o",
    "o",
  ]);

  const h2hRecord =
    asRecord(baseRecord["h2h"]) ??
    asRecord(baseRecord["head_to_head"]) ??
    asRecord(baseRecord["h2h_stats"]) ??
    null;

  const wins =
    asNumber(h2hRecord?.["wins"]) ??
    asNumber(baseRecord["h2h_wins"]) ??
    asNumber(baseRecord["player_a_h2h_wins"]) ??
    0;
  const losses =
    asNumber(h2hRecord?.["losses"]) ??
    asNumber(baseRecord["h2h_losses"]) ??
    asNumber(baseRecord["player_a_h2h_losses"]) ??
    0;

  const lastMeeting =
    asString(h2hRecord?.["last_meeting"]) ??
    asString(baseRecord["last_meeting"]) ??
    asString(baseRecord["h2h_last_meeting"]);

  const metaRecord = asRecord(baseRecord["meta"]) ?? null;

  const lastSurface =
    asString(metaRecord?.["last_surface"]) ??
    asString(baseRecord["last_surface"]) ??
    asString(baseRecord["surface_last"]);
  const defendsRound =
    asString(metaRecord?.["defends_round"]) ??
    asString(baseRecord["defends_round"]) ??
    asString(baseRecord["defends"]);
  const courtSpeed =
    asNumber(metaRecord?.["court_speed"]) ??
    asNumber(baseRecord["court_speed"]) ??
    asNumber(baseRecord["speed"]);

  const extras = parseExtras(baseRecord);
  const tournament = parseTournament(baseRecord);

  // Priorizamos la probabilidad asociada explícitamente a playerA si existe,
  // y evitamos usar campos de display (nombres) como fuente numérica.
  const probabilityCandidates: Array<number | null> = [
    playerA.win_probability,
    asNumber(baseRecord["prob_player"]),
    asNumber(baseRecord["player_prob"]),
    asNumber(baseRecord["probability"]),
    asNumber((extras as any)?.ytd_wr_p),
  ];

  let probability: number | null = null;
  for (const candidate of probabilityCandidates) {
    const normalized = normalizeProbability(candidate);
    if (normalized !== null) {
      probability = normalized;
      break;
    }
  }

  return {
    prob_player: probability,
    playerA,
    playerB,
    h2h: {
      wins: wins ?? 0,
      losses: losses ?? 0,
      total: (wins ?? 0) + (losses ?? 0),
      last_meeting: lastMeeting,
    },
    last_surface: lastSurface,
    defends_round: defendsRound,
    court_speed: courtSpeed,
    tournament,
    extras,
  };
};

type PrematchRpcPayload = {
  player_a_id: number;
  player_b_id: number;
  p_tourney_id: string;
  p_year: number | string;
};

const extractYear = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const match = value.match(/\d{4}/);
    if (!match) return null;

    const parsed = Number.parseInt(match[0], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const isoFromString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/[\-\/T]/.test(trimmed)) return null;

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;

  return new Date(timestamp).toISOString().slice(0, 10);
};

const toIsoYear = (value: unknown, fallbackYear?: number): string | null => {
  const fromString = isoFromString(value);
  if (fromString) return fromString;

  if (typeof fallbackYear === "number" && Number.isFinite(fallbackYear)) {
    return `${fallbackYear}-01-01`;
  }

  return null;
};

const callExtendedPrematchSummary = async (payload: PrematchRpcPayload) => {
  console.log("🪵 Llamando get_extended_prematch_summary con:", payload);

  return supabase.rpc("get_extended_prematch_summary", payload);
};

export async function POST(req: Request) {
  const body = await req.json();
  const {
    playerA_id,
    playerB_id,
    tourney_id,
    year,
    playerA_name: playerANameInput,
    playerB_name: playerBNameInput,
    event_name: eventNameInput,
  } = body;

  const playerANameFromBody = sanitizeNameInput(playerANameInput);
  const playerBNameFromBody = sanitizeNameInput(playerBNameInput);
  const eventNameHint = sanitizeNameInput(eventNameInput);

  const normalizedYear = extractYear(year);
  const isoYearFromInput = isoFromString(year);
  const fallbackIsoYear = toIsoYear(year, normalizedYear ?? undefined);

  const preferIso = isoYearFromInput !== null;

  const primaryYear: number | string | null = preferIso
    ? isoYearFromInput
    : normalizedYear ?? fallbackIsoYear;

  if (!playerA_id || !playerB_id || !tourney_id || primaryYear === null) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
    });
  }

  const alternateYear: number | string | null = preferIso
    ? normalizedYear
    : isoYearFromInput ?? (fallbackIsoYear !== primaryYear ? fallbackIsoYear : null);

  const rpcPayload: PrematchRpcPayload = {
    player_a_id: playerA_id,
    player_b_id: playerB_id,
    p_tourney_id: String(tourney_id),
    p_year: primaryYear,
  };

  let { data, error } = await callExtendedPrematchSummary(rpcPayload);

  if (error && alternateYear !== null) {
    const retryCondition = preferIso
      ? error.message.includes("invalid input syntax for type integer") ||
        error.message.includes("date/time field value out of range")
      : error.message.includes("function pg_catalog.extract");

    if (retryCondition) {
      console.warn(
        preferIso
          ? "⚠️ Reintentando prematch con año entero tras rechazo del ISO"
          : "⚠️ Reintentando prematch con fecha ISO para evitar error de extract",
        {
          originalYear: year,
          normalizedYear,
          isoYear: fallbackIsoYear,
          alternateYear,
        },
      );

      const retry = await callExtendedPrematchSummary({
        ...rpcPayload,
        p_year: alternateYear,
      });

      if (!retry.error) {
        data = retry.data;
        error = null;
      } else if (
        (preferIso && !retry.error.message.includes("function pg_catalog.extract")) ||
        (!preferIso && !retry.error.message.includes("invalid input syntax for type integer"))
      ) {
        // Solo remplazamos el error original si el reintento devolvió un mensaje distinto;
        // de lo contrario, conservamos el error inicial para facilitar el diagnóstico.
        data = retry.data;
        error = retry.error;
      } else {
        console.warn(
          preferIso
            ? "⚠️ Reintento con año entero rechazado por el RPC"
            : "⚠️ Reintento con fecha ISO rechazado por el RPC (esperaba entero)",
          {
            alternateYear,
            retryError: retry.error.message,
          },
        );
      }
    }
  }

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const formatted = formatPrematchSummary(data);
  const tourneyIdRaw = body?.tourney_id;
  const tourneyIdBase =
    typeof tourneyIdRaw === "string" && tourneyIdRaw.includes("-")
      ? tourneyIdRaw.split("-")[1] ?? tourneyIdRaw
      : typeof tourneyIdRaw === "string"
        ? tourneyIdRaw
        : null;

  if (tourneyIdBase) {
    const { data: speedData, error: speedError } = await supabase
      .schema("estratego_v1")
      .from("court_speed_ranking_norm")
      .select("speed_rank,surface_reported")
      .eq("tourney_id", tourneyIdBase)
      .maybeSingle();

    if (!speedError && speedData) {
      const speedRank =
        typeof speedData.speed_rank === "number" ? speedData.speed_rank : Number(speedData.speed_rank ?? NaN);
      formatted.court_speed_rank = Number.isFinite(speedRank) ? speedRank : null;
      formatted.surface_reported =
        typeof speedData.surface_reported === "string" && speedData.surface_reported.trim() !== ""
          ? speedData.surface_reported
          : null;

      if (formatted.court_speed == null && Number.isFinite(speedRank)) {
        formatted.court_speed = speedRank;
      }
    }
  }

  if (ODDS_API_KEY) {
    let playerAName = playerANameFromBody ?? formatted.extras?.display_p ?? null;
    let playerBName = playerBNameFromBody ?? formatted.extras?.display_o ?? null;

    if (!playerAName) {
      const parsedId = Number(playerA_id);
      if (Number.isFinite(parsedId)) {
        playerAName = await fetchPlayerDisplayName(parsedId);
      }
    }

    if (!playerBName) {
      const parsedId = Number(playerB_id);
      if (Number.isFinite(parsedId)) {
        playerBName = await fetchPlayerDisplayName(parsedId);
      }
    }

    const playerAProbability = normalizeProbability(
      formatted.playerA.win_probability ?? formatted.prob_player ?? null,
    );
    const playerBProbability = normalizeProbability(
      formatted.playerB.win_probability ??
        (playerAProbability != null ? 1 - playerAProbability : formatted.prob_player != null ? 1 - formatted.prob_player : null),
    );

    try {
      const odds = await fetchMatchOdds({
        playerAName,
        playerBName,
        tournament: formatted.tournament ?? null,
        extras: formatted.extras ?? null,
        eventNameHint,
        playerAProbability,
        playerBProbability,
      });
      if (odds) {
        formatted.odds = odds;
      }
    } catch (err) {
      console.warn("Failed to attach odds information", err);
    }
  }

  if (!formatted.odds && BETFAIR_APP_KEY && BETFAIR_SESSION_TOKEN) {
    try {
      const bfOdds = await fetchBetfairOdds(
        playerANameFromBody ?? formatted.extras?.display_p ?? playerANameInput ?? "",
        playerBNameFromBody ?? formatted.extras?.display_o ?? playerBNameInput ?? "",
        formatted.tournament?.name ?? null,
      );
      if (bfOdds) {
        formatted.odds = bfOdds;
      }
    } catch (err) {
      console.warn("[betfair] fallback odds failed", err);
    }
  }

  return new Response(JSON.stringify(formatted), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}






