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

// Card ids linked to a resource — used to resolve a study session's scope.
async function getCardIdsForResource(resource_id) {
  const db = getDb();
  const rows = await db.all('SELECT card_id FROM card_resource WHERE resource_id = ?', [resource_id]);
  return rows.map((row) => row.card_id);
}

// Batch-fetches resources for many cards in one query, returning a
// { [card_id]: Resource[] } map so list views can avoid N+1 queries.
async function getResourcesForCards(cardIds) {
  if (cardIds.length === 0) return {};
  const db = getDb();
  const placeholders = cardIds.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT cr.card_id AS card_id, r.* FROM resource r
     JOIN card_resource cr ON cr.resource_id = r.id
     WHERE cr.card_id IN (${placeholders})`,
    cardIds
  );
  const map = {};
  for (const { card_id, ...resource } of rows) {
    (map[card_id] ||= []).push(resource);
  }
  return map;
}

module.exports = {
  addResourceToCard,
  removeResourceFromCard,
  setResourcesForCard,
  getResourcesForCard,
  getCardsForResource,
  getCardIdsForResource,
  getResourcesForCards,
};
