const { getDb } = require('../db/connection');
const { nowIso, buildSetClause } = require('../db/utils');

const UPDATABLE_COLUMNS = [
  'type',
  'front',
  'back',
  'content',
  'cloze_text',
  'custom_html',
  'custom_css',
  'custom_js',
];

async function create({
  type,
  front = null,
  back = null,
  content = null,
  cloze_text = null,
  custom_html = null,
  custom_css = null,
  custom_js = null,
}) {
  const db = getDb();
  const now = nowIso();
  const { lastID } = await db.run(
    `INSERT INTO card (type, front, back, content, cloze_text, custom_html, custom_css, custom_js, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, front, back, content, cloze_text, custom_html, custom_css, custom_js, now, now]
  );
  return findById(lastID);
}

async function findById(id) {
  const db = getDb();
  return db.get('SELECT * FROM card WHERE id = ?', [id]);
}

async function findAll({ type } = {}) {
  const db = getDb();
  if (type) {
    return db.all('SELECT * FROM card WHERE type = ? ORDER BY created_at DESC', [type]);
  }
  return db.all('SELECT * FROM card ORDER BY created_at DESC');
}

// All card ids — the "study everything" scope for a study session.
async function findAllIds() {
  const db = getDb();
  const rows = await db.all('SELECT id FROM card');
  return rows.map((row) => row.id);
}

async function update(id, fields) {
  const db = getDb();
  const { setClause, values } = buildSetClause(fields, UPDATABLE_COLUMNS);
  if (!setClause) return findById(id);

  await db.run(
    `UPDATE card SET ${setClause}, updated_at = ? WHERE id = ?`,
    [...values, nowIso(), id]
  );
  return findById(id);
}

async function remove(id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM card WHERE id = ?', [id]);
  return changes > 0;
}

module.exports = { create, findById, findAll, findAllIds, update, remove };
