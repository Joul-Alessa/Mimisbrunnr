const { getDb } = require('../db/connection');
const { buildSetClause } = require('../db/utils');

const UPDATABLE_COLUMNS = ['name', 'description', 'parent_id', 'order_index', 'color', 'icon'];

async function create({ name, description = null, parent_id = null, order_index = null, color = null, icon = null }) {
  const db = getDb();
  const { lastID } = await db.run(
    `INSERT INTO knowledge_field (name, description, parent_id, order_index, color, icon)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description, parent_id, order_index, color, icon]
  );
  return findById(lastID);
}

async function findById(id) {
  const db = getDb();
  return db.get('SELECT * FROM knowledge_field WHERE id = ?', [id]);
}

async function findAll() {
  const db = getDb();
  return db.all('SELECT * FROM knowledge_field ORDER BY parent_id IS NOT NULL, order_index, name');
}

async function findChildren(parent_id) {
  const db = getDb();
  return db.all('SELECT * FROM knowledge_field WHERE parent_id = ? ORDER BY order_index, name', [parent_id]);
}

// Returns [id, ...all recursive descendant ids] using a recursive CTE.
// Useful for "study this field + its subfields".
async function findDescendantIds(id) {
  const db = getDb();
  const rows = await db.all(
    `WITH RECURSIVE descendants(id) AS (
       SELECT id FROM knowledge_field WHERE id = ?
       UNION ALL
       SELECT kf.id FROM knowledge_field kf
       JOIN descendants d ON kf.parent_id = d.id
     )
     SELECT id FROM descendants`,
    [id]
  );
  return rows.map((row) => row.id);
}

async function update(id, fields) {
  const db = getDb();
  const { setClause, values } = buildSetClause(fields, UPDATABLE_COLUMNS);
  if (!setClause) return findById(id);

  await db.run(`UPDATE knowledge_field SET ${setClause} WHERE id = ?`, [...values, id]);
  return findById(id);
}

async function remove(id) {
  const db = getDb();
  const { changes } = await db.run('DELETE FROM knowledge_field WHERE id = ?', [id]);
  return changes > 0;
}

// Deletes `id` together with all of its descendants (used when the caller
// explicitly asks to remove subfields instead of the default behavior of
// promoting them to top-level fields via ON DELETE SET NULL).
async function removeCascade(id) {
  const db = getDb();
  const ids = await findDescendantIds(id);
  await db.exec('BEGIN');
  try {
    for (const descendantId of ids) {
      await db.run('DELETE FROM knowledge_field WHERE id = ?', [descendantId]);
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
  return ids.length;
}

module.exports = { create, findById, findAll, findChildren, findDescendantIds, update, remove, removeCascade };
