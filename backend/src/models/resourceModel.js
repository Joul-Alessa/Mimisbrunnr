const { getDb } = require('../db/connection');
const { nowIso, buildSetClause } = require('../db/utils');

const UPDATABLE_COLUMNS = ['type', 'title', 'author_or_channel', 'url', 'editorial', 'notes'];

async function create({ type, title, author_or_channel = null, url = null, editorial = null, notes = null }) {
  const db = getDb();
  const now = nowIso();
  const { lastID } = await db.run(
    `INSERT INTO resource (type, title, author_or_channel, url, editorial, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, title, author_or_channel, url, editorial, notes, now, now]
  );
  return findById(lastID);
}

async function findById(id) {
  const db = getDb();
  return db.get('SELECT * FROM resource WHERE id = ?', [id]);
}

async function findAll({ type } = {}) {
  const db = getDb();
  if (type) {
    return db.all('SELECT * FROM resource WHERE type = ? ORDER BY created_at DESC', [type]);
  }
  return db.all('SELECT * FROM resource ORDER BY created_at DESC');
}

async function update(id, fields) {
  const db = getDb();
  const { setClause, values } = buildSetClause(fields, UPDATABLE_COLUMNS);
  if (!setClause) return findById(id);

  await db.run(
    `UPDATE resource SET ${setClause}, updated_at = ? WHERE id = ?`,
    [...values, nowIso(), id]
  );
  return findById(id);
}

async function remove(id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM resource WHERE id = ?', [id]);
  return changes > 0;
}

module.exports = { create, findById, findAll, update, remove };
