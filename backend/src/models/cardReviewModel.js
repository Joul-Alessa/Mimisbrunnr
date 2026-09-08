const { getDb } = require('../db/connection');
const { nowIso } = require('../db/utils');
const { SR_CONFIG, nextEaseFactor } = require('../services/spacedRepetition');

// Initializes spaced-repetition state for a brand-new card. interval_days /
// repetitions are kept at 0 and unused going forward (no due-date
// scheduling); only ease_factor is maintained, as a secondary weight for
// study-session card selection.
async function createForCard(card_id, overrides = {}) {
  const db = getDb();
  const { ease_factor = SR_CONFIG.initialEaseFactor } = overrides;
  await db.run(
    `INSERT INTO card_review (card_id, ease_factor, interval_days, repetitions) VALUES (?, ?, 0, 0)`,
    [card_id, ease_factor]
  );
  return findByCardId(card_id);
}

async function findByCardId(card_id) {
  const db = getDb();
  return db.get('SELECT * FROM card_review WHERE card_id = ?', [card_id]);
}

// Applies a study-session rating's ease-factor delta and records it as the
// card's most recently known status/last_reviewed_at (for display and as
// the secondary weight in study session card selection). Creates the review
// row on the fly for cards that predate it having one.
async function recordRating(card_id, status) {
  const db = getDb();
  const review = await findByCardId(card_id);
  const ease_factor = nextEaseFactor(review?.ease_factor ?? SR_CONFIG.initialEaseFactor, status);
  const now = nowIso();

  if (review) {
    await db.run(
      'UPDATE card_review SET ease_factor = ?, status = ?, last_reviewed_at = ? WHERE card_id = ?',
      [ease_factor, status, now, card_id]
    );
  } else {
    await db.run(
      `INSERT INTO card_review (card_id, ease_factor, interval_days, repetitions, status, last_reviewed_at)
       VALUES (?, ?, 0, 0, ?, ?)`,
      [card_id, ease_factor, status, now]
    );
  }
  return findByCardId(card_id);
}

// Batch-fetches ease_factor per card (defaulting missing ones to the
// initial value) for weighting which card should surface next in a session.
async function getEaseFactorsForCards(cardIds) {
  const map = {};
  for (const id of cardIds) map[id] = SR_CONFIG.initialEaseFactor;
  if (cardIds.length === 0) return map;

  const db = getDb();
  const placeholders = cardIds.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT card_id, ease_factor FROM card_review WHERE card_id IN (${placeholders})`,
    cardIds
  );
  for (const row of rows) map[row.card_id] = row.ease_factor;
  return map;
}

module.exports = { createForCard, findByCardId, recordRating, getEaseFactorsForCards };
