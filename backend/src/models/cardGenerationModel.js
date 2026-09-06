const { getDb } = require('../db/connection');
const { nowIso } = require('../db/utils');

async function create({ card_id, mode, generated_content, study_session_id = null }) {
  const db = getDb();
  const now = nowIso();
  const { lastID } = await db.run(
    `INSERT INTO card_generation (card_id, mode, generated_content, study_session_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [card_id, mode, generated_content, study_session_id, now]
  );
  return findById(lastID);
}

async function findById(id) {
  const db = getDb();
  return db.get('SELECT * FROM card_generation WHERE id = ?', [id]);
}

async function findByCardId(card_id) {
  const db = getDb();
  return db.all('SELECT * FROM card_generation WHERE card_id = ? ORDER BY created_at DESC', [card_id]);
}

async function remove(id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM card_generation WHERE id = ?', [id]);
  return changes > 0;
}

module.exports = { create, findById, findByCardId, remove };
