const { getDb } = require('../db/connection');
const { nowIso, buildSetClause } = require('../db/utils');

const UPDATABLE_COLUMNS = ['last_reviewed_at', 'next_review_at', 'ease_factor', 'interval_days', 'repetitions', 'status'];

// Initializes spaced repetition state for a brand-new card: due immediately.
async function createForCard(card_id, overrides = {}) {
  const db = getDb();
  const {
    ease_factor = 2.5,
    interval_days = 0,
    repetitions = 0,
    next_review_at = nowIso(),
  } = overrides;

  await db.run(
    `INSERT INTO card_review (card_id, ease_factor, interval_days, repetitions, next_review_at)
     VALUES (?, ?, ?, ?, ?)`,
    [card_id, ease_factor, interval_days, repetitions, next_review_at]
  );
  return findByCardId(card_id);
}

async function findByCardId(card_id) {
  const db = getDb();
  return db.get('SELECT * FROM card_review WHERE card_id = ?', [card_id]);
}

async function update(card_id, fields) {
  const db = getDb();
  const { setClause, values } = buildSetClause(fields, UPDATABLE_COLUMNS);
  if (!setClause) return findByCardId(card_id);

  await db.run(`UPDATE card_review SET ${setClause} WHERE card_id = ?`, [...values, card_id]);
  return findByCardId(card_id);
}

// Cards due for review (next_review_at is null or in the past/near future),
// optionally restricted to a set of knowledge_field ids.
async function findDue({ fieldIds = null, asOf = null, limit = 50 } = {}) {
  const db = getDb();
  const cutoff = asOf || nowIso();

  if (fieldIds && fieldIds.length > 0) {
    const placeholders = fieldIds.map(() => '?').join(', ');
    return db.all(
      `SELECT DISTINCT cr.* FROM card_review cr
       JOIN card_field cf ON cf.card_id = cr.card_id
       WHERE cf.field_id IN (${placeholders})
         AND (cr.next_review_at IS NULL OR cr.next_review_at <= ?)
       ORDER BY cr.next_review_at IS NOT NULL, cr.next_review_at ASC
       LIMIT ?`,
      [...fieldIds, cutoff, limit]
    );
  }

  return db.all(
    `SELECT * FROM card_review
     WHERE next_review_at IS NULL OR next_review_at <= ?
     ORDER BY next_review_at IS NOT NULL, next_review_at ASC
     LIMIT ?`,
    [cutoff, limit]
  );
}

module.exports = { createForCard, findByCardId, update, findDue };
