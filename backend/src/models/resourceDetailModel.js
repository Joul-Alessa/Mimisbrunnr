const { getDb } = require('../db/connection');

async function create({
  resource_id,
  card_id,
  timestamp_seconds = null,
  timestamp_seconds_end = null,
  page_number = null,
  page_number_end = null,
  extra = null,
}) {
  const db = getDb();
  const { lastID } = await db.run(
    `INSERT INTO resource_detail
       (resource_id, card_id, timestamp_seconds, timestamp_seconds_end, page_number, page_number_end, extra)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [resource_id, card_id, timestamp_seconds, timestamp_seconds_end, page_number, page_number_end, extra]
  );
  return findById(lastID);
}

async function findById(id) {
  const db = getDb();
  return db.get('SELECT * FROM resource_detail WHERE id = ?', [id]);
}

async function findByCardId(card_id) {
  const db = getDb();
  return db.all('SELECT * FROM resource_detail WHERE card_id = ?', [card_id]);
}

async function findByResourceId(resource_id) {
  const db = getDb();
  return db.all('SELECT * FROM resource_detail WHERE resource_id = ?', [resource_id]);
}

// Batch-fetches resource_details for many cards in one query, returning a
// { [card_id]: ResourceDetail[] } map so list views can avoid N+1 queries.
async function getDetailsForCards(cardIds) {
  if (cardIds.length === 0) return {};
  const db = getDb();
  const placeholders = cardIds.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT * FROM resource_detail WHERE card_id IN (${placeholders})`,
    cardIds
  );
  const map = {};
  for (const row of rows) {
    (map[row.card_id] ||= []).push(row);
  }
  return map;
}

// Replaces all resource_detail rows for a card with exactly `details`
// (each a { resource_id, timestamp_seconds?, timestamp_seconds_end?, page_number?, page_number_end?, extra? }).
async function replaceForCard(card_id, details) {
  const db = getDb();
  await db.exec('BEGIN');
  try {
    await db.run('DELETE FROM resource_detail WHERE card_id = ?', [card_id]);
    for (const detail of details) {
      await db.run(
        `INSERT INTO resource_detail
           (resource_id, card_id, timestamp_seconds, timestamp_seconds_end, page_number, page_number_end, extra)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          detail.resource_id,
          card_id,
          detail.timestamp_seconds ?? null,
          detail.timestamp_seconds_end ?? null,
          detail.page_number ?? null,
          detail.page_number_end ?? null,
          detail.extra ?? null,
        ]
      );
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

async function remove(id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM resource_detail WHERE id = ?', [id]);
  return changes > 0;
}

module.exports = {
  create,
  findById,
  findByCardId,
  findByResourceId,
  getDetailsForCards,
  replaceForCard,
  remove,
};
