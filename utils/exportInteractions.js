/**
 * News-Recom interaction export utilities.
 *
 * Produces implicit-feedback-style rows for offline training / batch pipelines.
 * Deep-learning services can add new formatters alongside this module without
 * changing MongoDB access patterns.
 */

const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');

/** @type {readonly string[]} */
const CSV_HEADERS = Object.freeze([
  'user_id',
  'item_id',
  'rating',
  'category',
  'time_context',
]);

const RATING_BOOKMARK = 5;
const RATING_READ = 3;

/** Bump when CSV contract changes for downstream News-Recom loaders. */
const EXPORT_FORMAT_VERSION = '1';

/**
 * Maps an interaction timestamp to a coarse time-of-day bucket for context models.
 * Uses UTC so exports are stable regardless of server local timezone.
 *
 * Buckets: morning 05–11, afternoon 12–16, evening 17–20, night 21–04.
 *
 * @param {Date|string|number|null|undefined} date
 * @returns {'morning'|'afternoon'|'evening'|'night'|'unknown'}
 */
function getTimeContext(date) {
  if (date == null) return 'unknown';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'unknown';

  const hour = d.getUTCHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * RFC-style CSV field escaping (commas, quotes, newlines).
 * @param {string|number} value
 * @returns {string}
 */
function escapeCsvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @typedef {Object} InteractionRow
 * @property {string} user_id
 * @property {string} item_id
 * @property {number} rating
 * @property {string} category
 * @property {string} time_context
 */

/**
 * Flatten embedded bookmarks and reading history into export rows.
 * @param {Array<Record<string, any>>} users Lean user documents with `_id`, `bookmarks`, `readingHistory`
 * @returns {InteractionRow[]}
 */
function usersToInteractionRows(users) {
  /** @type {InteractionRow[]} */
  const rows = [];

  for (const user of users) {
    const userId = user._id != null ? String(user._id) : '';
    if (!userId) continue;

    const bookmarks = Array.isArray(user.bookmarks) ? user.bookmarks : [];
    for (const b of bookmarks) {
      if (!b || !b.articleId) continue;
      const category =
        typeof b.category === 'string' && b.category.trim()
          ? b.category.trim()
          : 'general';
      rows.push({
        user_id: userId,
        item_id: String(b.articleId),
        rating: RATING_BOOKMARK,
        category,
        time_context: getTimeContext(b.bookmarkedAt),
      });
    }

    const history = Array.isArray(user.readingHistory) ? user.readingHistory : [];
    for (const h of history) {
      if (!h || !h.articleId) continue;
      const category =
        typeof h.category === 'string' && h.category.trim()
          ? h.category.trim()
          : 'general';
      rows.push({
        user_id: userId,
        item_id: String(h.articleId),
        rating: RATING_READ,
        category,
        time_context: getTimeContext(h.readAt),
      });
    }
  }

  return rows;
}

/**
 * @param {InteractionRow[]} rows
 * @returns {string}
 */
function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvField(r.user_id),
        escapeCsvField(r.item_id),
        r.rating,
        escapeCsvField(r.category),
        escapeCsvField(r.time_context),
      ].join(',')
    );
  }
  return lines.join('\n') + (lines.length > 1 ? '\n' : '');
}

function getDefaultExportAbsolutePath() {
  return path.join(__dirname, '..', 'exports', 'interactions.csv');
}

async function fetchAllUsersForExport() {
  return User.find({})
    .select('_id bookmarks readingHistory')
    .lean()
    .exec();
}

/**
 * Writes News-Recom–compatible interaction CSV to disk.
 *
 * @param {object} [options]
 * @param {string} [options.outputPath] Absolute path for the CSV file
 * @param {() => Promise<any[]>} [options.fetchUsers] Override user query (tests / future sharding)
 * @returns {Promise<{ rowCount: number, absolutePath: string, relativePath: string, formatVersion: string }>}
 */
async function writeNewsRecomInteractionsCsv(options = {}) {
  const outputPath = options.outputPath || getDefaultExportAbsolutePath();

  let users;
  try {
    users = options.fetchUsers
      ? await options.fetchUsers()
      : await fetchAllUsersForExport();
  } catch (err) {
    const wrap = new Error(
      `Failed to load interaction data from database: ${err.message}`
    );
    wrap.cause = err;
    wrap.statusCode = 500;
    throw wrap;
  }

  const rows = usersToInteractionRows(users);
  const csv = rowsToCsv(rows);

  const dir = path.dirname(outputPath);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, csv, { encoding: 'utf8' });
  } catch (err) {
    const wrap = new Error(
      `Failed to write News-Recom interaction export: ${err.message}`
    );
    wrap.cause = err;
    wrap.statusCode = 500;
    throw wrap;
  }

  const projectRoot = path.join(__dirname, '..');
  return {
    rowCount: rows.length,
    absolutePath: outputPath,
    relativePath: path.relative(projectRoot, outputPath),
    formatVersion: EXPORT_FORMAT_VERSION,
  };
}

module.exports = {
  CSV_HEADERS,
  RATING_BOOKMARK,
  RATING_READ,
  EXPORT_FORMAT_VERSION,
  getTimeContext,
  escapeCsvField,
  usersToInteractionRows,
  rowsToCsv,
  getDefaultExportAbsolutePath,
  fetchAllUsersForExport,
  writeNewsRecomInteractionsCsv,
};
