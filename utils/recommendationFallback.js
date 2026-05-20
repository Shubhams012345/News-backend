/**
 * Fallback signals when batch recommendations are unavailable.
 * Keeps HTTP handlers thin; real-time engines can reuse the same helpers.
 */

function getCurrentTimeContext() {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) {
    return 'morning'
  }

  if (hour >= 12 && hour < 17) {
    return 'afternoon'
  }

  if (hour >= 17 && hour < 21) {
    return 'evening'
  }

  return 'night'
}

/**
 * Ordered category hints:
 * recent bookmarks,
 * reading history,
 * preferredCategories
 *
 * @param {Record<string, any>} user
 * @param {{ maxCategories?: number }} [options]
 * @returns {string[]}
 */
function buildCategoryFallbackFromUser(user, options = {}) {
  
  const currentTimeContext = getCurrentTimeContext()

  const max = Math.min(
    Math.max(Number(options.maxCategories) || 20, 1),
    100
  )

  const seen = new Set()
  const categoryScores = {}

  const addScore = (category, score) => {
    if (!category) return

    categoryScores[category] =
      (categoryScores[category] || 0) + score
  }

  // Bookmarks
  // Bookmarks
for (const b of user.bookmarks || []) {
  addScore(b.category, 5)
}

  // Reading history
  // Reading history
for (const h of user.readingHistory || []) {
  const bonus =
    h.timeContext === currentTimeContext ? 2 : 0

  const dwellBonus =
    Math.min((h.dwellTimeSeconds || 0) / 30, 5)

  addScore(
    h.category,
    3 + bonus + dwellBonus
  )
}

  // Preferred categories
  for (const p of user.preferredCategories || []) {
    addScore(p, 1)
  }

  const sorted = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category)

  const out = []

  for (const c of sorted) {
    const key = c.toLowerCase()

    if (!seen.has(key)) {
      seen.add(key)
      out.push(c)
    }
  }

  return out.slice(0, max)
}

module.exports = {
  buildCategoryFallbackFromUser,
}