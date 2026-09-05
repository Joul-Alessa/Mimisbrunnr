const { getDb } = require('../db/connection');

async function addResourceToCard(card_id, resource_id) {
  const db = getDb();
  await db.run('INSERT OR IGNORE INTO card_resource (card_id, resource_id) VALUES (?, ?)', [card_id, resource_id]);
}

async function removeResourceFromCard(card_id, resource_id) {
  const db = getDb();
  const { changes } = await db.run(
    'DELETE FROM card_resource WHERE card_id = ? AND resource_id = ?',
    [card_id, resource_id]
  );
  return changes > 0;
}

// Replaces all resource associations for a card with exactly `resourceIds`.
async function setResourcesForCard(card_id, resourceIds) {
  const db = getDb();
  await db.exec('BEGIN');
  try {
    await db.run('DELETE FROM card_resource WHERE card_id = ?', [card_id]);
    for (const resource_id of resourceIds) {
      await db.run('INSERT INTO card_resource (card_id, resource_id) VALUES (?, ?)', [card_id, resource_id]);
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

async function getResourcesForCard(card_id) {
  const db = getDb();
  return db.all(
    `SELECT r.* FROM resource r
     JOIN card_resource cr ON cr.resource_id = r.id
     WHERE cr.card_id = ?`,
    [card_id]
  );
}

async function getCardsForResource(resource_id) {
  const db = getDb();
  return db.all(
    `SELECT c.* FROM card c
     JOIN card_resource cr ON cr.card_id = c.id
     WHERE cr.resource_id = ?`,
    [resource_id]
  );
}

module.exports = {
  addResourceToCard,
  removeResourceFromCard,
  setResourcesForCard,
  getResourcesForCard,
  getCardsForResource,
};
