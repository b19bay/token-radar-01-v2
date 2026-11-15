'use strict';
/* Launch Radar dashboard. Everything renders from window.RADAR (data.js);
   no network, no fetch, works from file://. One model prices the page
   and board.json: the rows below are the board rows. */
const D = window.RADAR;
const META = D.meta, ROWS = D.rows, COMPS = D.comps;
const T = META.totals, BT = META.backtest, CV = META.curve;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x, d) => (x * 100).toFixed(d === undefined ? 0 : d) + '%';

/* ---- formatting ---- */
const trim2 = (x) => String(Math.round(x * 100) / 100);
function abbr(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + trim2(v / 1e9) + 'B';
  if (a >= 1e6) return '$' + trim2(v / 1e6) + 'M';
  if (a >= 1e3) return '$' + trim2(v / 1e3) + 'K';
  return '$' + Math.round(v);
}
const full = (v) => '$' + Math.round(v).toLocaleString('en-US');
const c2 = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sgn2 = (v) => (v < 0 ? '-' : '+') + c2(Math.abs(v));
function ageFmt(d) {
  if (d === null || d === undefined) return 'n/a';
  return d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd';
}
function chgFmt(v) {
  if (v === null || v === undefined) return '<span class="mut">n/a</span>';
  const cls = v > 0 ? 'teal' : v < 0 ? 'red' : 'mut';
  return '<span class="' + cls + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>';
}
function verdictHtml(v) {
  return '<span class="' + (v === 'FARM' ? 'teal' : v === 'THIN' ? 'amb' : 'red') + '"><b>' + v + '</b></span>';
}

/* ---- economics: recompute a row at any capital / airdrop share ---- */
function gasOf(c) { return META.gas_usd[c] === undefined ? 0.5 : META.gas_usd[c]; }
function planChain(r) {
  let best = r.chains[0], g = gasOf(best);
  for (const c of r.chains) if (gasOf(c) < g) { best = c; g = gasOf(c); }
  return best;
}
function econAt(r, cap, share) {
  if (cap === 1000 && share === 0.1) return r.econ;
  const slice = (cap / (r.tvl_usd + cap)) * share * r.implied_value_usd;
  const fees = r.econ.fees_usd;
  const tbill = cap * 0.04 * 90 / 365;
  const net = slice - fees - tbill;
  return {
    slice_usd: Math.round(slice * 100) / 100, fees_usd: fees,
    tbill_usd: Math.round(tbill * 100) / 100, net_usd: Math.round(net * 100) / 100,
    verdict: net > 0 ? 'FARM' : slice > fees ? 'THIN' : 'SKIP',
    work_minutes: 140, per_hour_usd: Math.round(net / (140 / 60) * 100) / 100,
    pays_from_usd: r.econ.pays_from_usd,
  };
}

/* ---- state + hash deep links ---- */
const S = { tab: 'board', q: '', fam: '', cat: '', chain: '', verdict: '', tier: '', minTvl: 0, capital: 1000, share: 0.1, sort: 'implied', detail: '' };
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const tab = h.get('tab');
  if (tab && ['board', 'trades', 'aside', 'method'].includes(tab)) S.tab = tab;
  if (h.get('detail')) S.detail = h.get('detail');
  if (h.get('fam')) S.fam = h.get('fam');
  if (h.get('cat')) S.cat = h.get('cat');
  if (h.get('chain')) S.chain = h.get('chain');
  if (h.get('verdict')) S.verdict = h.get('verdict');
  if (h.get('tier')) S.tier = h.get('tier');
  if (h.get('watchlist') === '1') S.tier = 'watchlist';
  if (h.get('q')) S.q = h.get('q');
  if (h.get('capital') && [100, 1000, 10000].includes(+h.get('capital'))) S.capital = +h.get('capital');
  if (h.get('share') && [0.05, 0.1, 0.2].includes(+h.get('share'))) S.share = +h.get('share');
}
function writeHash() {
  const h = new URLSearchParams();
  if (S.tab !== 'board') h.set('tab', S.tab);
  if (S.detail) h.set('detail', S.detail);
  if (S.fam) h.set('fam', S.fam);
  if (S.cat) h.set('cat', S.cat);
  if (S.chain) h.set('chain', S.chain);
  if (S.verdict) h.set('verdict', S.verdict);
  if (S.tier) h.set('tier', S.tier);
  if (S.q) h.set('q', S.q);
  if (S.capital !== 1000) h.set('capital', S.capital);
  if (S.share !== 0.1) h.set('share', S.share);
  const s = h.toString();
  history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
}

/* ---- header, hero, pricing, scatter ---- */
function renderHeader() {
  $('subtitle').textContent = 'DefiLlama snapshot ' + META.as_of + ' · ' + T.protocols_scanned +
    ' protocols over $5M TVL · one model prices the page and board.json';
  $('badges').innerHTML = '<span class="badge">Watchlist <b>' + T.watchlist + '/' + T.watchlist_total +
    ' on board</b></span><span class="badge">Page = board.json <b>' + ROWS.length + '/' + T.ranked +
    ' rows</b></span><span class="badge">Model <b>' + esc(META.model_version) + '</b></span>';
}
function renderHero() {
  const v = T.verdicts;
  $('hero').innerHTML = '<p class="hero-lede">' + T.ranked +
    ' protocols record no token. Here is what each launch would be worth, and what farming it costs.</p>' +
    '<p class="mut">Each value is read off a curve fitted to the ' + CV.n_comps +
    ' tokens that already trade, then adjusted for 7-day TVL growth and time without a token. No name is hand-picked. ' +
    'Every row has a farm plan with a dollar cost and minutes per step, netted against the T-bill yield the capital gives up.</p>' +
    '<div class="chips">' +
    '<div class="chip"><div class="n amb">' + T.ranked + '</div><div class="l">Ranked</div></div>' +
    '<div class="chip"><div class="n">' + T.live + '</div><div class="l">Token trades, kept apart</div></div>' +
    '<div class="chip"><div class="n">' + T.set_aside + '</div><div class="l">Set aside</div></div>' +
    '<div class="chip"><div class="n teal">' + v.farm + '</div><div class="l">FARM at $1.0K</div></div>' +
    '<div class="chip"><div class="n amb">' + v.thin + '</div><div class="l">THIN at $1.0K</div></div>' +
    '<div class="chip"><div class="n red">' + v.skip + '</div><div class="l">SKIP at $1.0K</div></div>' +
    '<div class="chip"><div class="n amb">' + abbr(T.total_implied_usd) + '</div><div class="l">Total implied</div></div>' +
    '<div class="chip"><div class="n">' + abbr(T.median_implied_usd) + '</div><div class="l">Median implied</div></div>' +
    '</div>';
}
function renderPricing() {
  const best = ROWS.filter((r) => r.watchlist).sort((a, b) => b.econ.per_hour_usd - a.econ.per_hour_usd).slice(0, 2);
  $('pricing').innerHTML = '<h2>How a launch is priced</h2>' +
    '<div class="formula">value = 10^' + CV.a.toFixed(4) + ' × (TVL / $100M)^' + CV.b.toFixed(4) +
    ' × family × growth × seasoning × sibling &nbsp;·&nbsp; R² = ' + CV.r2.toFixed(3) + ' on ' + CV.n_comps + ' traded tokens</div>' +
    '<table><tbody>' +
    '<tr><td>Blind miss, each token left out</td><td class="num"><b>x' + BT.loo.median_miss.toFixed(2) + '</b> vs x' + BT.loo_flat.median_miss.toFixed(2) + ' flat</td></tr>' +
    '<tr><td>Time split, fit pre-2024, test newer</td><td class="num"><b>x' + BT.time_split.median_miss.toFixed(2) + '</b> vs x' + BT.time_split_flat.median_miss.toFixed(2) + ' flat</td></tr>' +
    '<tr><td>Within 3x of the real cap</td><td class="num"><b>' + pct(BT.loo.within3) + '</b> vs ' + pct(BT.loo_flat.within3) + ' flat</td></tr>' +
    '<tr><td>Inside the blind 80% band</td><td class="num"><b>' + pct(BT.band.coverage) + '</b> (P10 ×' + BT.band.p10.toFixed(2) + ' to P90 ×' + BT.band.p90.toFixed(2) + ')</td></tr>' +
    '</tbody></table>' +
    '<p style="margin:10px 0 0">Best net per hour on the watchlist: <b>' + esc(best[0].name) + ' ' + sgn2(best[0].econ.per_hour_usd) + '/h</b>, ' +
    '<b>' + esc(best[1].name) + ' ' + sgn2(best[1].econ.per_hour_usd) + '/h</b></p>';
}

/* ---- SVG scatter: traded tokens, the board, and the fitted curve ---- */
function logTicks(lo, hi) {
  const out = [];
  for (let p = Math.ceil(Math.log10(lo)); p <= Math.floor(Math.log10(hi)); p++) out.push(Math.pow(10, p));
  return out;
}
function tickLabel(v) {
  if (v >= 1e9) return '$' + trim2(v / 1e9) + 'B';
  if (v >= 1e6) return '$' + trim2(v / 1e6) + 'M';
  return '$' + trim2(v / 1e3) + 'K';
}
function renderScatter() {
  const W = 660, H = 300, L = 56, R = 12, Tp = 12, B = 34;
  const lo = 1e5, hi = 1e11, llo = Math.log10(lo), lhi = Math.log10(hi);
  const X = (v) => L + (Math.log10(v) - llo) / (lhi - llo) * (W - L - R);
  const Y = (v) => Tp + (1 - (Math.log10(v) - llo) / (lhi - llo)) * (H - Tp - B);
  const ticks = logTicks(lo, hi);
  let g = '';
  ticks.forEach((t, i) => {
    const anchor = i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle';
    g += '<line x1="' + X(t) + '" y1="' + Tp + '" x2="' + X(t) + '" y2="' + (H - B) + '" stroke="#1a2947"/>' +
      '<text x="' + X(t) + '" y="' + (H - 8) + '" fill="#8fa1bd" font-size="10" text-anchor="' + anchor + '">' + tickLabel(t) + '</text>';
    g += '<line x1="' + L + '" y1="' + Y(t) + '" x2="' + (W - R) + '" y2="' + Y(t) + '" stroke="#1a2947"/>' +
      '<text x="' + (L - 6) + '" y="' + (Y(t) + 3) + '" fill="#8fa1bd" font-size="10" text-anchor="end">' + tickLabel(t) + '</text>';
  });
  let line = '';
  for (let i = 0; i <= 40; i++) {
    const x = Math.pow(10, llo + (lhi - llo) * i / 40);
    const y = Math.pow(10, CV.a + CV.b * (Math.log10(x) - 8));
    line += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1);
  }
  let dots = '';
  for (const c of COMPS) dots += '<circle cx="' + X(c.tvl_usd).toFixed(1) + '" cy="' + Y(c.mcap_usd).toFixed(1) + '" r="2.6" fill="#7d8db0" opacity="0.75"/>';
  for (const r of ROWS) dots += '<circle cx="' + X(r.tvl_usd).toFixed(1) + '" cy="' + Y(r.implied_value_usd).toFixed(1) + '" r="2.6" fill="#f2b544" opacity="0.85"/>';
  $('scatterPanel').innerHTML = '<h2>Traded tokens and the curve</h2>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter of traded tokens and board rows against TVL">' + g +
    '<path d="' + line + '" fill="none" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="5,4"/>' + dots +
    '<text x="' + (W / 2) + '" y="' + (H - 20) + '" fill="#8fa1bd" font-size="11" text-anchor="middle"></text></svg>' +
    '<p class="cap">Grey: ' + CV.n_comps + ' traded tokens, market cap on TVL. Amber: the board at its implied value. Line: the size curve before family offsets. Both axes log scale, $100K–$100B.</p>';
}

/* ---- tabs + controls ---- */
const TAB_DEFS = [
  ['board', () => 'No token yet ' + ROWS.length],
  ['trades', () => 'Token trades ' + D.live_rows.length],
  ['aside', () => 'Set aside ' + D.aside_total],
  ['method', () => 'Method and backtest'],
];
function renderTabs() {
  $('tabs').innerHTML = TAB_DEFS.map(([k, label]) =>
    '<button class="tabbtn' + (S.tab === k ? ' on' : '') + '" data-tab="' + k + '">' + label() + '</button>').join('');
  $('boardTab').hidden = S.tab !== 'board';
  $('tradesTab').hidden = S.tab !== 'trades';
  $('asideTab').hidden = S.tab !== 'aside';
  $('methodTab').hidden = S.tab !== 'method';
  $('controls').style.display = S.tab === 'board' ? '' : 'none';
}
function uniqSorted(list) { return [...new Set(list)].sort((a, b) => a < b ? -1 : 1); }
function renderControls() {
  const fams = uniqSorted(ROWS.map((r) => r.family));
  const cats = uniqSorted(ROWS.map((r) => r.category).filter(Boolean));
  const chains = uniqSorted(ROWS.flatMap((r) => r.chains));
  const opt = (list, cur, all) => '<option value="">' + all + '</option>' + list.map((v) =>
    '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  $('controls').innerHTML =
    '<label>Search<input type="text" id="c-q" placeholder="Name or slug" value="' + esc(S.q) + '"></label>' +
    '<label>Family<select id="c-fam">' + opt(fams, S.fam, 'All families') + '</select></label>' +
    '<label>Category<select id="c-cat">' + opt(cats, S.cat, 'All categories') + '</select></label>' +
    '<label>Chain<select id="c-chain">' + opt(chains, S.chain, 'All chains') + '</select></label>' +
    '<label>Verdict<select id="c-verdict"><option value="">All verdicts</option>' +
    ['FARM', 'THIN', 'SKIP'].map((v) => '<option' + (S.verdict === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
    '<label>Tier<select id="c-tier"><option value="">All tiers</option>' +
    [['watchlist', 'Watchlist'], ['early', 'Early'], ['sibling', 'Sibling-linked']].map(([v, l]) =>
      '<option value="' + v + '"' + (S.tier === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<label>Min TVL<select id="c-min">' + [[0, '$0'], [5e7, '$50M'], [1e8, '$100M'], [2.5e8, '$250M']].map(([v, l]) =>
      '<option value="' + v + '"' + (S.minTvl === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<label>Capital<select id="c-cap">' + [100, 1000, 10000].map((v) =>
      '<option value="' + v + '"' + (S.capital === v ? ' selected' : '') + '>$' + v.toLocaleString('en-US') + '</option>').join('') + '</select></label>' +
    '<label>Airdrop share<select id="c-share">' + [[0.05, '5%'], [0.1, '10%'], [0.2, '20%']].map(([v, l]) =>
      '<option value="' + v + '"' + (S.share === v ? ' selected' : '') + '>' + l + ' of value</option>').join('') + '</select></label>' +
    '<label>Sort<select id="c-sort">' + [['implied', 'Implied value'], ['tvl', 'TVL'], ['change', '7-day change'], ['age', 'Age'], ['name', 'Name'], ['net', 'Net']].map(([v, l]) =>
      '<option value="' + v + '"' + (S.sort === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<button class="btn" id="c-reset" type="button">Reset</button>';
  $('c-q').addEventListener('input', (e) => { S.q = e.target.value; writeHash(); renderBoard(); });
  $('c-fam').addEventListener('change', (e) => { S.fam = e.target.value; writeHash(); renderBoard(); });
  $('c-cat').addEventListener('change', (e) => { S.cat = e.target.value; writeHash(); renderBoard(); });
  $('c-chain').addEventListener('change', (e) => { S.chain = e.target.value; writeHash(); renderBoard(); });
  $('c-verdict').addEventListener('change', (e) => { S.verdict = e.target.value; writeHash(); renderBoard(); });
  $('c-tier').addEventListener('change', (e) => { S.tier = e.target.value; writeHash(); renderBoard(); });
  $('c-min').addEventListener('change', (e) => { S.minTvl = +e.target.value; writeHash(); renderBoard(); });
  $('c-cap').addEventListener('change', (e) => { S.capital = +e.target.value; writeHash(); renderBoard(); });
  $('c-share').addEventListener('change', (e) => { S.share = +e.target.value; writeHash(); renderBoard(); });
  $('c-sort').addEventListener('change', (e) => { S.sort = e.target.value; renderBoard(); });
  $('c-reset').addEventListener('click', () => {
    Object.assign(S, { q: '', fam: '', cat: '', chain: '', verdict: '', tier: '', minTvl: 0, capital: 1000, share: 0.1, sort: 'implied' });
    writeHash(); renderControls(); renderBoard();
  });
}

/* ---- board table + histogram ---- */
const LO10 = Math.log10(Math.min(...ROWS.map((r) => r.p10_usd)));
const HI10 = Math.log10(Math.max(...ROWS.map((r) => r.p90_usd)));
function rangeBar(r) {
  const l = (Math.log10(r.p10_usd) - LO10) / (HI10 - LO10) * 100;
  const w = (Math.log10(r.p90_usd) - Math.log10(r.p10_usd)) / (HI10 - LO10) * 100;
  const d = (Math.log10(r.implied_value_usd) - LO10) / (HI10 - LO10) * 100;
  return '<div class="rng"><div class="rngbar" style="left:' + l.toFixed(1) + '%;width:' + w.toFixed(1) +
    '%"></div><div class="rngdot" style="left:' + d.toFixed(1) + '%"></div></div>';
}
function badgesFor(r) {
  let s = '';
  if (r.watchlist) s += '<span class="pill w">WATCHLIST</span>';
  if (r.early) s += '<span class="pill e">EARLY</span>';
  if (r.sibling) s += '<span class="pill s">SIBLING</span>';
  return s;
}
const SORTS = {
  implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
  tvl: (a, b) => b.tvl_usd - a.tvl_usd,
  change: (a, b) => (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d),
  age: (a, b) => (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days),
  name: (a, b) => a.name < b.name ? -1 : 1,
  net: (a, b) => econAt(b, S.capital, S.share).net_usd - econAt(a, S.capital, S.share).net_usd,
};
function filteredRows() {
  const q = S.q.trim().toLowerCase();
  return ROWS.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))) return false;
    if (S.fam && r.family !== S.fam) return false;
    if (S.cat && r.category !== S.cat) return false;
    if (S.chain && !r.chains.includes(S.chain)) return false;
    if (S.minTvl && r.tvl_usd < S.minTvl) return false;
    if (S.tier === 'watchlist' && !r.watchlist) return false;
    if (S.tier === 'early' && !r.early) return false;
    if (S.tier === 'sibling' && !r.sibling) return false;
    if (S.verdict && econAt(r, S.capital, S.share).verdict !== S.verdict) return false;
    return true;
  });
}
function capLabel() { return S.capital >= 1000 ? '$' + S.capital / 1000 + 'K' : '$' + S.capital; }
function renderBoard() {
  const list = filteredRows();
  const cmp = SORTS[S.sort] || SORTS.implied;
  list.sort((a, b) => cmp(a, b) || a.rank - b.rank);
  const head = '<tr><th class="sortable" data-sort="implied">Rank</th><th class="sortable" data-sort="name">Protocol</th>' +
    '<th class="sortable num" data-sort="tvl">TVL</th><th class="sortable num" data-sort="change">7d</th>' +
    '<th class="sortable num" data-sort="age">No token for</th><th class="sortable num" data-sort="implied">Implied value</th>' +
    '<th class="num">' + capLabel() + ' slice</th><th class="sortable num" data-sort="net">Net of all costs</th><th>Farm · fees · hold</th></tr>';
  let body = '';
  for (const r of list) {
    const e = econAt(r, S.capital, S.share);
    const netCls = e.net_usd > 0 ? 'teal' : e.net_usd < 0 ? 'red' : 'mut';
    body += '<tr class="rowlink" data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
      '<td><b>' + esc(r.name) + '</b>' + badgesFor(r) + '<br><span class="slug">' + esc(r.slug) + ' · ' + esc(r.family) + '</span></td>' +
      '<td class="num">' + abbr(r.tvl_usd) + '</td><td class="num">' + chgFmt(r.change_7d) + '</td>' +
      '<td class="num">' + ageFmt(r.age_days) + '</td>' +
      '<td class="num"><b class="amb">' + abbr(r.implied_value_usd) + '</b><br><span class="small mut">' +
      abbr(r.p10_usd) + ' – ' + abbr(r.p90_usd) + '</span>' + rangeBar(r) + '</td>' +
      '<td class="num">' + c2(e.slice_usd) + '</td>' +
      '<td class="num">' + verdictHtml(e.verdict) + ' <span class="' + netCls + '"><b>' + sgn2(e.net_usd) + '</b></span><br>' +
      '<span class="small mut">' + sgn2(e.per_hour_usd) + '/h</span></td>' +
      '<td class="small">' + esc(r.mechanism) + ' · ' + esc(planChain(r)) + '<br><span class="mut">' +
      c2(e.fees_usd) + ' fees · 90d hold · 2.3h work</span></td></tr>';
  }
  $('boardTab').innerHTML = '<p class="countline">Showing ' + list.length + ' of ' + ROWS.length +
    ' rows · capital ' + capLabel() + ' · drop ' + pct(S.share) + ' · sorted by ' +
    { implied: 'implied value', tvl: 'TVL', change: '7-day change', age: 'age', name: 'name', net: 'net' }[S.sort] + '</p>' +
    '<div style="overflow-x:auto"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    histogram(list);
  $('boardTab').querySelectorAll('th.sortable').forEach((th) => th.addEventListener('click', () => {
    S.sort = th.dataset.sort; const sel = $('c-sort'); if (sel) sel.value = S.sort; renderBoard();
  }));
  $('boardTab').querySelectorAll('tr.rowlink').forEach((tr) => tr.addEventListener('click', () => openDetail(tr.dataset.slug)));
}
function histogram(kept) {
  const W = 660, H = 150, L = 8, R = 8, Tp = 8, B = 22;
  const vals = ROWS.map((r) => Math.log10(r.implied_value_usd));
  const lo = Math.floor(Math.min(...vals)), hi = Math.ceil(Math.max(...vals));
  const NB = 14, keptSet = new Set(kept.map((r) => r.slug));
  const all = new Array(NB).fill(0), kp = new Array(NB).fill(0);
  for (const r of ROWS) {
    const b = Math.min(NB - 1, Math.floor((Math.log10(r.implied_value_usd) - lo) / (hi - lo) * NB));
    all[b]++; if (keptSet.has(r.slug)) kp[b]++;
  }
  const mx = Math.max(...all, 1), bw = (W - L - R) / NB;
  let bars = '';
  for (let i = 0; i < NB; i++) {
    const x = L + i * bw, hAll = all[i] / mx * (H - Tp - B), hKp = kp[i] / mx * (H - Tp - B);
    bars += '<rect x="' + (x + 1) + '" y="' + (H - B - hAll) + '" width="' + (bw - 2) + '" height="' + hAll +
      '" fill="#22304d"/><rect x="' + (x + 1) + '" y="' + (H - B - hKp) + '" width="' + (bw - 2) + '" height="' + hKp + '" fill="#f2b544"/>';
  }
  let labels = '';
  for (let p = lo; p <= hi; p++) {
    const x = L + (p - lo) / (hi - lo) * (W - L - R);
    labels += '<text x="' + x + '" y="' + (H - 6) + '" fill="#8fa1bd" font-size="10">' + tickLabel(Math.pow(10, p)) + '</text>';
  }
  return '<div class="panel"><h2>Distribution of implied values</h2><svg viewBox="0 0 ' + W + ' ' + H + '">' + bars + labels + '</svg>' +
    '<p class="cap">How the board\u2019s implied values are distributed, log scale. Solid bars are the rows this filter keeps.</p></div>';
}

/* ---- token-trades + set-aside tabs ---- */
function renderTrades() {
  let body = '';
  for (const r of D.live_rows) {
    body += '<tr><td><b>' + esc(r.name) + '</b><br><span class="slug">' + esc(r.slug) + ' · ' + esc(r.category || 'n/a') + '</span></td>' +
      '<td class="num">' + abbr(r.mcap_usd) + '</td><td class="num">' + abbr(r.tvl_usd) + '</td>' +
      '<td class="num">' + (r.fdv_tvl === null ? 'n/a' : r.fdv_tvl.toFixed(2) + 'x') + '</td></tr>';
  }
  $('tradesTab').innerHTML = '<div class="panel"><h2>Token trades — the comparison set</h2>' +
    '<p class="mut">These ' + D.live_rows.length + ' are the largest tokens that already trade, of the ' + T.live +
    ' protocols that record a token. They are never board rows: the size curve is fitted on them, and the board is priced against them.</p>' +
    '<table><thead><tr><th>Protocol</th><th class="num">Market cap</th><th class="num">TVL</th><th class="num">Mcap / TVL</th></tr></thead>' +
    '<tbody>' + body + '</tbody></table></div>';
}
function renderAside() {
  const counts = Object.entries(D.aside_counts).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => v + ' ' + k.toLowerCase()).join(', ');
  let body = '';
  for (const r of D.aside_rows) {
    body += '<tr><td><b>' + esc(r.name) + '</b><br><span class="slug">' + esc(r.slug) + ' · ' + esc(r.category || 'n/a') + '</span></td>' +
      '<td class="num">' + abbr(r.tvl_usd) + '</td><td>' + esc(r.reason) + '</td></tr>';
  }
  $('asideTab').innerHTML = '<div class="panel"><h2>Set aside — not a launch</h2>' +
    '<p class="mut">' + D.aside_total + ' pre-token protocols were set aside before ranking (' + counts +
    '). A wrapped, staked or bridged product of a token that already trades is not a launch of its own; neither is a versioned listing, ' +
    'an exchange balance sheet, or a sibling name of a traded token. Showing the top ' + D.aside_rows.length + ' by TVL.</p>' +
    '<table><thead><tr><th>Protocol</th><th class="num">TVL</th><th>Reason</th></tr></thead><tbody>' + body + '</tbody></table></div>';
}

/* ---- method tab ---- */
function looScatter() {
  const pts = BT.loo_points;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...xs, ...ys))));
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...xs, ...ys))));
  const W = 660, H = 300, L = 56, R = 12, Tp = 12, B = 34;
  const llo = Math.log10(lo), lhi = Math.log10(hi);
  const X = (v) => L + (Math.log10(v) - llo) / (lhi - llo) * (W - L - R);
  const Y = (v) => Tp + (1 - (Math.log10(v) - llo) / (lhi - llo)) * (H - Tp - B);
  const ticks2 = logTicks(lo, hi);
  let g = '';
  ticks2.forEach((t, i) => {
    const anchor = i === 0 ? 'start' : i === ticks2.length - 1 ? 'end' : 'middle';
    g += '<line x1="' + X(t) + '" y1="' + Tp + '" x2="' + X(t) + '" y2="' + (H - B) + '" stroke="#1a2947"/>' +
      '<text x="' + X(t) + '" y="' + (H - 8) + '" fill="#8fa1bd" font-size="10" text-anchor="' + anchor + '">' + tickLabel(t) + '</text>' +
      '<line x1="' + L + '" y1="' + Y(t) + '" x2="' + (W - R) + '" y2="' + Y(t) + '" stroke="#1a2947"/>' +
      '<text x="' + (L - 6) + '" y="' + (Y(t) + 3) + '" fill="#8fa1bd" font-size="10" text-anchor="end">' + tickLabel(t) + '</text>';
  });
  const band = 'M' + X(lo) + ' ' + Y(lo / 3) + 'L' + X(hi) + ' ' + Y(hi / 3) + 'L' + X(hi) + ' ' + Y(hi * 3) + 'L' + X(lo) + ' ' + Y(lo * 3) + 'Z';
  let dots = '';
  for (const [px, py] of pts) dots += '<circle cx="' + X(px).toFixed(1) + '" cy="' + Y(py).toFixed(1) + '" r="2.6" fill="#7d8db0" opacity="0.8"/>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '">' + g + '<path d="' + band + '" fill="#2dd4bf" opacity="0.08"/>' +
    '<line x1="' + X(lo) + '" y1="' + Y(lo) + '" x2="' + X(hi) + '" y2="' + Y(hi) + '" stroke="#2dd4bf" stroke-width="1.5" stroke-dasharray="5,4"/>' +
    dots + '</svg><p class="cap">Out of sample: each dot is one traded token, predicted with it left out (x) against its real market cap (y). ' +
    'Dashed line: exact. Shaded band: within 3x.</p>';
}
function renderMethod() {
  const fams = Object.entries(META.families).sort((a, b) => b[1].effect - a[1].effect);
  const famRows = fams.map(([f, v]) => '<tr><td>' + esc(f) + '</td><td class="num">' + v.n + '</td><td class="num">×' + v.effect.toFixed(3) + '</td></tr>').join('');
  $('methodTab').innerHTML = '<div class="panel"><h2>Method and backtest</h2>' +
    '<h3>Universe</h3><p class="mut">' + T.protocols_scanned + ' protocols at or above $5M TVL, snapshot ' + META.as_of +
    '. A protocol is pre-token when DefiLlama records no token for it: gecko_id, symbol and mcap all null. ' + T.live +
    ' record a token and are the comparison set. Of the pre-token protocols, ' + T.set_aside +
    ' were set aside by the house exclusion rule — bridges, liquid staking and restaking, restaked BTC, CEXs, exchange names, version listings, ' +
    'wrapped or staked names, siblings of traded tokens — leaving ' + T.ranked + ' rows, all ' + T.watchlist_total +
    ' watchlist names; a watchlist sibling stays at half value.</p>' +
    '<h3>Curve</h3><p class="mut">Comparables: live tokens with mcap and TVL, merged by token (gecko_id, else symbol, else slug), ' +
    'bridge and versioned listings dropped, mcap/TVL trimmed to [0.002, 50] — ' + CV.n_comps + ' left. Ordinary least squares on ' +
    'log10(mcap) = ' + CV.a.toFixed(4) + ' + ' + CV.b.toFixed(4) + ' × log10(TVL / $100M), R² = ' + CV.r2.toFixed(3) +
    '. A slope under 1 means small protocols trade at a higher multiple of TVL than large ones.</p>' +
    '<h3>Family</h3><p class="mut">Each family\u2019s effect is the mean curve-only residual of its traded tokens, shrunk toward 1 by n/(n+4). ' +
    'Shrinkage keeps a small family from swinging on one token.</p>' +
    '<table><thead><tr><th>Family</th><th class="num">Traded peers</th><th class="num">Effect</th></tr></thead><tbody>' + famRows + '</tbody></table>' +
    '<h3>Growth and seasoning</h3><p class="mut">Growth projects TVL two more weeks at the 7-day rate, clamped to ±30%, and reads the curve off the projected TVL. ' +
    'Seasoning regresses curve-plus-family residuals on log10(age in days): fitted coefficient ' + META.seasoning.coef_fitted.toFixed(4) +
    ', used ' + META.seasoning.coef_used.toFixed(4) + ' after shrinking 50% toward zero, factor clamped to [0.80, 1.15]. ' +
    'The factor check finds r ≈ ' + BT.factor_check.r_growth.toFixed(2) + ' with growth and r ≈ ' + BT.factor_check.r_age.toFixed(2) +
    ' with age — the snapshot cannot confirm either effect, so both stay small; size and family carry the value.</p>' +
    '<h3>Tests</h3><table><thead><tr><th>Test</th><th class="num">Median miss</th><th class="num">Within 3x</th><th class="num">Within 2x</th></tr></thead><tbody>' +
    '<tr><td>Leave-one-out, curve + family</td><td class="num"><b>x' + BT.loo.median_miss.toFixed(2) + '</b></td><td class="num">' + pct(BT.loo.within3) + '</td><td class="num">' + pct(BT.loo.within2) + '</td></tr>' +
    '<tr><td>Leave-one-out, curve only</td><td class="num">x' + BT.loo_curve.median_miss.toFixed(2) + '</td><td class="num">' + pct(BT.loo_curve.within3) + '</td><td class="num">' + pct(BT.loo_curve.within2) + '</td></tr>' +
    '<tr><td>Leave-one-out, flat median multiple</td><td class="num">x' + BT.loo_flat.median_miss.toFixed(2) + '</td><td class="num">' + pct(BT.loo_flat.within3) + '</td><td class="num">' + pct(BT.loo_flat.within2) + '</td></tr>' +
    '<tr><td>Time split, fit pre-2024 (n=' + BT.time_split.n_train + '), test newer (n=' + BT.time_split.n_test + ')</td><td class="num"><b>x' + BT.time_split.median_miss.toFixed(2) + '</b></td><td class="num">' + pct(BT.time_split.within3) + '</td><td class="num">' + pct(BT.time_split.within2) + '</td></tr>' +
    '<tr><td>Time split, flat</td><td class="num">x' + BT.time_split_flat.median_miss.toFixed(2) + '</td><td class="num">' + pct(BT.time_split_flat.within3) + '</td><td class="num">—</td></tr>' +
    '</tbody></table><p class="mut">Band coverage: ' + pct(BT.band.coverage) + ' of leave-one-out residuals fall inside the P10–P90 band (nominal 80%).</p>' +
    looScatter() +
    '<h3>Farm plans</h3><p class="mut">Every row carries an 8-step plan for $1,000 held 90 days: fund, verify, core play, second action, weekly upkeep, ' +
    'a risk trigger, claim, exit — 7 paid transactions, 140 minutes of work. The plan chain is the cheapest of the protocol\u2019s chains. ' +
    'Fees are 7 transactions at that chain\u2019s gas plus a $2 bridge allowance when the protocol spans chains and the plan chain is not Ethereum. ' +
    'Slice = ($1,000 / (TVL + $1,000)) × 10% × implied value. T-bill forgone is 4% a year over 90 days ($9.86 on $1,000). ' +
    'FARM: net above $0. THIN: the slice beats the fees but not the T-bill. SKIP: the slice does not even beat the fees.</p>' +
    '<h3>Limits</h3><p class="mut">One day of DefiLlama data. It does not say whether or when a token launches. ' +
    'Read the board as a ranking and an order of magnitude, not a price.</p></div>';
}

/* ---- detail view ---- */
function medOf(vals) { const s = [...vals].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
const MED_FAM = medOf(ROWS.map((r) => r.model.family_effect));
const MED_GROWTH = medOf(ROWS.map((r) => r.model.growth_pct));
function peersScatter(r) {
  const near = COMPS.filter((c) => Math.abs(Math.log10(c.tvl_usd / r.tvl_usd)) <= 1)
    .sort((a, b) => Math.abs(Math.log10(a.tvl_usd / r.tvl_usd)) - Math.abs(Math.log10(b.tvl_usd / r.tvl_usd))).slice(0, 40);
  const all = near.concat([{ tvl_usd: r.tvl_usd, mcap_usd: r.implied_value_usd }]);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...all.map((c) => Math.min(c.tvl_usd, c.mcap_usd))))));
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...all.map((c) => Math.max(c.tvl_usd, c.mcap_usd))))));
  const W = 340, H = 180, L = 48, R = 8, Tp = 8, B = 26;
  const llo = Math.log10(lo), lhi = Math.log10(hi);
  const X = (v) => L + (Math.log10(v) - llo) / (lhi - llo) * (W - L - R);
  const Y = (v) => Tp + (1 - (Math.log10(v) - llo) / (lhi - llo)) * (H - Tp - B);
  const ticks3 = logTicks(lo, hi);
  let g = '';
  ticks3.forEach((t, i) => {
    const anchor = i === 0 ? 'start' : i === ticks3.length - 1 ? 'end' : 'middle';
    g += '<line x1="' + X(t) + '" y1="' + Tp + '" x2="' + X(t) + '" y2="' + (H - B) + '" stroke="#1a2947"/>' +
      '<text x="' + X(t) + '" y="' + (H - 6) + '" fill="#8fa1bd" font-size="9" text-anchor="' + anchor + '">' + tickLabel(t) + '</text>' +
      '<line x1="' + L + '" y1="' + Y(t) + '" x2="' + (W - R) + '" y2="' + Y(t) + '" stroke="#1a2947"/>' +
      '<text x="' + (L - 4) + '" y="' + (Y(t) + 3) + '" fill="#8fa1bd" font-size="9" text-anchor="end">' + tickLabel(t) + '</text>';
  });
  let dots = '';
  for (const c of near) dots += '<circle cx="' + X(c.tvl_usd).toFixed(1) + '" cy="' + Y(c.mcap_usd).toFixed(1) + '" r="2.4" fill="#7d8db0"/>';
  dots += '<circle cx="' + X(r.tvl_usd).toFixed(1) + '" cy="' + Y(r.implied_value_usd).toFixed(1) + '" r="4.5" fill="#f2b544" stroke="#0a1120" stroke-width="1.5"/>';
  const nearest = [...COMPS].sort((a, b) => Math.abs(Math.log10(a.tvl_usd / r.tvl_usd)) - Math.abs(Math.log10(b.tvl_usd / r.tvl_usd))).slice(0, 5);
  let rows = '';
  for (const c of nearest) rows += '<tr><td>' + esc(c.name) + '</td><td class="num">' + abbr(c.tvl_usd) + '</td><td class="num">' +
    abbr(c.mcap_usd) + '</td><td class="num">' + (c.mcap_usd / c.tvl_usd).toFixed(2) + 'x</td></tr>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '">' + g + dots + '</svg>' +
    '<table><thead><tr><th>Nearest trading token</th><th class="num">TVL</th><th class="num">Mcap</th><th class="num">Mcap/TVL</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="cap">Grey: traded tokens within 10x of this TVL. Amber: this protocol at its implied value.</p>';
}
function whyRanks(r) {
  const m = r.model;
  const growthFactor = Math.pow(1 + m.growth_pct / 100, 2 * CV.b);
  const parts = [
    ['family', m.family_effect, 'The ' + r.family + ' family effect ×' + m.family_effect.toFixed(2) + ' sits ' +
      (m.family_effect >= MED_FAM ? 'above' : 'below') + ' the board median ×' + MED_FAM.toFixed(2) + '.'],
    ['growth', growthFactor, 'Its 7-day TVL change of ' + (m.growth_pct > 0 ? '+' : '') + m.growth_pct.toFixed(1) +
      '% (board median ' + (MED_GROWTH > 0 ? '+' : '') + MED_GROWTH.toFixed(1) + '%) projects TVL ' +
      (growthFactor >= 1 ? 'up' : 'down') + ' through the curve.'],
    ['seasoning', m.seasoning, m.seasoning >= 1 ? 'Time without a token lifts it ×' + m.seasoning.toFixed(2) + '.' : 'It is young, so seasoning trims it to ×' + m.seasoning.toFixed(2) + '.'],
  ];
  if (m.sibling_factor < 1) parts.push(['sibling', 0.5, 'It shares a first name with a traded token, so its value is halved.']);
  parts.sort((a, b) => Math.abs(Math.log10(b[1])) - Math.abs(Math.log10(a[1])));
  const top = parts[0];
  const verb = top[1] >= 1 ? 'lifts' : 'drags';
  return 'Why this ranks here: the ' + top[0] + ' factor ' + verb + ' it most (×' + top[1].toFixed(2) + '). ' + parts.map((p) => p[2]).join(' ');
}
function renderDetail() {
  const r = ROWS.find((x) => x.slug === S.detail);
  const el = $('detail');
  if (!r) { el.hidden = true; document.body.classList.remove('detail-open'); return; }
  document.body.classList.add('detail-open');
  const m = r.model, e = r.econ, chain = planChain(r), gas = gasOf(chain);
  const recomputed = Math.round(m.curve_value_usd * m.family_effect * m.seasoning * m.sibling_factor);
  const match = recomputed === r.implied_value_usd;
  const bridge = Math.round((e.fees_usd - 7 * gas) * 100) / 100;
  let steps = '';
  r.farm_steps.forEach((s, i) => {
    const txs = META.step_txs[i], mins = META.step_minutes[i];
    steps += '<tr><td>' + (i + 1) + '</td><td>' + esc(s) + '</td><td>' + (txs ? c2(txs * gas) : '$0.00') + '</td><td>' + mins + ' min</td></tr>';
  });
  let netAt = '<tr><th></th><th class="num">5% drop</th><th class="num">10% drop</th><th class="num">20% drop</th></tr>';
  for (const cap of [1000, 10000, 100000]) {
    netAt += '<tr><td>$' + cap.toLocaleString('en-US') + '</td>';
    for (const sh of [0.05, 0.1, 0.2]) {
      const net = (cap / (r.tvl_usd + cap)) * sh * r.implied_value_usd - e.fees_usd - cap * 0.04 * 90 / 365;
      netAt += '<td class="num ' + (net > 0 ? 'teal' : 'red') + '">' + sgn2(Math.round(net * 100) / 100) + '</td>';
    }
    netAt += '</tr>';
  }
  const pays = e.pays_from_usd === null ? 'never beats a T-bill' :
    e.pays_from_usd >= 100000 ? 'pays from $100K+' : 'pays from $' + e.pays_from_usd.toLocaleString('en-US');
  el.innerHTML = '<div class="panel"><div class="dhead"><div><h2>' + esc(r.name) + badgesFor(r) + '</h2>' +
    '<p class="mut" style="margin:4px 0 0">' + esc(r.slug) + ' · ' + esc(r.category || 'n/a') + ' · ' + esc(r.family) + ' · ' + esc(r.mechanism) +
    ' · ' + r.chains.map(esc).join(', ') + '</p></div>' +
    '<div style="text-align:right"><div>Rank <b>#' + r.rank + '</b> · Implied value <b class="amb">' + abbr(r.implied_value_usd) + '</b></div>' +
    '<div class="small mut">P25–P75 ' + abbr(r.p25_usd) + ' – ' + abbr(r.p75_usd) + ' · P10–P90 ' + abbr(r.p10_usd) + ' – ' + abbr(r.p90_usd) + '</div>' +
    '<div class="small mut">TVL ' + abbr(r.tvl_usd) + ' · 7d ' + (r.change_7d === null ? 'n/a' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') +
    ' · no token for ' + ageFmt(r.age_days) + (r.listed_at ? ' (listed ' + r.listed_at + ')' : '') + '</div></div>' +
    '<button class="closebtn" id="d-close" type="button">✕ Close</button></div>' +
    '<div class="dgrid"><div>' +
    '<h3>How the value is built</h3><table class="kv"><tbody>' +
    '<tr><td>Projected TVL (2 weeks at ' + (m.growth_pct > 0 ? '+' : '') + m.growth_pct.toFixed(1) + '%)</td><td class="num">' + abbr(m.projected_tvl_usd) + '</td></tr>' +
    '<tr><td>Curve value</td><td class="num">' + abbr(m.curve_value_usd) + '<br><span class="small mut">10^' + CV.a.toFixed(4) + ' × (TVL/$100M)^' + CV.b.toFixed(4) + '</span></td></tr>' +
    '<tr><td>Family effect — ' + esc(r.family) + ' (' + m.family_peer_count + ' traded peers)</td><td class="num">×' + m.family_effect.toFixed(3) + '</td></tr>' +
    '<tr><td>Seasoning — ' + (r.age_days === null ? 'age unknown' : r.age_days + ' days') + '</td><td class="num">×' + m.seasoning.toFixed(3) + '</td></tr>' +
    (m.sibling_factor < 1 ? '<tr><td>Sibling of a traded token</td><td class="num">×0.50</td></tr>' : '') +
    '<tr><td><b>Implied value</b> (curve × family × seasoning × sibling)</td><td class="num"><b class="amb">' + full(r.implied_value_usd) + '</b></td></tr>' +
    '</tbody></table><p class="cap">Recomputed from the factors above: ' + full(recomputed) + ' — ' +
    (match ? 'matches board.json.' : 'differs by ' + full(Math.abs(recomputed - r.implied_value_usd)) + ' (rounding).') + '</p>' +
    '<h3>Against traded peers</h3>' + peersScatter(r) +
    '<p class="mut" style="margin-top:10px">' + esc(whyRanks(r)) + '</p></div><div>' +
    '<h3>Farm plan — $1,000 · 90 days · ' + esc(chain) + '</h3>' +
    '<table class="steps"><thead><tr><th>#</th><th>Step</th><th>Cost</th><th>Time</th></tr></thead><tbody>' + steps +
    '<tr><td></td><td><b>Total</b>' + (bridge > 0 ? ' (incl. $' + bridge.toFixed(2) + ' bridge allowance)' : '') + '</td><td><b>' + c2(e.fees_usd) + '</b></td><td><b>140 min</b></td></tr>' +
    '</tbody></table>' +
    '<div class="econbar"><span>Slice <b>' + c2(e.slice_usd) + '</b></span><span>Fees <b class="red">−' + c2(e.fees_usd) + '</b></span>' +
    '<span>T-bill forgone <b class="red">−' + c2(e.tbill_usd) + '</b></span><span>Net <b class="' + (e.net_usd > 0 ? 'teal' : 'red') + '">' + sgn2(e.net_usd) + '</b></span>' +
    '<span>Work <b>2.3h</b></span><span>Per hour <b>' + sgn2(e.per_hour_usd) + '</b></span><span>' + verdictHtml(e.verdict) + '</span></div>' +
    '<h3>Net at other sizes</h3><table><tbody>' + netAt + '</tbody></table>' +
    '<p class="mut" style="margin-top:8px">Farming this protocol ' + pays + ' of capital (fees fixed, T-bill scales with capital).</p>' +
    '</div></div></div>';
  el.hidden = false;
  $('d-close').addEventListener('click', closeDetail);
}
function openDetail(slug) {
  S.detail = slug; S.tab = 'board'; writeHash(); renderTabs(); renderDetail();
  window.scrollTo(0, 0);
}
function closeDetail() {
  S.detail = ''; writeHash(); renderDetail(); renderBoard();
}

/* ---- footer + init ---- */
function renderFooter() {
  $('foot').innerHTML = '<p>Values are this radar\u2019s own estimate from the DefiLlama snapshot of ' + META.as_of +
    ', not a forecast that a token will launch and not a claim by make.fun. “Records no token” means DefiLlama carries none, not proof that none exists. ' +
    'Farm plans never promise an airdrop, a token, or a return. Not financial advice.</p>' +
    '<p>Source: DefiLlama snapshot ' + META.as_of + ' (' + T.protocols_scanned + ' protocols, floor ' + full(META.floor_usd) + '). Model ' + esc(META.model_version) + '.</p>' +
    '<p>Built with superbot.gg — a free uncensored model client that keeps the sessions this entry was built in.</p>';
}
function init() {
  readHash();
  renderHeader(); renderHero(); renderPricing(); renderScatter();
  renderTabs(); renderControls(); renderBoard(); renderTrades(); renderAside(); renderMethod(); renderFooter();
  $('tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tab]');
    if (!b) return;
    S.tab = b.dataset.tab; S.detail = '';
    document.body.classList.remove('detail-open'); $('detail').hidden = true;
    writeHash(); renderTabs();
    if (S.tab === 'board') renderBoard();
  });
  window.addEventListener('hashchange', () => {
    const old = S.detail;
    readHash(); renderTabs();
    if (S.tab === 'board') renderBoard();
    if (S.detail !== old) renderDetail();
  });
  if (S.detail) { renderDetail(); window.scrollTo(0, 0); }
}
init();
