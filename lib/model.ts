// radar-3-curve: the token-launch value model for token-radar-01 v2.
//
// Every constant the model uses is fitted from the snapshot at run time:
// a log-log size curve on traded-token comparables, shrunk family effects,
// a 2-week growth projection, a shrunk seasoning factor and a sibling
// factor. No protocol name is ever special-cased; the same function
// scores every row. Standard library only, deterministic, no network.

export interface Proto {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Proto[];
  watchlist: string[];
}

export interface Comp {
  slug: string;
  name: string;
  category: string | null;
  family: string;
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  age_days: number | null;
  listed_at: string | null;
}

export interface CurveFit {
  a: number;
  b: number;
  r2: number;
  n: number;
}

export interface FamilyEffect {
  effect: number;
  n: number;
}

export interface Backtest {
  loo: { median_miss: number; within3: number; within2: number };
  loo_curve: { median_miss: number; within3: number; within2: number };
  loo_flat: { median_miss: number; within3: number; within2: number };
  time_split: { median_miss: number; within3: number; n_train: number; n_test: number };
  time_split_flat: { median_miss: number; within3: number };
  band: { p10: number; p90: number; coverage: number };
  factor_check: { r_growth: number; r_age: number };
  loo_points: Array<[number, number]>;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  family: string;
  mechanism: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  p10_usd: number;
  p90_usd: number;
  p25_usd: number;
  p75_usd: number;
  token_status: 'pre-token';
  watchlist: boolean;
  sibling: boolean;
  early: boolean;
  model: {
    curve_value_usd: number;
    family_effect: number;
    family_peer_count: number;
    growth_pct: number;
    projected_tvl_usd: number;
    seasoning: number;
    sibling_factor: number;
  };
  econ: {
    slice_usd: number;
    fees_usd: number;
    tbill_usd: number;
    net_usd: number;
    verdict: 'FARM' | 'THIN' | 'SKIP';
    work_minutes: number;
    per_hour_usd: number;
    pays_from_usd: number | null;
  };
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  fdv_tvl: number | null;
}

export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

export interface ModelOutput {
  rows: BoardRow[];
  live_rows: LiveRow[];
  aside_rows: AsideRow[];
  aside_counts: Record<string, number>;
  aside_total: number;
  comps: Array<{ tvl_usd: number; mcap_usd: number; name: string; family: string }>;
  curve: CurveFit;
  families: Record<string, FamilyEffect>;
  seasoning: { coef_fitted: number; coef_used: number };
  quantiles: { q10: number; q25: number; q75: number; q90: number };
  backtest: Backtest;
  totals: {
    protocols_scanned: number;
    ranked: number;
    watchlist: number;
    set_aside: number;
    live: number;
    total_implied_usd: number;
    median_implied_usd: number;
    watchlist_total: number;
    verdicts: { farm: number; thin: number; skip: number };
  };
}

// ---------------------------------------------------------------- tables

export const MODEL_VERSION = 'radar-3-curve';

const FAMILY_OF: Record<string, string> = {
  'Risk Curators': 'Vaults',
  'Onchain Capital Allocator': 'Vaults',
  'Yield Aggregator': 'Vaults',
  'Liquidity Manager': 'Vaults',
  'Collateral Management': 'Vaults',
  'CDP Manager': 'Vaults',
  Lending: 'Lending',
  CDP: 'Lending',
  'Uncollateralized Lending': 'Lending',
  'Leveraged Farming': 'Lending',
  'Collateral Markets': 'Lending',
  'Anchor BTC': 'Lending',
  'Decentralized BTC': 'Lending',
  Dexs: 'Trading',
  Derivatives: 'Trading',
  'Basis Trading': 'Trading',
  Options: 'Trading',
  'Options Vault': 'Trading',
  'Prediction Market': 'Trading',
  'OTC Marketplace': 'Trading',
  Privacy: 'Trading',
  'NFT Marketplace': 'Trading',
  'Interest Rate Derivatives': 'Trading',
  RWA: 'RWA',
  Indexes: 'RWA',
  'Liquid Staking': 'Staking',
  'Liquid Restaking': 'Staking',
  Restaking: 'Staking',
  'Staking Pool': 'Staking',
  'Restaked BTC': 'Staking',
  'Token Locker': 'Staking',
  Chain: 'Infra',
  'AI Agents': 'Infra',
  'Decentralized AI': 'Infra',
  Bridge: 'Infra',
  'Canonical Bridge': 'Infra',
  'Cross Chain Bridge': 'Infra',
  'Dual-Token Stablecoin': 'Stable',
  'Stablecoin Wrapper': 'Stable',
  Payments: 'Stable',
  'Crypto Card Issuer': 'Stable',
  Yield: 'Yield',
  CEX: 'CEX',
};

export const FAMILIES = ['Trading', 'Lending', 'Staking', 'RWA', 'Vaults', 'Yield', 'CEX', 'Infra', 'Stable', 'Other'];

const MECHANISM_OF: Record<string, string> = {
  'Risk Curators': 'Vault curation',
  'Onchain Capital Allocator': 'Vault curation',
  'Yield Aggregator': 'Vault curation',
  'Liquidity Manager': 'Vault curation',
  'Collateral Management': 'Vault curation',
  'CDP Manager': 'Vault curation',
  Lending: 'Supply and borrow',
  'Uncollateralized Lending': 'Supply and borrow',
  CDP: 'Collateralised debt',
  'Collateral Markets': 'Collateralised debt',
  Dexs: 'Liquidity pool',
  Derivatives: 'Derivatives',
  'Interest Rate Derivatives': 'Derivatives',
  'Basis Trading': 'Basis vault',
  RWA: 'Real-world yield',
  Indexes: 'Index',
  Yield: 'Yield vault',
  'Staking Pool': 'Staking',
  Restaking: 'Staking',
  Chain: 'Chain activity',
  Payments: 'Payments',
  'Crypto Card Issuer': 'Payments',
  Privacy: 'Private transaction',
  Insurance: 'Cover',
  'Governance Incentives': 'Lock and vote',
  Launchpad: 'Launch allocation',
  Farm: 'Farm',
  CeDeFi: 'CeDeFi vault',
  'Dual-Token Stablecoin': 'Mint and save',
  'Stablecoin Wrapper': 'Mint and save',
  'OTC Marketplace': 'OTC trade',
  'Anchor BTC': 'BTC yield',
  'Decentralized BTC': 'BTC yield',
  'Prediction Market': 'Prediction',
  Options: 'Options vault',
  'Options Vault': 'Options vault',
  'Leveraged Farming': 'Leveraged farm',
};

// Gas per transaction in USD (estimates); any chain not listed costs $0.50.
export const GAS_USD: Record<string, number> = {
  Ethereum: 4.0,
  Solana: 0.01,
  Base: 0.05,
  Arbitrum: 0.1,
  Optimism: 0.1,
  Binance: 0.15,
  Polygon: 0.02,
  Avalanche: 0.3,
  Sui: 0.02,
  Monad: 0.01,
  'Hyperliquid L1': 0.01,
  Berachain: 0.05,
  Sonic: 0.02,
  Sei: 0.01,
  Mantle: 0.05,
  Linea: 0.05,
  Scroll: 0.1,
  Blast: 0.05,
  Gnosis: 0.05,
  Fantom: 0.05,
  Tron: 0.5,
  Bitcoin: 2.0,
};

const NATIVE_OF: Record<string, string> = {
  Ethereum: 'ETH',
  Solana: 'SOL',
  Base: 'ETH',
  Arbitrum: 'ETH',
  Optimism: 'ETH',
  Binance: 'BNB',
  Polygon: 'POL',
  Avalanche: 'AVAX',
  Sui: 'SUI',
  Monad: 'MON',
  'Hyperliquid L1': 'HYPE',
  Berachain: 'BERA',
  Sonic: 'S',
  Sei: 'SEI',
  Mantle: 'MNT',
  Linea: 'ETH',
  Scroll: 'ETH',
  Blast: 'ETH',
  Gnosis: 'xDAI',
  Fantom: 'FTM',
  Tron: 'TRX',
  Bitcoin: 'BTC',
};

// Core-play verbs (steps 3 and 4) by mechanism; {chain} is the plan chain.
const CORE_PLAY: Record<string, [string, string]> = {
  'Vault curation': [
    "Deposit $1,000 into a curator vault on {chain} in the vault's base asset.",
    'Allocate $100 to a second curator vault — another chain or another mandate — so the wallet appears in two of the protocol\u2019s own accounting snapshots instead of one.',
  ],
  'Supply and borrow': [
    'Supply $1,000 of collateral on {chain}.',
    'Borrow a small amount against it, then repay it, so the wallet has used both sides of the market.',
  ],
  'Collateralised debt': [
    'Lock $1,000 of collateral on {chain}.',
    "Mint the protocol's stable asset against it, then hold the position.",
  ],
  'Liquidity pool': [
    "Swap $100 on {chain} to learn the pool's price impact.",
    'Provide $900 of liquidity to a pool and hold the LP position.',
  ],
  Derivatives: [
    'Open a small position on {chain} with $200 of margin.',
    'Open a second, different position with $200 more.',
  ],
  'Basis vault': [
    'Deposit $1,000 into the basis vault on {chain}.',
    'Add $100 to a second basis position.',
  ],
  'Real-world yield': [
    'Mint or buy $1,000 of the tokenized asset on {chain}.',
    'Hold it in the protocol for the full 90 days.',
  ],
  Index: [
    'Buy $1,000 of the index on {chain}.',
    'Add $100 in a second index position.',
  ],
  'Yield vault': [
    'Deposit $1,000 into the yield vault on {chain}.',
    'Deposit $100 into a second vault or strategy.',
  ],
  Staking: [
    'Stake $1,000 on {chain}.',
    'Stake a second $100 tranche a week later.',
  ],
  'Chain activity': [
    'Bridge $100 to {chain}.',
    'Use a native app on the chain with the bridged funds.',
  ],
  Payments: [
    'Make a $100 payment through the protocol on {chain}.',
    'Set up a second, recurring payment.',
  ],
  'Private transaction': [
    'Use a private transaction for $100 on {chain}.',
    'Repeat with a second asset.',
  ],
  Cover: [
    'Buy $1,000 of cover on {chain}.',
    'Top up cover by $100.',
  ],
  'Lock and vote': [
    'Lock $1,000 or vote in the current round on {chain}.',
    'Vote in a second round.',
  ],
  'Launch allocation': [
    'Join a launch allocation with $1,000 on {chain}.',
    'Join a second allocation.',
  ],
  Farm: [
    'Deposit $1,000 into the farm on {chain}.',
    'Add $100 to a second farm.',
  ],
  'CeDeFi vault': [
    'Deposit $1,000 into the CeDeFi vault on {chain}.',
    'Add a second $100 position.',
  ],
  'Mint and save': [
    'Mint $1,000 of the stable asset on {chain}.',
    'Save it in the protocol for the full 90 days.',
  ],
  'OTC trade': [
    'Place a small OTC trade of $100 on {chain}.',
    'Place a second OTC trade.',
  ],
  'BTC yield': [
    'Deposit $1,000 of BTC on {chain}.',
    'Add a second $100 BTC position.',
  ],
  Prediction: [
    'Place a $100 prediction on {chain}.',
    'Place a second prediction on a different market.',
  ],
  'Options vault': [
    'Buy a $100 option on {chain}.',
    'Buy a second, different option.',
  ],
  'Leveraged farm': [
    'Open a leveraged farm position with $200 on {chain}.',
    'Open a second leveraged position with $200 more.',
  ],
  'Protocol use': [
    'Deposit $1,000 into the protocol on {chain}.',
    'Use a second feature of the protocol with $100.',
  ],
};

// Risk triggers (step 6) by mechanism group.
function riskTrigger(mechanism: string): string {
  if (['Vault curation', 'Yield vault', 'CeDeFi vault', 'Staking'].includes(mechanism)) {
    return "Redeem if the share price falls 3% while the vault's asset is flat, or the vault loses a quarter of its TVL in a week.";
  }
  if (['Supply and borrow', 'Collateralised debt', 'BTC yield'].includes(mechanism)) {
    return 'Unwind if the borrow rate sits above the supply yield for a week, or collateral value falls a quarter.';
  }
  if (mechanism === 'Basis vault') {
    return 'Redeem if funding stays negative for a week or the backing report shows less than 100%.';
  }
  if (['Liquidity pool', 'Derivatives', 'Options vault', 'Leveraged farm', 'Prediction'].includes(mechanism)) {
    return 'Exit if the pool or market loses half its TVL in a week, or fees dry up for two weeks.';
  }
  return 'Exit if TVL falls by a quarter in a week or the team goes silent for a month.';
}

// ---------------------------------------------------------------- helpers

export function familyOf(category: string | null): string {
  if (category === null) return 'Other';
  return FAMILY_OF[category] ?? 'Other';
}

export function mechanismOf(category: string | null): string {
  if (category === null) return 'Protocol use';
  return MECHANISM_OF[category] ?? 'Protocol use';
}

export function gasOf(chain: string): number {
  return GAS_USD[chain] ?? 0.5;
}

export function nativeOf(chain: string): string {
  return NATIVE_OF[chain] ?? 'its native token';
}

/** The cheapest of the protocol's chains; ties keep the first-listed chain. */
export function planChain(chains: string[]): string {
  let best = chains[0] ?? 'Ethereum';
  let bestGas = gasOf(best);
  for (const c of chains) {
    const g = gasOf(c);
    if (g < bestGas) {
      best = c;
      bestGas = g;
    }
  }
  return best;
}

const VERSION_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD_RE = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** First word of a name, lowercased, split on whitespace, hyphen, colon or parens. */
export function firstWord(name: string): string {
  const parts = name.toLowerCase().split(/[\s\-:()]+/).filter((w) => w.length > 0);
  return parts[0] ?? '';
}

function parseDay(s: string): number {
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
  return Date.UTC(y, m - 1, d);
}

/** Whole days from listed_at to the snapshot's as_of; null when unlisted. */
export function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  return Math.round((parseDay(asOf) - parseDay(listedAt)) / 86400000);
}

export function isLive(p: Proto): boolean {
  return p.gecko_id !== null || p.symbol !== null || p.mcap_usd !== null;
}

const SET_ASIDE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/**
 * The set-aside reason for a pre-token protocol, or null when it is rankable.
 * Rules apply in order; the first match wins.
 */
export function asideReason(p: Proto, liveFirstWords: Set<string>, onWatchlist: boolean): string | null {
  if (p.category !== null && SET_ASIDE_CATEGORIES.has(p.category)) {
    if (p.category === 'CEX') return 'Centralized exchange';
    if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'Wrapped / bridged product';
    return 'Liquid staking product';
  }
  if (p.category !== null && /bridge/i.test(p.category)) return 'Wrapped / bridged product';
  if (WRAPPED_WORD_RE.test(p.name)) return 'Wrapped / bridged product';
  if (VERSION_RE.test(p.name)) return 'Versioned release';
  if (EXCHANGE_RE.test(p.name)) return 'Centralized exchange';
  if (!onWatchlist && liveFirstWords.has(firstWord(p.name))) return 'Sibling of a traded token';
  return null;
}

// Ordinary least squares with intercept: y = a + b*x. Returns intercept, slope, R^2.
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const r = ys[i]! - (a + b * xs[i]!);
    ssRes += r * r;
  }
  const r2 = syy === 0 ? 0 : 1 - ssRes / syy;
  return { a, b, r2 };
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const n = s.length;
  if (n === 0) return NaN;
  // Upper-middle median: the element at index floor(n/2). For odd n this
  // is the ordinary median; for even n it takes the upper of the two
  // middle values rather than their average.
  return s[Math.floor(n / 2)]!;
}

/** Nearest-rank percentile of a sorted array, p in (0, 1): the ceil(p*n)-th value. */
function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  return sortedAsc[Math.max(0, Math.ceil(p * n) - 1)]!;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

const LOG100M = 8; // log10($100M)
const SHRINK_K = 4; // family-effect shrinkage prior strength
const SEASON_SHRINK = 0.5; // seasoning coefficient shrunk 50% toward zero

function curveValue(tvl: number, fit: { a: number; b: number }): number {
  return Math.pow(10, fit.a + fit.b * (Math.log10(tvl) - LOG100M));
}

/** Shrunk family effects from a set of comparables under a fitted curve. */
function fitFamilies(comps: Comp[], fit: { a: number; b: number }): Record<string, FamilyEffect> {
  const sums: Record<string, { sum: number; n: number }> = {};
  for (const c of comps) {
    const resid = Math.log10(c.mcap_usd) - Math.log10(curveValue(c.tvl_usd, fit));
    const acc = sums[c.family] ?? { sum: 0, n: 0 };
    acc.sum += resid;
    acc.n += 1;
    sums[c.family] = acc;
  }
  const out: Record<string, FamilyEffect> = {};
  for (const fam of FAMILIES) {
    const acc = sums[fam];
    if (!acc || acc.n === 0) {
      out[fam] = { effect: 1, n: 0 };
    } else {
      out[fam] = { effect: Math.pow(10, (acc.n / (acc.n + SHRINK_K)) * (acc.sum / acc.n)), n: acc.n };
    }
  }
  return out;
}

function fitCurve(comps: Comp[]): CurveFit {
  const xs = comps.map((c) => Math.log10(c.tvl_usd) - LOG100M);
  const ys = comps.map((c) => Math.log10(c.mcap_usd));
  const { a, b, r2 } = ols(xs, ys);
  return { a, b, r2, n: comps.length };
}

interface MissStats {
  median_miss: number;
  within3: number;
  within2: number;
}

function missStats(logErrors: number[]): MissStats {
  const abs = logErrors.map((e) => Math.abs(e));
  const med = median(abs);
  const n = abs.length;
  const within = (mult: number): number => {
    const lim = Math.log10(mult);
    return n === 0 ? 0 : abs.filter((e) => e <= lim).length / n;
  };
  return { median_miss: Math.pow(10, med), within3: within(3), within2: within(2) };
}

const roundCents = (v: number): number => Math.round(v * 100) / 100;
const roundUp100 = (v: number): number => Math.max(100, Math.ceil(v / 100) * 100);

const CAPITAL_USD = 1000;
const HOLD_DAYS = 90;
const TBILL_RATE = 0.04;
const AIRDROP_SHARE = 0.1;
const TX_COUNT = 7;
const WORK_MINUTES = 140;

function money(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildFarmSteps(name: string, mechanism: string, chain: string, sliceUsd: number): string[] {
  const native = nativeOf(chain);
  const [core, second] = CORE_PLAY[mechanism] ?? CORE_PLAY['Protocol use']!;
  const fill = (s: string): string => s.replaceAll('{chain}', chain);
  return [
    `Fund a fresh wallet on ${chain} with $1,000 of USDC and some ${native} for gas, so the position is easy to track.`,
    `Reach ${name} from its DefiLlama listing, not a search ad. Check the contracts, the audits and whether a points page exists.`,
    fill(core),
    fill(second),
    'Each week for 13 weeks, check the points page and the position in about 5 minutes, and track the protocol\u2019s own announcements for points or quests if the protocol runs one.',
    riskTrigger(mechanism),
    `If a token launches, claim only from the official app. At the implied value a 10% drop pro rata to TVL pays this position about $${money(sliceUsd)}.`,
    'Withdraw after 90 days or the claim. Idle dollars here forgo 4% a year in T-bills.',
  ];
}

/**
 * The capital at which farming turns net-positive, or null when it never
 * beats a T-bill. Closed form first; exact bisection when the closed form
 * lands past a tenth of TVL; capped at $100,000.
 */
function paysFrom(fees: number, implied: number, tvl: number): number | null {
  const tbillPerDollar = TBILL_RATE * (HOLD_DAYS / 365);
  const denom = (AIRDROP_SHARE * implied) / tvl - tbillPerDollar;
  if (denom <= 0) return null;
  const closed = fees / denom;
  const netAt = (c: number): number =>
    (c / (tvl + c)) * AIRDROP_SHARE * implied - fees - c * tbillPerDollar;
  if (closed <= tvl / 10) return Math.min(100000, roundUp100(closed));
  // Exact solve by bisection on [$100, $1M]; net is concave in c, so with
  // net($100) < 0 < net($1M) there is exactly one crossing in between.
  if (netAt(100) >= 0) return 100;
  if (netAt(1000000) <= 0) return null;
  let lo = 100;
  let hi = 1000000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (netAt(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return Math.min(100000, roundUp100(hi));
}

// ---------------------------------------------------------------- build

export function buildModel(snapshot: Snapshot): ModelOutput {
  const asOf = snapshot.as_of;
  const watchlist = new Set(snapshot.watchlist);
  const protocols = snapshot.protocols;

  const live = protocols.filter(isLive);
  const liveFirstWords = new Set(live.map((p) => firstWord(p.name)));

  // --- comparables: live tokens with mcap and TVL, merged by token -------
  const groups = new Map<string, Proto[]>();
  for (const p of live) {
    if (!(p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)) continue;
    const key = p.gecko_id ?? p.symbol ?? p.slug;
    const g = groups.get(key) ?? [];
    g.push(p);
    groups.set(key, g);
  }
  const comps: Comp[] = [];
  for (const g of groups.values()) {
    const rep = g[0]!;
    if (rep.category !== null && /bridge/i.test(rep.category)) continue;
    if (VERSION_RE.test(rep.name)) continue;
    const tvl = g.reduce((s, p) => s + p.tvl_usd, 0);
    const mcap = Math.max(...g.map((p) => p.mcap_usd!));
    const ratio = mcap / tvl;
    if (ratio < 0.002 || ratio > 50) continue;
    comps.push({
      slug: rep.slug,
      name: rep.name,
      category: rep.category,
      family: familyOf(rep.category),
      tvl_usd: tvl,
      mcap_usd: mcap,
      change_7d: rep.change_7d,
      age_days: ageDays(rep.listed_at, asOf),
      listed_at: rep.listed_at,
    });
  }
  comps.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (comps.length === 0) throw new Error('no comparables: no live token with mcap and TVL');

  // --- size curve + family effects --------------------------------------
  const curve = fitCurve(comps);
  const families = fitFamilies(comps, curve);

  // --- seasoning: regress curve+family residuals on log10(age), shrunk ---
  const seasonXs: number[] = [];
  const seasonYs: number[] = [];
  for (const c of comps) {
    if (c.age_days === null || c.age_days < 1) continue;
    const resid =
      Math.log10(c.mcap_usd) -
      Math.log10(curveValue(c.tvl_usd, curve)) -
      Math.log10(families[c.family]!.effect);
    seasonXs.push(Math.log10(c.age_days));
    seasonYs.push(resid);
  }
  const seasonFit = ols(seasonXs, seasonYs);
  const coefFitted = seasonFit.b;
  const coefUsed = coefFitted * SEASON_SHRINK;
  const LOG_YEAR = Math.log10(365);

  const seasoningOf = (age: number | null): number => {
    if (age === null || age < 1) return 1;
    const f = Math.pow(10, coefUsed * (Math.log10(age) - LOG_YEAR));
    return Math.min(1.15, Math.max(0.8, f));
  };

  // --- leave-one-out backtests -------------------------------------------
  const looLogErr: number[] = [];
  const looCurveLogErr: number[] = [];
  const looFlatLogErr: number[] = [];
  const looRatios: number[] = [];
  const looPoints: Array<[number, number]> = [];
  const factorGrowthX: number[] = [];
  const factorGrowthY: number[] = [];
  const factorAgeX: number[] = [];
  const factorAgeY: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const held = comps[i]!;
    const rest = comps.filter((_, j) => j !== i);
    const fit = fitCurve(rest);
    const fams = fitFamilies(rest, fit);
    const predCurve = curveValue(held.tvl_usd, fit);
    const pred = predCurve * fams[held.family]!.effect;
    const logErr = Math.log10(held.mcap_usd) - Math.log10(pred);
    const curveLogErr = Math.log10(held.mcap_usd) - Math.log10(predCurve);
    looLogErr.push(logErr);
    looCurveLogErr.push(curveLogErr);
    looRatios.push(held.mcap_usd / pred);
    looPoints.push([pred, held.mcap_usd]);
    const flatMed = median(rest.map((c) => c.mcap_usd / c.tvl_usd));
    looFlatLogErr.push(Math.log10(held.mcap_usd) - Math.log10(held.tvl_usd * flatMed));
    if (held.change_7d !== null) {
      factorGrowthX.push(held.change_7d);
      factorGrowthY.push(curveLogErr);
    }
    if (held.age_days !== null && held.age_days >= 1) {
      factorAgeX.push(Math.log10(held.age_days));
      factorAgeY.push(curveLogErr);
    }
  }
  looPoints.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ratiosSorted = [...looRatios].sort((a, b) => a - b);
  const q10 = percentile(ratiosSorted, 0.1);
  const q25 = percentile(ratiosSorted, 0.25);
  const q75 = percentile(ratiosSorted, 0.75);
  const q90 = percentile(ratiosSorted, 0.9);
  const bandCoverage = looRatios.filter((r) => r >= q10 && r <= q90).length / looRatios.length;

  // --- time split: fit pre-2024, test 2024+ ------------------------------
  const train = comps.filter((c) => c.listed_at !== null && c.listed_at < '2024-01-01');
  const test = comps.filter((c) => c.listed_at !== null && c.listed_at >= '2024-01-01');
  const tsFit = fitCurve(train);
  const tsFams = fitFamilies(train, tsFit);
  const tsFlatMed = median(train.map((c) => c.mcap_usd / c.tvl_usd));
  const tsErr: number[] = [];
  const tsFlatErr: number[] = [];
  for (const c of test) {
    const pred = curveValue(c.tvl_usd, tsFit) * tsFams[c.family]!.effect;
    tsErr.push(Math.log10(c.mcap_usd) - Math.log10(pred));
    tsFlatErr.push(Math.log10(c.mcap_usd) - Math.log10(c.tvl_usd * tsFlatMed));
  }
  const tsStats = missStats(tsErr);
  const tsFlatStats = missStats(tsFlatErr);

  const backtest: Backtest = {
    loo: missStats(looLogErr),
    loo_curve: missStats(looCurveLogErr),
    loo_flat: missStats(looFlatLogErr),
    time_split: { ...tsStats, n_train: train.length, n_test: test.length },
    time_split_flat: { median_miss: tsFlatStats.median_miss, within3: tsFlatStats.within3 },
    band: { p10: q10, p90: q90, coverage: bandCoverage },
    factor_check: { r_growth: pearson(factorGrowthX, factorGrowthY), r_age: pearson(factorAgeX, factorAgeY) },
    loo_points: looPoints,
  };

  // --- rankable rows, set-aside rows, live rows --------------------------
  const rows: BoardRow[] = [];
  const asideRows: AsideRow[] = [];
  const asideCounts: Record<string, number> = {};
  const tbillUsd = roundCents(CAPITAL_USD * TBILL_RATE * (HOLD_DAYS / 365));

  for (const p of protocols) {
    if (isLive(p)) continue;
    const onWatchlist = watchlist.has(p.slug);
    const reason = asideReason(p, liveFirstWords, onWatchlist);
    if (reason !== null) {
      asideRows.push({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, reason });
      asideCounts[reason] = (asideCounts[reason] ?? 0) + 1;
      continue;
    }
    const family = familyOf(p.category);
    const fam = families[family]!;
    const growth = p.change_7d === null ? 0 : Math.min(30, Math.max(-30, p.change_7d));
    const projectedTvl = p.tvl_usd * Math.pow(1 + growth / 100, 2);
    const curveVal = curveValue(projectedTvl, curve);
    const age = ageDays(p.listed_at, asOf);
    const seasoning = seasoningOf(age);
    const isSibling = liveFirstWords.has(firstWord(p.name));
    const siblingFactor = isSibling ? 0.5 : 1;
    const implied = Math.max(1, Math.round(curveVal * fam.effect * seasoning * siblingFactor));
    const mechanism = mechanismOf(p.category);
    const chain = planChain(p.chains);
    const gas = gasOf(chain);
    // The $2 bridge allowance pays to move funds onto the cheapest chain:
    // it applies when the plan chain is not Ethereum and the protocol spans
    // more than one chain. A single-chain protocol is funded directly on
    // its only chain, so no bridge is needed.
    const bridge = chain !== 'Ethereum' && p.chains.length > 1 ? 2 : 0;
    const fees = roundCents(TX_COUNT * gas + bridge);
    const slice = roundCents((CAPITAL_USD / (p.tvl_usd + CAPITAL_USD)) * AIRDROP_SHARE * implied);
    const net = roundCents(slice - fees - tbillUsd);
    const verdict = net > 0 ? 'FARM' : slice > fees ? 'THIN' : 'SKIP';
    rows.push({
      rank: 0,
      slug: p.slug,
      name: p.name,
      category: p.category,
      family,
      mechanism,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: null,
      listed_at: p.listed_at,
      age_days: age,
      implied_value_usd: implied,
      p10_usd: Math.max(1, Math.round(implied * q10)),
      p90_usd: Math.max(1, Math.round(implied * q90)),
      p25_usd: Math.max(1, Math.round(implied * q25)),
      p75_usd: Math.max(1, Math.round(implied * q75)),
      token_status: 'pre-token',
      watchlist: onWatchlist,
      sibling: isSibling,
      early: age !== null && age < 180,
      model: {
        curve_value_usd: curveVal,
        family_effect: fam.effect,
        family_peer_count: fam.n,
        growth_pct: growth,
        projected_tvl_usd: projectedTvl,
        seasoning,
        sibling_factor: siblingFactor,
      },
      econ: {
        slice_usd: slice,
        fees_usd: fees,
        tbill_usd: tbillUsd,
        net_usd: net,
        verdict,
        work_minutes: WORK_MINUTES,
        per_hour_usd: roundCents(net / (WORK_MINUTES / 60)),
        pays_from_usd: paysFrom(fees, implied, p.tvl_usd),
      },
      farm_steps: buildFarmSteps(p.name, mechanism, chain, slice),
    });
  }

  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  asideRows.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));

  const liveRows: LiveRow[] = live
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || (a.slug < b.slug ? -1 : 1))
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      fdv_tvl: p.tvl_usd > 0 ? p.mcap_usd! / p.tvl_usd : null,
    }));

  const impliedValues = rows.map((r) => r.implied_value_usd);
  const verdicts = { farm: 0, thin: 0, skip: 0 };
  for (const r of rows) {
    if (r.econ.verdict === 'FARM') verdicts.farm++;
    else if (r.econ.verdict === 'THIN') verdicts.thin++;
    else verdicts.skip++;
  }

  return {
    rows,
    live_rows: liveRows,
    aside_rows: asideRows.slice(0, 40),
    aside_counts: asideCounts,
    aside_total: asideRows.length,
    comps: comps.map((c) => ({ tvl_usd: c.tvl_usd, mcap_usd: c.mcap_usd, name: c.name, family: c.family })),
    curve,
    families,
    seasoning: { coef_fitted: coefFitted, coef_used: coefUsed },
    quantiles: { q10, q25, q75, q90 },
    backtest,
    totals: {
      protocols_scanned: protocols.length,
      ranked: rows.length,
      watchlist: rows.filter((r) => r.watchlist).length,
      set_aside: asideRows.length,
      live: live.length,
      total_implied_usd: impliedValues.reduce((s, v) => s + v, 0),
      median_implied_usd: median(impliedValues),
      watchlist_total: snapshot.watchlist.length,
      verdicts,
    },
  };
}

export { CAPITAL_USD, HOLD_DAYS, TBILL_RATE, AIRDROP_SHARE, TX_COUNT, WORK_MINUTES };
