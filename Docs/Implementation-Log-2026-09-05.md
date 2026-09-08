# Implementation Log — 2026-09-05

UI/UX improvements across Resources, Cards, and Knowledge Fields pages: modals for create/edit flows, delete confirmations with options, and aesthetic refinements to type labels.

## Frontend UI Refactoring

### Resources Page Modal
[ResourcesPage.jsx](../frontend/src/pages/ResourcesPage.jsx): replaced the always-visible inline form with a modal pattern.
- **Create:** "+ Add resource" button opens the modal with an empty form.
- **Edit:** "Edit" button on each resource opens the modal with fields pre-filled via `getCard(id)` to fetch full data.
- **UX:** modal overlay blocks the background, Cancel/Save buttons inside; same form logic reused for both create and edit.
- **Styling:** `.modal-overlay`, `.modal`, `.modal-form`, `.modal-actions` classes in [App.css](../frontend/src/App.css) using existing theme variables.

### Cards Page Modal + Delete
[CardsPage.jsx](../frontend/src/pages/CardsPage.jsx): same modal pattern as Resources, plus delete capability.
- **Create/Edit:** "+ Add card" and "Edit" buttons open a modal. Selecting card type (plain/front_back/cloze) shows the appropriate input fields (textarea for plain/cloze, two inputs for front_back).
- **Checkboxes preserved:** Resources and Knowledge fields lists inside the modal — users can link/relink them during creation or editing.
- **Delete:** "Delete" button with `window.confirm` showing the full card preview, cannot be undone.
- **Bug fix:** `openEditModal` now fetches the full card data via `getCard(id)` before populating the form, ensuring `resources` and `fields` arrays (which come from `getCardFull` in the backend, not `listCards`) are correctly pre-filled.

**Backend support added:**
- [cardResourceModel.js](../backend/src/models/cardResourceModel.js): new `setResourcesForCard(card_id, resourceIds)` function (symmetric to `setFieldsForCard`) for replacing all resource links at once.
- [cardService.js](../backend/src/services/cardService.js:92): `updateCard` now syncs `resource_ids` if provided in the payload, allowing the modal's resource checkboxes to persist edits.

### Knowledge Fields Delete Modal with Cascade Option
[KnowledgeFieldsPage.jsx](../frontend/src/pages/KnowledgeFieldsPage.jsx): replaced `window.confirm` with a modal offering two deletion strategies.
- **Modal content:** displays the field name being deleted. If the field has children:
  - Radio button A (default): "Keep subfields — they become top-level fields" (current behavior, `ON DELETE SET NULL`).
  - Radio button B: "Delete subfields too" (cascade delete).
  - If no children, just shows a simple confirmation.
- **State tracking:** `deleteModal` object carries `{ id, name, hasChildren, cascade }`.

**Backend support added:**
- [knowledgeFieldModel.js](../backend/src/models/knowledgeFieldModel.js): new `removeCascade(id)` function that finds all descendants and deletes them in a transaction.
- [knowledgeFieldService.js](../backend/src/services/knowledgeFieldService.js:41): `deleteField(id, { cascade })` picks between simple delete (default) or cascade.
- [knowledgeFields.js (routes)](../backend/src/routes/knowledgeFields.js:48): `DELETE /:id?cascade=1` query param.
- [api/knowledgeFields.js](../frontend/src/api/knowledgeFields.js:10): `deleteField(id, cascade)` adds the query param.

### Styling: Danger Button
[App.css](../frontend/src/App.css):
- Added `button.danger` class: red background (`var(--danger)`), white/light text (`var(--accent-contrast)`), no border. Used for the "Delete" button in modals.
- Kept `.context-menu button.danger` separate with its original style (red text, no background) so the right-click menu Delete option remains visually consistent with other menu items.

### Resource Type Labels (Aesthetic)
[ResourcesPage.jsx](../frontend/src/pages/ResourcesPage.jsx): database keys (youtube, book, article, ai, other) now display as human-friendly labels.
- **Mapping:** `RESOURCE_TYPE_LABELS` object: `youtube → "YouTube"`, `book → "Book"`, `article → "Article"`, `ai → "AI"`, `other → "Other"`.
- **Applied in three places:**
  1. Type filter dropdown.
  2. Resource list display (`[YouTube]` instead of `[youtube]`).
  3. Modal type selector dropdown.
- **Note:** database and API still use the original keys (no backend changes needed).

### Card Type Labels (Aesthetic)
[CardsPage.jsx](../frontend/src/pages/CardsPage.jsx): database keys (plain, front_back, cloze, custom) now display as human-friendly labels.
- **Mapping:** `CARD_TYPE_LABELS` object: `plain → "Plain Knowledge"`, `front_back → "Front / Back"`, `cloze → "Cloze"`, `custom → "Custom"`.
- **Applied in two places:**
  1. Card list display (`[Plain Knowledge]` instead of `[plain]`).
  2. Modal type selector dropdown.
- **Note:** database and API still use the original keys (no backend changes needed).

### Resource Search Inside the Card Modal
[CardsPage.jsx](../frontend/src/pages/CardsPage.jsx): the Resources checklist inside the Add/Edit card modal was a flat, unfiltered list — hard to use once the resource catalog grows.
- Added a search input above the checklist (`matchesResourceSearch`, same matching logic as the Resources page: title, author/channel, notes, URL).
- Each resource in the checklist is now rendered in the same `[Type] Title — Author` format used on the Resources page, instead of just the bare title.

### Markdown Editor for Card Content
[CardsPage.jsx](../frontend/src/pages/CardsPage.jsx), new [MarkdownField.jsx](../frontend/src/components/MarkdownField.jsx), [MarkdownView.jsx](../frontend/src/components/MarkdownView.jsx), [lib/markdown.js](../frontend/src/lib/markdown.js): the `content`/`front`/`back`/`cloze_text` fields now support writing and previewing Markdown instead of plain text.
- **`MarkdownField`:** replaces the raw `<textarea>`/`<input>` for those fields. Adds "Write"/"Preview" tabs — Write shows the raw textarea, Preview renders the current value as HTML.
- **`MarkdownView`:** read-only counterpart used to render already-saved card content in the card list (see below).
- **`lib/markdown.js`:** shared `marked` configuration used by both components, so editor and list preview render identically. Extensions registered:
  - `marked-katex-extension` + `katex` — renders `$inline$` and `$$block$$` LaTeX math.
  - `marked-highlight` + `highlight.js` — syntax-highlights fenced code blocks (` ```js `, etc.) by detected language.
- **Bug fix — duplicated math/highlight output:** initially `marked.use(...)` was called on the default exported `marked` singleton. During dev, every HMR reload of `lib/markdown.js` re-ran `marked.use(...)` and *appended* the same extensions again onto the persistent singleton, so KaTeX/code rendering doubled up (e.g. `$n$` rendering as the KaTeX output *plus* a leftover literal `n`). Fixed by building an isolated instance instead — `new Marked(markedHighlight(...), markedKatex(...))` — so each module (re-)evaluation gets its own clean instance instead of mutating shared global state.
- **Bug fix — code block background artifact:** the global `code { padding; border-radius; background }` rule in [index.css](../frontend/src/index.css) was meant for inline code spans, but it also applied to the multi-line `<code>` inside fenced `<pre>` blocks. Because that background/padding sat on an inline element spanning several lines, the browser painted it per line, producing a "stepped boxes" look. Scoped the rule to `:not(pre) > code` (inline only) and gave `<pre><code>` no background/padding of its own — the block-level background comes from `.markdown-preview pre` instead.
- **Styling** ([App.css](../frontend/src/App.css)): `.markdown-field-tabs`, `.markdown-preview` typography (headings, lists, blockquotes, links), `.markdown-preview pre`/`code` (using a new `--code-bg` variable), and `.hljs-*` token classes mapped to new `--syntax-*` CSS variables (keyword/string/comment/number/function/tag/variable) defined per theme in [index.css](../frontend/src/index.css) so syntax highlighting adapts to light/dark mode like the rest of the app.

### Card List Renders Markdown
[CardsPage.jsx](../frontend/src/pages/CardsPage.jsx): the card list previously showed raw card text (`c.content || c.front || c.cloze_text`) as plain text. It now renders each card's content through `MarkdownView`, so headings, bold/italic/strikethrough, lists, code blocks (highlighted), and KaTeX math all render the same way they do in the modal's Preview tab. `front_back` cards render both `front` and `back` as separate Markdown blocks.

### Wider Modals + Vertical-Only Textarea Resize
[App.css](../frontend/src/App.css): the Cards and Resources modals felt cramped once Markdown editing/preview and the resource checklist were added.
- New `.modal-wide` modifier class (`max-width: 720px` vs. the default `420px`), applied to the Cards and Resources modals only — the Knowledge Fields delete-confirmation modal keeps the narrow default.
- `.modal-form textarea { resize: vertical }` — textareas (including inside `MarkdownField`) can now only be resized taller/shorter, not wider, so they can't blow past the modal's width.

### Card List Layout: Actions Row Separated From Content
[CardsPage.jsx](../frontend/src/pages/CardsPage.jsx): previously the type label, content, and Edit/Delete/Generate buttons were all packed into one flex row, squeezing the content column. Restructured each `<li>` into two stacked rows:
- `.card-list-item-header` — type label (`[Plain Knowledge]`) on the left, action buttons on the right, mirroring where the type label already sat above the card.
- `.card-list-item-body` — the rendered Markdown content, now spanning the full width of the card.

### Card Source Display + Full-Text Search/Filter
Cards previously showed no indication of which resource(s) they were sourced from, and there was no way to search/filter the card list.

**Backend** (avoids N+1 queries — batches resource/field lookups for the whole list in one query each):
- [cardResourceModel.js](../backend/src/models/cardResourceModel.js): new `getResourcesForCards(cardIds)` — single `IN (...)` query returning a `{ [card_id]: Resource[] }` map.
- [cardFieldModel.js](../backend/src/models/cardFieldModel.js): new `getFieldsForCards(cardIds)` — same pattern for knowledge fields.
- [cardService.js](../backend/src/services/cardService.js): new `listCardsFull({ type })` — calls `cardModel.findAll`, then attaches `resources` and `fields` to each card via the batch lookups above.
- [routes/cards.js](../backend/src/routes/cards.js): `GET /cards` now calls `cardService.listCardsFull` instead of `cardModel.findAll` directly, so the list response includes `resources`/`fields` (previously only `GET /cards/:id` returned those, via `getCardFull`).

**Frontend** ([CardsPage.jsx](../frontend/src/pages/CardsPage.jsx)):
- Each card in the list now shows a "Source: [Type] Title, ..." line when it has linked resources.
- New toolbar controls: a free-text search box (`matchesCardSearch` — matches card content/front/back/cloze text, type label, resource title/author, and knowledge field names) plus two exact-match dropdown filters (card type, knowledge field). All three combine via `filteredCards`.
- Empty-state message distinguishes "No cards yet" (nothing created) from "No cards match your search/filters" (results filtered to zero).

## Summary of Files Changed

**Frontend:**
- [ResourcesPage.jsx](../frontend/src/pages/ResourcesPage.jsx) — modal pattern, resource type labels.
- [CardsPage.jsx](../frontend/src/pages/CardsPage.jsx) — modal pattern, delete, fixed edit pre-fill, card type labels, resource search/format in the modal, Markdown editing, wide modal, restructured list rows, source display, search/filter toolbar.
- [KnowledgeFieldsPage.jsx](../frontend/src/pages/KnowledgeFieldsPage.jsx) — delete modal with cascade option.
- [App.css](../frontend/src/App.css) — modal styles (incl. `.modal-wide`, vertical-only textarea resize), danger button styles, list item actions spacing, card list layout, Markdown preview/syntax-highlighting styles.
- [index.css](../frontend/src/index.css) — `--code-bg`/`--syntax-*` theme variables, scoped the inline-`code` background rule to exclude `<pre><code>`.
- [components/MarkdownField.jsx](../frontend/src/components/MarkdownField.jsx) *(new)* — Write/Preview Markdown editor used for card content fields.
- [components/MarkdownView.jsx](../frontend/src/components/MarkdownView.jsx) *(new)* — read-only Markdown renderer used in the card list.
- [lib/markdown.js](../frontend/src/lib/markdown.js) *(new)* — shared `marked` instance (KaTeX + highlight.js extensions).

**Backend:**
- [cardResourceModel.js](../backend/src/models/cardResourceModel.js) — `setResourcesForCard`, `getResourcesForCards` (batch).
- [cardFieldModel.js](../backend/src/models/cardFieldModel.js) — `getFieldsForCards` (batch).
- [cardService.js](../backend/src/services/cardService.js) — resource sync in `updateCard`, new `listCardsFull`.
- [routes/cards.js](../backend/src/routes/cards.js) — `GET /cards` now returns `resources`/`fields` via `listCardsFull`.
- [knowledgeFieldModel.js](../backend/src/models/knowledgeFieldModel.js) — `removeCascade`.
- [knowledgeFieldService.js](../backend/src/services/knowledgeFieldService.js) — cascade option.
- [knowledgeFields.js (routes)](../backend/src/routes/knowledgeFields.js) — `?cascade=1` query param.

**New frontend dependencies** (installed manually, not by Claude — per project convention): `marked`, `marked-katex-extension`, `katex`, `marked-highlight`, `highlight.js`.

**API:**
- [api/knowledgeFields.js](../frontend/src/api/knowledgeFields.js) — cascade param support.
