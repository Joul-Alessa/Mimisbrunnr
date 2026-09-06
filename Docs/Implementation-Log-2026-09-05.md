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

## Summary of Files Changed

**Frontend:**
- [ResourcesPage.jsx](../frontend/src/pages/ResourcesPage.jsx) — modal pattern, resource type labels.
- [CardsPage.jsx](../frontend/src/pages/CardsPage.jsx) — modal pattern, delete, fixed edit pre-fill, card type labels.
- [KnowledgeFieldsPage.jsx](../frontend/src/pages/KnowledgeFieldsPage.jsx) — delete modal with cascade option.
- [App.css](../frontend/src/App.css) — modal styles, danger button styles, list item actions spacing.

**Backend:**
- [cardResourceModel.js](../backend/src/models/cardResourceModel.js) — `setResourcesForCard`.
- [cardService.js](../backend/src/services/cardService.js) — resource sync in `updateCard`.
- [knowledgeFieldModel.js](../backend/src/models/knowledgeFieldModel.js) — `removeCascade`.
- [knowledgeFieldService.js](../backend/src/services/knowledgeFieldService.js) — cascade option.
- [knowledgeFields.js (routes)](../backend/src/routes/knowledgeFields.js) — `?cascade=1` query param.

**API:**
- [api/knowledgeFields.js](../frontend/src/api/knowledgeFields.js) — cascade param support.
