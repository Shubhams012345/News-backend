/**
 * Build ML training CSV from all users' bookmarks and reading history.
 *
 * Run from project root: node scripts/generateTrainingData.js
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const {
  buildFeatureVectorsForCandidates,
} = require('../utils/recommendationFeatures');

const CSV_HEADERS = [
  'categoryMatch',
  'dwellTime',
  'timeContextMatch',
  'locationMatch',
  'recencyScore',
  'liked',
];

const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'ml-service',
  'training_data.csv'
);

/**
 * @param {Date|string|number|null|undefined} date
 * @returns {number}
 */
function timestampScore(date) {
  if (date == null) return 0;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * @param {Record<string, any>} user
 * @returns {Array<{ articleId: string, dwellTimeSeconds: number, timestamp: unknown, liked: number }>}
 */
function collectTrainingSamples(user) {
  const bookmarkIds = new Set(
    (user.bookmarks || [])
      .filter((b) => b && b.articleId)
      .map((b) => String(b.articleId))
  );

  /** @type {Array<{ articleId: string, dwellTimeSeconds: number, timestamp: unknown, liked: number }>} */
  const samples = [];

  for (const h of user.readingHistory || []) {
    if (!h || !h.articleId) continue;
    const articleId = String(h.articleId);
    const dwellTimeSeconds = Number(h.dwellTimeSeconds) || 0;
    const liked =
      bookmarkIds.has(articleId) || dwellTimeSeconds > 60 ? 1 : 0;
    samples.push({
      articleId,
      dwellTimeSeconds,
      timestamp: h.readAt,
      liked,
    });
  }

  const historyIds = new Set(
    (user.readingHistory || [])
      .filter((h) => h && h.articleId)
      .map((h) => String(h.articleId))
  );

  for (const b of user.bookmarks || []) {
    if (!b || !b.articleId) continue;
    const articleId = String(b.articleId);
    if (historyIds.has(articleId)) continue;
    samples.push({
      articleId,
      dwellTimeSeconds: 0,
      timestamp: b.bookmarkedAt,
      liked: 1,
    });
  }

  return samples;
}

/**
 * @param {Array<{ articleId: string, timestamp: unknown }>} samples
 * @returns {{ item_id: string, score: number }[]}
 */
function samplesToCandidates(samples) {
  const bestScoreByArticle = new Map();

  for (const sample of samples) {
    const score = timestampScore(sample.timestamp);
    const prev = bestScoreByArticle.get(sample.articleId);
    if (prev == null || score > prev) {
      bestScoreByArticle.set(sample.articleId, score);
    }
  }

  return [...bestScoreByArticle.entries()].map(([item_id, score]) => ({
    item_id,
    score,
  }));
}

/**
 * @param {Record<string, any>} user
 * @param {ReturnType<typeof collectTrainingSamples>} samples
 * @returns {Record<string, Record<string, number>>}
 */
function buildFeatureMapForUser(user, samples) {
  const candidates = samplesToCandidates(samples);
  if (candidates.length === 0) return {};

  const vectors = buildFeatureVectorsForCandidates(candidates, user);
  return Object.fromEntries(vectors.map((v) => [v.id, v.features]));
}

/**
 * @param {Array<Record<string, number | string>>} rows
 * @returns {string}
 */
function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.categoryMatch,
        row.dwellTime,
        row.timeContextMatch,
        row.locationMatch,
        row.recencyScore,
        row.liked,
      ].join(',')
    );
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not set. Add it to .env or the environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);

    const users = await User.find({})
      .select('bookmarks readingHistory preferredCategories')
      .lean()
      .exec();

    /** @type {Array<Record<string, number>>} */
    const allRows = [];

    for (const user of users) {
      const samples = collectTrainingSamples(user);
      if (samples.length === 0) continue;

      const featureMap = buildFeatureMapForUser(user, samples);

      for (const sample of samples) {
        const features = featureMap[sample.articleId];
        if (!features) continue;

        allRows.push({
          categoryMatch: features.categoryMatch,
          dwellTime: features.dwellTime,
          timeContextMatch: features.timeContextMatch,
          locationMatch: features.locationMatch,
          recencyScore: features.recencyScore,
          liked: sample.liked,
        });
      }
    }

    const csv = rowsToCsv(allRows);
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, csv, 'utf8');

    console.log(`Wrote ${allRows.length} training rows to ${OUTPUT_PATH}`);
    console.log(
      `Positive labels (liked=1): ${allRows.filter((r) => r.liked === 1).length}`
    );
  } catch (err) {
    console.error(`Failed to generate training data: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
