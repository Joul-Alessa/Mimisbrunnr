-- Study sessions: an explicit, timestamped study run over a chosen scope
-- (all cards / a knowledge field (+ subfields) / a resource). Replaces the
-- old date-gated spaced-repetition queue: every card in scope stays
-- eligible for the life of the session, and only per-session review history
-- (not a next_review_at due date) influences which card surfaces next.
CREATE TABLE IF NOT EXISTS study_session (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('all', 'field', 'resource')),
  scope_field_id      INTEGER REFERENCES knowledge_field(id) ON DELETE SET NULL,
  include_subfields   INTEGER NOT NULL DEFAULT 0,
  scope_resource_id   INTEGER REFERENCES resource(id) ON DELETE SET NULL,
  started_at          TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at            TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_session_open ON study_session(ended_at);

-- One row per rating given to a card within a session. A card can be rated
-- more than once per session as it resurfaces (sessions loop, they don't
-- stop once every card has been seen).
CREATE TABLE IF NOT EXISTS study_session_review (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES study_session(id) ON DELETE CASCADE,
  card_id       INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('hard', 'medium', 'easy')),
  reviewed_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_study_session_review_session ON study_session_review(session_id);
CREATE INDEX IF NOT EXISTS idx_study_session_review_card ON study_session_review(card_id);

-- Links an LLM generation to the study session it was produced in (in
-- addition to the card it was generated from), since generation now happens
-- from within a study session rather than from the card list.
ALTER TABLE card_generation ADD COLUMN study_session_id INTEGER;
