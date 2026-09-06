const { getDb } = require('../db/connection');
const { nowIso } = require('../db/utils');

async function create({ session_id, card_id, status }) {
  const db = getDb();
  const { lastID } = await db.run(
    `INSERT INTO study_session_review (session_id, card_id, status, reviewed_at) VALUES (?, ?, ?, ?)`,
    [session_id, card_id, status, nowIso()]
  );
  return db.get('SELECT * FROM study_session_review WHERE id = ?', [lastID]);
}

async function findBySessionId(session_id) {
  const db = getDb();
  return db.all('SELECT * FROM study_session_review WHERE session_id = ? ORDER BY reviewed_at ASC, id ASC', [session_id]);
}

// The most recent status given to each card within this session. A card
// absent from the returned map has not been rated yet this session.
async function latestStatusesBySession(session_id) {
  const db = getDb();
  const rows = await db.all(
    `SELECT card_id, status FROM study_session_review
     WHERE id IN (
       SELECT MAX(id) FROM study_session_review WHERE session_id = ? GROUP BY card_id
     )`,
    [session_id]
  );
  const map = {};
  for (const row of rows) map[row.card_id] = row.status;
  return map;
}

async function distinctCardCount(session_id) {
  const db = getDb();
  const row = await db.get(
    'SELECT COUNT(DISTINCT card_id) AS count FROM study_session_review WHERE session_id = ?',
    [session_id]
  );
  return row.count;
}

module.exports = { create, findBySessionId, latestStatusesBySession, distinctCardCount };
