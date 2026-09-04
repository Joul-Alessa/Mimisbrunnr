const app = require('./app');
const config = require('./config/env');
const { runMigrations } = require('./db/migrate');

async function start() {
  await runMigrations();
  app.listen(config.port, () => {
    console.log(`Mimisbrunnr backend listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
