const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');

// Very small migration runner: applies every .sql file in ./migrations,
// in filename order, and records applied filenames in a `_migrations` table
// so re-running is a no-op.
async function runMigrations() {
  const db = getDb();

  await db.exec(`
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

  const appliedRows = await db.all('SELECT name FROM _migrations');
  const already = new Set(appliedRows.map((row) => row.name));

  for (const file of files) {
    if (already.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    await db.exec('BEGIN');
    try {
      await db.exec(sql);
      await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }

    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
