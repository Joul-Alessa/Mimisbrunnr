const { getDb } = require('../db/connection');

async function addFieldToCard(card_id, field_id) {
  const db = getDb();
  await db.run('INSERT OR IGNORE INTO card_field (card_id, field_id) VALUES (?, ?)', [card_id, field_id]);
}

async function removeFieldFromCard(card_id, field_id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM card_field WHERE card_id = ? AND field_id = ?', [card_id, field_id]);
  return changes > 0;
}

// Replaces all field associations for a card with exactly `fieldIds`.
async function setFieldsForCard(card_id, fieldIds) {
  const db = getDb();
  await db.exec('BEGIN');
  try {
    await db.run('DELETE FROM card_field WHERE card_id = ?', [card_id]);
    for (const field_id of fieldIds) {
      await db.run('INSERT INTO card_field (card_id, field_id) VALUES (?, ?)', [card_id, field_id]);
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

async function getFieldsForCard(card_id) {
  const db = getDb();
  return db.all(
    `SELECT kf.* FROM knowledge_field kf
     JOIN card_field cf ON cf.field_id = kf.id
     WHERE cf.card_id = ?`,
    [card_id]
  );
}

async function getCardsForField(field_id) {
  const db = getDb();
  return db.all(
    `SELECT c.* FROM card c
     JOIN card_field cf ON cf.card_id = c.id
     WHERE cf.field_id = ?`,
    [field_id]
  );
}

// Batch-fetches knowledge fields for many cards in one query, returning a
// { [card_id]: KnowledgeField[] } map so list views can avoid N+1 queries.
async function getFieldsForCards(cardIds) {
  if (cardIds.length === 0) return {};
  const db = getDb();
  const placeholders = cardIds.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT cf.card_id AS card_id, kf.* FROM knowledge_field kf
     JOIN card_field cf ON cf.field_id = kf.id
     WHERE cf.card_id IN (${placeholders})`,
    cardIds
  );
  const map = {};
  for (const { card_id, ...field } of rows) {
    (map[card_id] ||= []).push(field);
  }
  return map;
}

module.exports = {
  addFieldToCard,
  removeFieldFromCard,
  setFieldsForCard,
  getFieldsForCard,
  getCardsForField,
  getFieldsForCards,
};
