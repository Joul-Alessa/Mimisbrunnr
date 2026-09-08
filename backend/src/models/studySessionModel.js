const { getDb } = require('../db/connection');
const { nowIso } = require('../db/utils');

async function create({ scope_type, scope_field_id = null, include_subfields = false, scope_resource_id = null }) {
  const db = getDb();
  const { lastID } = await db.run(
    `INSERT INTO study_session (scope_type, scope_field_id, include_subfields, scope_resource_id, started_at)
     VALUES (?, ?, ?, ?, ?)`,
    [scope_type, scope_field_id, include_subfields ? 1 : 0, scope_resource_id, nowIso()]
  );
  return findById(lastID);
}

async function findById(id) {
  const db = getDb();
  return db.get('SELECT * FROM study_session WHERE id = ?', [id]);
}

async function findOpen() {
  const db = getDb();
  return db.get('SELECT * FROM study_session WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
}

async function findAll() {
  const db = getDb();
  return db.all('SELECT * FROM study_session ORDER BY started_at DESC');
}

async function endSession(id) {
  const db = getDb();
  await db.run('UPDATE study_session SET ended_at = ? WHERE id = ? AND ended_at IS NULL', [nowIso(), id]);
  return findById(id);
}

// Closes any currently open session(s) — used when starting a new session
// so only one session is ever "live" at a time.
async function endAllOpen() {
  const db = getDb();
  await db.run('UPDATE study_session SET ended_at = ? WHERE ended_at IS NULL', [nowIso()]);
}

module.exports = { create, findById, findOpen, findAll, endSession, endAllOpen };
