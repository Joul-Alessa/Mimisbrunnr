# Implementation Log — 2026-09-06

Continues from [Implementation-Log-2026-09-05.md](Implementation-Log-2026-09-05.md). This
session covered: page/timestamp ranges for card sources, several Study-tab fixes, a full
rework of Study from a daily due-card queue into explicit timestamped study sessions, a
mobile-responsive layout pass, and touch support for the Knowledge Fields diagram.

## Resource location detail: page and timestamp ranges

The backend already had `resource_detail` (single `page_number`/`timestamp_seconds` per
card-resource link) from the original build, but the frontend never exposed it, and
neither side supported a *range* ("pages 42–45", "3:10–4:00").

**Backend:**
- [002_resource_detail_ranges.sql](../backend/src/db/migrations/002_resource_detail_ranges.sql):
  adds `page_number_end` and `timestamp_seconds_end` to `resource_detail`.
- [resourceDetailModel.js](../backend/src/models/resourceDetailModel.js): `create` accepts
  the new columns; new `getDetailsForCards` (batch, same pattern as the existing
  resource/field batch lookups) and `replaceForCard` (delete + reinsert, used when editing
  a card's resource links).
- [cardService.js](../backend/src/services/cardService.js): `createCard`/`updateCard`/
  `listCardsFull` read and write the range columns; `updateCard` now also syncs
  `resource_details` via `replaceForCard` when provided (previously only `resource_ids`
  and `field_ids` were synced on edit).
- [routes/cards.js](../backend/src/routes/cards.js): `POST /:id/resources` accepts the
  `_end` fields too.

**Frontend** ([CardsPage.jsx](../frontend/src/pages/CardsPage.jsx)):
- Checking a **Book** resource in the card form reveals "Page" / "to page (optional)"
  number inputs; checking a **YouTube** resource reveals "Timestamp (mm:ss)" / "to
  (optional)" text inputs. `parseTimeToSeconds`/`formatSecondsToTime` accept plain
  seconds, `mm:ss`, or `hh:mm:ss`.
- The card list's "Source" line now renders as a proper list (`<ul className="list">` /
  `<li className="list-item">`), matching the `[Type] Title — Author` format already used
  on the Resources page, instead of a comma-joined string — with the page/timestamp range
  appended in parentheses.
- [App.css](../frontend/src/App.css): `.resource-detail-inputs` styles the new fields
  under each checked resource.

## Study tab: spacing, Markdown rendering, delete confirmation

Three small fixes to existing pages before the bigger Study rework:

- **Spacing:** `.study-filters` had no CSS at all (unlike `.toolbar` on Cards), so the
  field filter, "include subfields" checkbox, and "Refresh queue" button were rendered
  with no gap between them. Added `.study-filters` (mirrors `.toolbar`) plus spacing
  between the prompt/answer/review-buttons inside `.study-card`, in
  [App.css](../frontend/src/App.css).
- **Markdown rendering:** [StudyPage.jsx](../frontend/src/pages/StudyPage.jsx) rendered
  the card prompt/answer as raw text (`<p>`); switched both to the same `MarkdownView`
  component Cards already uses, so headings/code/KaTeX/etc. render identically while
  studying.
- **Delete confirmation:** [CardsPage.jsx](../frontend/src/pages/CardsPage.jsx) still used
  `window.confirm` for deleting a card, unlike the modal-based confirmation Knowledge
  Fields already had. Replaced it with the same `modal-overlay`/`modal`/`modal-actions`
  pattern (Cancel / Delete).

## Study rework: timestamped sessions instead of a daily due-card queue

The previous Study tab was a classic spaced-repetition queue: cards had a `next_review_at`
that pushed them at least a day into the future on every review, so a card rated today
could not reappear today, and the queue only ever showed "due" cards. The user wanted
Study to work in **sessions** instead: an explicit, timestamped study run (potentially
several per day) over a chosen scope (all cards / a knowledge field ± subfields / a
resource), where every card in that scope stays eligible for the whole session — reviewing
a card only changes how *likely* it is to resurface (unstudied-this-session > hard >
medium > easy), never whether it can.

Decisions locked in before implementing (via the user's answers to a design check-in):
1. Keep `card_review.ease_factor` as a secondary weight (breaks ties within a tier);
   drop `next_review_at`/`interval_days`-based due-date gating entirely.
2. Opening Study with a session already left open offers **Resume** or **New** (new closes
   the old one automatically).
3. A session is marked "complete" once every scoped card has been rated at least once, but
   stays open — the user can keep reviewing (it loops) or end it.
4. Scope is one filter at a time (all / field / resource), same as the old field-only
   filter, not combinable.

**Data model** — [003_study_sessions.sql](../backend/src/db/migrations/003_study_sessions.sql):
- `study_session`: `scope_type` (`all`/`field`/`resource`), `scope_field_id`,
  `include_subfields`, `scope_resource_id`, `started_at`, `ended_at` (NULL while open).
- `study_session_review`: one row per rating given to a card *within* a session — a card
  can have several rows in the same session as it resurfaces.
- `card_generation` gains `study_session_id` (see LLM section below).

**Backend:**
- [spacedRepetition.js](../backend/src/services/spacedRepetition.js): trimmed down to just
  `nextEaseFactor(currentEase, status)` — the interval/repetition-streak logic from the
  old due-date scheduler is gone.
- [cardReviewModel.js](../backend/src/models/cardReviewModel.js): rewritten around
  `recordRating(card_id, status)` (adjusts `ease_factor`, records `status`/
  `last_reviewed_at` for display — `interval_days`/`repetitions`/`next_review_at` are now
  unused legacy columns) and `getEaseFactorsForCards` (batch, for weighting).
- New models: [studySessionModel.js](../backend/src/models/studySessionModel.js)
  (`create`, `findOpen`, `findAll`, `endSession`, `endAllOpen`) and
  [studySessionReviewModel.js](../backend/src/models/studySessionReviewModel.js)
  (`create`, `findBySessionId`, `latestStatusesBySession`, `distinctCardCount`).
- Scope resolution helpers added alongside existing batch lookups:
  [cardFieldModel.js](../backend/src/models/cardFieldModel.js) `getCardIdsForFields`,
  [cardResourceModel.js](../backend/src/models/cardResourceModel.js)
  `getCardIdsForResource`, [cardModel.js](../backend/src/models/cardModel.js)
  `findAllIds`.
- [studyService.js](../backend/src/services/studyService.js): rewritten around sessions —
  `startSession` (closes any other open session first), `getOpenSession`, `endSession`,
  `listSessions`/`getSessionDetail` (scope description + progress + chronological review
  log, for history), `getNextCard` (weighted-random pick — tiers: unseen-this-session
  (100) > hard (30) > medium (10) > easy (3), each multiplied by `1/ease_factor`, drawn
  from the *entire* scope every time, never a shrinking queue), `submitSessionReview`.
- [routes/study.js](../backend/src/routes/study.js): replaced `GET /queue`/`POST /review`
  with `GET/POST /sessions`, `GET /sessions/open`, `GET /sessions/:id`,
  `POST /sessions/:id/end`, `GET /sessions/:id/next-card`,
  `POST /sessions/:id/reviews`, `POST /sessions/:id/generate`.

**Frontend:**
- [api/study.js](../frontend/src/api/study.js): rewritten to match the new endpoints.
- [StudyPage.jsx](../frontend/src/pages/StudyPage.jsx): rewritten. The page now shows a
  scope picker (All / Knowledge field + subfields / Resource) and a session history list;
  starting or resuming a session opens a modal with the current card, reveal/review
  controls, and a progress line ("`x`/`y` cards reviewed at least once", noting when the
  session is complete). Closing the modal (overlay click or "End session") ends the
  session. A history entry opens a read-only detail view: every rating given, in order,
  with the card it was for.

## Bug fix: a card could immediately reappear (and be re-Generated) right after being rated

Reported after using Generate (LLM): rating a card and then immediately seeing the *same*
card again (re-enabling Generate/Hard/Medium/Easy on it) felt wrong, especially in small
scopes where "easy" cards still carry non-zero weight.

- [studyService.js](../backend/src/services/studyService.js) `getNextCard` now accepts an
  `excludeCardId` and drops it from the candidate pool for that one draw (falling back to
  including it only if it's the sole card in scope).
- [routes/study.js](../backend/src/routes/study.js): `GET /sessions/:id/next-card` reads
  `?excludeCardId=`.
- [api/study.js](../frontend/src/api/study.js) / [StudyPage.jsx](../frontend/src/pages/StudyPage.jsx):
  after submitting a review, the just-rated card's id is passed as `excludeCardId` on the
  next draw.
- Verified with temporary cards (created, exercised, deleted) that a card no longer
  repeats immediately across repeated draws.
- Per request, all real `study_session`/`study_session_review` rows were deleted from the
  dev database after the fix (a fresh start for the new session model).

## LLM generation moved from Cards to Study sessions

Per the user: generating LLM content from a `plain` card should happen *while studying
it*, not from the Cards list, and the resulting record should be tied to the session it
was generated in.

- [cardGenerationModel.js](../backend/src/models/cardGenerationModel.js): `create` accepts
  `study_session_id`.
- [cardService.js](../backend/src/services/cardService.js): `generateFromCard` takes an
  optional `study_session_id` and forwards it.
- [studyService.js](../backend/src/services/studyService.js): new
  `generateForSessionCard(sessionId, cardId, mode)`, exposed as
  `POST /study/sessions/:id/generate`.
- Removed `POST /cards/:id/generate` from [routes/cards.js](../backend/src/routes/cards.js)
  (kept `GET /:id/generations` — still useful as a card's generation history) and the
  now-dead `generateFromCard` export from [api/cards.js](../frontend/src/api/cards.js).
- [CardsPage.jsx](../frontend/src/pages/CardsPage.jsx): removed the "Generate (LLM)"
  button and its state.
- [StudyPage.jsx](../frontend/src/pages/StudyPage.jsx): the study modal shows "Generate
  (LLM)" for the current card when it's `type: "plain"`, calling the new session-scoped
  endpoint.
- [README.md](../README.md): API overview and the spaced-repetition note updated to match
  (due-date scheduling → session-based; `POST /cards/:id/generate` → session endpoint).

## Mobile-responsive layout pass

- [App.css](../frontend/src/App.css): added a `max-width: 640px` breakpoint — the header
  wraps (title/theme toggle on one line, nav pills wrapping onto their own row below),
  modal action buttons stretch full-width instead of crowding to the right, the
  resource-detail inputs' left indent is dropped, and the Knowledge Fields canvas gets
  tighter padding. Also fixed a few `flex-wrap` gaps that existed independent of screen
  size (`.card-list-item-header`, `.review-buttons`, `.modal-actions`).
- `index.html`'s viewport meta tag and the global 16px body font (avoids iOS's
  zoom-on-focus for inputs below that size) already existed and needed no changes.

## Touch support for Knowledge Fields

The diagram's interactions (native HTML5 drag-and-drop to reparent, right-click for the
context menu) don't work on touch at all — flagged as a gap during the responsive pass,
then addressed on request.

[KnowledgeFieldsPage.jsx](../frontend/src/pages/KnowledgeFieldsPage.jsx): reimplemented
both gestures on top of Pointer Events, filtered to `pointerType === 'touch'` so mouse
behavior (native DnD, `contextmenu`, `dblclick`) is untouched:
- **Long-press (500ms)** on a bubble or empty canvas opens the same context menu a
  right-click would — reuses the existing `menu` state and its Add/Rename/Delete UI as-is.
- **Dragging a finger** more than a 10px threshold before the long-press timer fires
  starts a touch-drag instead: `document.elementFromPoint` (via each bubble's new
  `data-field-id` attribute) tracks what's under the finger, highlighting it with the
  existing `.drag-over` class, and drop reuses the same `handleDropOn`/`handleDropOnCanvas`
  the mouse path already had.
- Two touch-specific pitfalls fixed along the way:
  1. Browsers fire a synthetic "click" after a touch gesture ends; left unhandled, that
     click would immediately trigger the "click outside closes the menu" listener right
     after a long-press opened it. Fixed by calling `preventDefault()` on `pointerup`, but
     *only* when a long-press actually fired or a drag completed — a plain short tap still
     produces its natural click, which is what lets tapping empty space dismiss an
     already-open menu.
  2. The canvas long-press had no movement tolerance, so ordinary finger jitter would
     cancel it before it could fire; given it the same threshold-based tolerance the node
     long-press already had.
- [App.css](../frontend/src/App.css): `.field-set` gets `touch-action: none` (stops the
  browser from treating the gesture as a scroll) and `-webkit-touch-callout: none` (stops
  iOS's own text-selection callout from popping up on hold).
- Updated the page's help text to mention the touch gestures.

## Summary of Files Changed

**Backend:**
- [002_resource_detail_ranges.sql](../backend/src/db/migrations/002_resource_detail_ranges.sql),
  [003_study_sessions.sql](../backend/src/db/migrations/003_study_sessions.sql) *(new)*
- [resourceDetailModel.js](../backend/src/models/resourceDetailModel.js) — range columns,
  `getDetailsForCards`, `replaceForCard`
- [cardService.js](../backend/src/services/cardService.js) — resource-detail ranges,
  `resource_details` sync on update, `generateFromCard` session linkage
- [routes/cards.js](../backend/src/routes/cards.js) — range fields on
  `POST /:id/resources`, removed `POST /:id/generate`
- [spacedRepetition.js](../backend/src/services/spacedRepetition.js) — trimmed to
  `nextEaseFactor` only
- [cardReviewModel.js](../backend/src/models/cardReviewModel.js) — rewritten around
  `recordRating`/`getEaseFactorsForCards`
- [studySessionModel.js](../backend/src/models/studySessionModel.js),
  [studySessionReviewModel.js](../backend/src/models/studySessionReviewModel.js) *(new)*
- [cardFieldModel.js](../backend/src/models/cardFieldModel.js) — `getCardIdsForFields`
- [cardResourceModel.js](../backend/src/models/cardResourceModel.js) — `getCardIdsForResource`
- [cardModel.js](../backend/src/models/cardModel.js) — `findAllIds`
- [cardGenerationModel.js](../backend/src/models/cardGenerationModel.js) — `study_session_id`
- [studyService.js](../backend/src/services/studyService.js) — rewritten around sessions,
  anti-repeat `excludeCardId`, `generateForSessionCard`
- [routes/study.js](../backend/src/routes/study.js) — rewritten around `/sessions`

**Frontend:**
- [CardsPage.jsx](../frontend/src/pages/CardsPage.jsx) — page/timestamp range inputs,
  Source list formatting, delete confirmation modal, removed Generate (LLM)
- [api/cards.js](../frontend/src/api/cards.js) — removed dead `generateFromCard`
- [StudyPage.jsx](../frontend/src/pages/StudyPage.jsx) — rewritten around sessions,
  Markdown rendering, Generate (LLM), anti-repeat exclusion
- [api/study.js](../frontend/src/api/study.js) — rewritten to match new endpoints
- [KnowledgeFieldsPage.jsx](../frontend/src/pages/KnowledgeFieldsPage.jsx) — touch support
  (long-press menu, touch drag-and-drop)
- [App.css](../frontend/src/App.css) — resource-detail inputs, Study spacing, mobile
  breakpoint, general `flex-wrap` fixes, touch-action/callout on field bubbles

**Docs:**
- [README.md](../README.md) — API overview and spaced-repetition note updated for sessions
