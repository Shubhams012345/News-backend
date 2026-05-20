/**
 * Load offline recommendation scores produced by News-Recom (batch engine).
 *
 * Expected file: `exports/recommendations.csv` with columns:
 *   user_id, item_id, score
 *
 * `item_id` values align with `articleId` from interaction exports / MongoDB.
 *
 * For future real-time serving, swap the loader implementation behind the same
 * exports (e.g. Redis, gRPC) without changing route handlers.
 */

const fs = require('fs').promises;
const path = require('path');

/** @type {{ path: string, mtimeMs: number, rows: RecommendationRow[] } | null} */
let fileCache = null;

/**
 * @typedef {Object} RecommendationRow
 * @property {string} user_id
 * @property {string} item_id
 * @property {number} score
 */

function getDefaultRecommendationsCsvPath() {
  return path.join(__dirname, '..', 'exports', 'recommendations.csv');
}

/**
 * Parse a single CSV record line (supports quoted fields).
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      out.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  out.push(cur);
  return out;
}

function normalizeHeaderCell(cell) {
  return String(cell || '')
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '');
}

/**
 * @param {string} content
 * @returns {RecommendationRow[]}
 */
function parseRecommendationsCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeaderCell);
  const idxUser = headerCells.indexOf('user_id');
  const idxItem = headerCells.indexOf('item_id');
  const idxScore = headerCells.indexOf('score');

  if (idxUser === -1 || idxItem === -1 || idxScore === -1) {
    const err = new Error(
      'recommendations.csv must include header columns: user_id, item_id, score'
    );
    err.statusCode = 500;
    throw err;
  }

  /** @type {RecommendationRow[]} */
  const rows = [];
  for (let li = 1; li < lines.length; li += 1) {
    const cells = parseCsvLine(lines[li]);
    if (cells.length < Math.max(idxUser, idxItem, idxScore) + 1) continue;

    const user_id = String(cells[idxUser] ?? '').trim();
    const item_id = String(cells[idxItem] ?? '').trim();
    const scoreRaw = String(cells[idxScore] ?? '').trim();
    const score = Number(scoreRaw);

    if (!user_id || !item_id || Number.isNaN(score)) continue;

    rows.push({ user_id, item_id, score });
  }

  return rows;
}

/**
 * @param {RecommendationRow[]} rows
 * @param {string|{ toString(): string }} userId
 * @param {{ limit?: number }} [options]
 * @returns {RecommendationRow[]}
 */
function getRankedRecommendationsForUser(rows, userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const uid = String(userId);

  const mine = rows.filter((r) => r.user_id === uid);
  mine.sort((a, b) => b.score - a.score);

  const seen = new Set();
  /** @type {RecommendationRow[]} */
  const deduped = [];
  for (const r of mine) {
    if (seen.has(r.item_id)) continue;
    seen.add(r.item_id);
    deduped.push(r);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

/**
 * Read and parse recommendations CSV (with simple mtime cache).
 *
 * @param {object} [options]
 * @param {string} [options.filePath]
 * @param {boolean} [options.bypassCache] Force disk read
 * @returns {Promise<{ rows: RecommendationRow[], fileMissing: boolean }>}
 */
async function loadRecommendationRows(options = {}) {
  const filePath = options.filePath || getDefaultRecommendationsCsvPath();
  const bypassCache = options.bypassCache === true;

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      fileCache = null;
      return { rows: [], fileMissing: true };
    }
    const wrap = new Error(`Cannot access recommendations file: ${err.message}`);
    wrap.cause = err;
    wrap.statusCode = 500;
    throw wrap;
  }

  if (
    !bypassCache &&
    fileCache &&
    fileCache.path === filePath &&
    fileCache.mtimeMs === stat.mtimeMs
  ) {
    return { rows: fileCache.rows, fileMissing: false };
  }

  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const wrap = new Error(`Failed to read recommendations file: ${err.message}`);
    wrap.cause = err;
    wrap.statusCode = 500;
    throw wrap;
  }

  const rows = parseRecommendationsCsv(content);
  fileCache = { path: filePath, mtimeMs: stat.mtimeMs, rows };

  return { rows, fileMissing: false };
}

function clearRecommendationsFileCache() {
  fileCache = null;
}

module.exports = {
  getDefaultRecommendationsCsvPath,
  parseCsvLine,
  parseRecommendationsCsv,
  loadRecommendationRows,
  getRankedRecommendationsForUser,
  clearRecommendationsFileCache,
};
