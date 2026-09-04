const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');

// Very small migration runner: applies every .sql file in ./migrations,
// in filename order, and records applied filenames in a `_migrations` table
// so re-running is a no-op.
function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const already = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((row) => row.name)
  );

  const insertMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const file of files) {
    if (already.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file);
    });

    applyMigration();
    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module) {
  runMigrations();
  console.log('Migrations complete.');
}

module.exports = { runMigrations };
