const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const config = require('../config/env');

// `sqlite3` is callback-based; this thin wrapper exposes promise-based
// run/get/all/exec so the rest of the app can use async/await.
let dbWrapper = null;

function wrap(db) {
  return {
    raw: db,
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function callback(err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
  };
}

function getDb() {
  if (dbWrapper) return dbWrapper;

  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const raw = new sqlite3.Database(config.dbPath);
  raw.run('PRAGMA foreign_keys = ON');
  raw.run('PRAGMA journal_mode = WAL');
  dbWrapper = wrap(raw);

  return dbWrapper;
}

module.exports = { getDb };
