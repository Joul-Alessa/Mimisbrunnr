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

module.exports = { addResourceToCard, removeResourceFromCard, getResourcesForCard, getCardsForResource };
