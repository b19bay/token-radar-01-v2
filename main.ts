// token-radar-01 v2 entry point.
//
// Reads the sealed DefiLlama snapshot, builds the radar-3-curve board,
// and writes board.json, data.js, dashboard/, screenshots/ and
// dossier.json to the output directory. Node 22, standard library only,
// deterministic: two runs write identical bytes.
//
// Usage: node main.ts [--input <snapshot.json|dir>] [--output <dir>]
//   --input   default /input (a directory holds snapshot.json)
//   --output  default $MAKEFUN_OUTPUT_DIR, else /output
//
// The output directory itself is NEVER deleted: only its contents are
// emptied, because the grader bind-mounts that directory.

import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel } from './lib/model.ts';
import type { Snapshot } from './lib/model.ts';
import { AIRDROP_SHARE, CAPITAL_USD, GAS_USD, HOLD_DAYS, MODEL_VERSION, TBILL_RATE, WORK_MINUTES } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function fail(message: string): never {
  console.error(`token-radar: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { input: string; output: string } {
  let input = '/input';
  let output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--input' && i + 1 < argv.length) input = argv[++i]!;
    else if (arg === '--output' && i + 1 < argv.length) output = argv[++i]!;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node main.ts [--input <snapshot.json|dir>] [--output <dir>]');
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return { input, output };
}

function readSnapshot(input: string): Snapshot {
  let path = input;
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'snapshot.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`cannot read snapshot at ${path}`);
  }
  let snap: unknown;
  try {
    snap = JSON.parse(raw!);
  } catch {
    fail(`snapshot at ${path} is not valid JSON`);
  }
  const s = snap as Snapshot;
  if (typeof s !== 'object' || s === null) fail('snapshot is not an object');
  if (typeof s.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.as_of)) fail('snapshot as_of is not a YYYY-MM-DD date');
  if (!Array.isArray(s.protocols) || s.protocols.length === 0) fail('snapshot protocols is empty or missing');
  if (!Array.isArray(s.watchlist) || s.watchlist.length === 0) fail('snapshot watchlist is empty or missing');
  if (typeof s.floor_usd !== 'number') fail('snapshot floor_usd is missing');
  for (const p of s.protocols) {
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.chains) || typeof p.tvl_usd !== 'number') {
      fail(`protocol ${JSON.stringify(p && (p as { slug?: unknown }).slug)} is missing required fields`);
    }
  }
  return s;
}

/** Empty a directory's contents without removing the directory itself. */
function emptyDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

/** Copy a directory tree, skipping dotfiles, regular files only. */
function copyTree(src: string, dest: string): string[] {
  mkdirSync(dest, { recursive: true });
  const copied: string[] = [];
  const walk = (from: string, to: string): void => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const s = join(from, entry.name);
      const d = join(to, entry.name);
      if (entry.isDirectory()) {
        mkdirSync(d, { recursive: true });
        walk(s, d);
      } else if (entry.isFile()) {
        copyFileSync(s, d);
        copied.push(d);
      }
    }
  };
  walk(src, dest);
  return copied;
}

function selfCheck(snapshot: Snapshot, model: ReturnType<typeof buildModel>): void {
  const { rows } = model;
  const slugs = new Set(rows.map((r) => r.slug));
  for (const w of snapshot.watchlist) {
    if (!slugs.has(w)) fail(`self-check: watchlist slug ${w} is not on the board`);
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.rank !== i + 1) fail(`self-check: ranks are not exactly 1..N (row ${i} has rank ${rows[i]!.rank})`);
    if (i > 0 && rows[i]!.implied_value_usd > rows[i - 1]!.implied_value_usd) {
      fail('self-check: implied values rise as rank ascends');
    }
  }
  if (rows.length > 1 && rows.every((r) => r.implied_value_usd === rows[0]!.implied_value_usd)) {
    fail('self-check: all implied values are equal');
  }
  for (const r of rows) {
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length !== 8) fail(`self-check: ${r.slug} does not have exactly 8 farm steps`);
    for (const step of r.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) fail(`self-check: ${r.slug} has a farm step of ${len} characters (must be 20-600)`);
    }
  }
  for (const [fam, f] of Object.entries(model.families)) {
    if (!Number.isFinite(f.effect) || f.effect <= 0) fail(`self-check: family ${fam} has a bad effect ${f.effect}`);
  }
  const bt = model.backtest;
  const nums = [
    bt.loo.median_miss, bt.loo.within3, bt.loo.within2,
    bt.loo_flat.median_miss, bt.loo_flat.within3, bt.loo_flat.within2,
    bt.time_split.median_miss, bt.time_split.within3,
    bt.time_split_flat.median_miss, bt.time_split_flat.within3,
    bt.band.p10, bt.band.p90, bt.band.coverage,
    bt.factor_check.r_growth, bt.factor_check.r_age,
  ];
  if (nums.some((n) => !Number.isFinite(n))) fail('self-check: a backtest number is not finite');
  if (!Number.isFinite(model.curve.a) || !Number.isFinite(model.curve.b)) fail('self-check: curve fit is not finite');
}

function main(): void {
  const { input, output } = parseArgs(process.argv.slice(2));
  const snapshot = readSnapshot(input);
  const model = buildModel(snapshot);
  selfCheck(snapshot, model);

  // Empty the output directory's contents; never remove the directory.
  emptyDir(output);

  // board.json
  writeFileSync(join(output, 'board.json'), `${JSON.stringify({ rows: model.rows })}\n`, 'utf8');

  // data.js: one global the dashboard reads.
  const data = {
    meta: {
      as_of: snapshot.as_of,
      floor_usd: snapshot.floor_usd,
      model_version: MODEL_VERSION,
      curve: { a: model.curve.a, b: model.curve.b, r2: model.curve.r2, n_comps: model.curve.n },
      families: model.families,
      seasoning: model.seasoning,
      backtest: model.backtest,
      economics: { capital_usd: CAPITAL_USD, hold_days: HOLD_DAYS, tbill_rate: TBILL_RATE, airdrop_share: AIRDROP_SHARE },
      totals: model.totals,
      gas_usd: GAS_USD,
      step_txs: [1, 0, 2, 2, 0, 0, 1, 1],
      step_minutes: [5, 15, 15, 15, 65, 5, 10, 10],
      work_minutes: WORK_MINUTES,
    },
    rows: model.rows,
    live_rows: model.live_rows,
    aside_rows: model.aside_rows,
    aside_counts: model.aside_counts,
    aside_total: model.aside_total,
    comps: model.comps,
  };
  writeFileSync(join(output, 'data.js'), `window.RADAR = ${JSON.stringify(data)};\n`, 'utf8');

  // dashboard/ (must exist in the repo)
  const dashSrc = join(REPO_ROOT, 'dashboard');
  if (!existsSync(dashSrc) || !statSync(dashSrc).isDirectory()) fail('dashboard/ is missing from the repository');
  const dashFiles = copyTree(dashSrc, join(output, 'dashboard'));
  if (!dashFiles.some((f) => f.endsWith('index.html'))) fail('dashboard/ has no index.html');
  if (!dashFiles.some((f) => f.endsWith('.css'))) fail('dashboard/ has no .css file');
  if (!dashFiles.some((f) => f.endsWith('.js'))) fail('dashboard/ has no .js file');

  // screenshots/ (exactly 4, valid names)
  const shotsSrc = join(REPO_ROOT, 'screenshots');
  if (!existsSync(shotsSrc) || !statSync(shotsSrc).isDirectory()) fail('screenshots/ is missing from the repository');
  const shotNames = readdirSync(shotsSrc, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  if (shotNames.length !== 4) fail(`screenshots/ holds ${shotNames.length} files, expected exactly 4`);
  for (const name of shotNames) {
    if (!SHOT_NAME.test(name)) fail(`screenshot name ${name} is not a plain dossier name`);
    if (!/\.(png|jpe?g)$/i.test(name)) fail(`screenshot ${name} is not a PNG or JPEG`);
    if (!lstatSync(join(shotsSrc, name)).isFile()) fail(`screenshot ${name} is not a regular file`);
  }
  copyTree(shotsSrc, join(output, 'screenshots'));

  // dossier.json last, from the vendored library.
  const dossier = buildDossier(output, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 512 * 1024 },
    dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
  });
  writeFileSync(join(output, 'dossier.json'), dossier);

  const t = model.totals;
  console.log(`token-radar: ${t.ranked} rows ranked (${t.watchlist} watchlist), ${t.set_aside} set aside, ${t.live} live tokens`);
  console.log(`token-radar: curve a=${model.curve.a.toFixed(4)} b=${model.curve.b.toFixed(4)} R2=${model.curve.r2.toFixed(3)} on ${model.curve.n} comparables`);
  console.log(`token-radar: top row ${model.rows[0]!.name} at $${model.rows[0]!.implied_value_usd.toLocaleString('en-US')}`);
  console.log(`token-radar: wrote ${join(output, 'board.json')}, data.js, dashboard/, screenshots/, dossier.json`);
}

main();
