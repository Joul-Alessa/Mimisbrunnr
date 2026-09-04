-- Initial schema for Mimisbrunnr
-- SQLite dialect. Designed to be portable to PostgreSQL later
-- (avoid SQLite-only features beyond AUTOINCREMENT/TEXT-based enums).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- resource: a source of knowledge (video, book, article, AI chat, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  type                TEXT NOT NULL CHECK (type IN ('youtube', 'book', 'article', 'ai', 'other')),
  title               TEXT NOT NULL,
  author_or_channel   TEXT,
  url                 TEXT,
  editorial           TEXT,
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------
-- card: a flashcard / knowledge item
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('front_back', 'cloze', 'custom', 'plain')),
  front         TEXT,
  back          TEXT,
  content       TEXT,
  cloze_text    TEXT,
  custom_html   TEXT,
  custom_css    TEXT,
  custom_js     TEXT,
  created_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------
-- resource_detail: per-card location within a resource
-- (timestamp in a video, page in a book, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_detail (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id         INTEGER NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  card_id             INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  timestamp_seconds   INTEGER,
  page_number         INTEGER,
  extra               TEXT
);

CREATE INDEX IF NOT EXISTS idx_resource_detail_resource ON resource_detail(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_detail_card ON resource_detail(card_id);

-- ---------------------------------------------------------------------
-- knowledge_field: node in the knowledge graph
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_field (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  description   TEXT,
  parent_id     INTEGER REFERENCES knowledge_field(id) ON DELETE SET NULL,
  order_index   INTEGER,
  color         TEXT,
  icon          TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_field_parent ON knowledge_field(parent_id);

-- ---------------------------------------------------------------------
-- card_field: many-to-many card <-> knowledge_field
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_field (
  card_id   INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  field_id  INTEGER NOT NULL REFERENCES knowledge_field(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_card_field_field ON card_field(field_id);

-- ---------------------------------------------------------------------
-- card_resource: many-to-many card <-> resource
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_resource (
  card_id       INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  resource_id   INTEGER NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_card_resource_resource ON card_resource(resource_id);

-- ---------------------------------------------------------------------
-- card_review: spaced repetition state per card
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_review (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id             INTEGER NOT NULL UNIQUE REFERENCES card(id) ON DELETE CASCADE,
  last_reviewed_at    TEXT,
  next_review_at      TEXT,
  ease_factor         REAL NOT NULL DEFAULT 2.5,
  interval_days       INTEGER NOT NULL DEFAULT 0,
  repetitions         INTEGER NOT NULL DEFAULT 0,
  status              TEXT CHECK (status IN ('easy', 'medium', 'hard'))
);

CREATE INDEX IF NOT EXISTS idx_card_review_next_review ON card_review(next_review_at);

-- ---------------------------------------------------------------------
-- card_generation: LLM-generated content derived from plain cards
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_generation (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id             INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL CHECK (mode IN ('question', 'cloze', 'example', 'reasoning', 'random')),
  generated_content   TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_card_generation_card ON card_generation(card_id);
