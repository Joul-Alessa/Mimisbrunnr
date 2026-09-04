const { getDb } = require('../db/connection');

async function create({ resource_id, card_id, timestamp_seconds = null, page_number = null, extra = null }) {
  const db = getDb();
  const { lastID } = await db.run(
    `INSERT INTO resource_detail (resource_id, card_id, timestamp_seconds, page_number, extra)
     VALUES (?, ?, ?, ?, ?)`,
    [resource_id, card_id, timestamp_seconds, page_number, extra]
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

async function remove(id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM resource_detail WHERE id = ?', [id]);
  return changes > 0;
}

module.exports = { create, findById, findByCardId, findByResourceId, remove };
