const knowledgeFieldModel = require('../models/knowledgeFieldModel');
const resourceModel = require('../models/resourceModel');
const cardModel = require('../models/cardModel');
const cardFieldModel = require('../models/cardFieldModel');
const cardResourceModel = require('../models/cardResourceModel');
const cardReviewModel = require('../models/cardReviewModel');
const studySessionModel = require('../models/studySessionModel');
const studySessionReviewModel = require('../models/studySessionReviewModel');
const cardService = require('./cardService');
const { SR_CONFIG } = require('./spacedRepetition');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const REVIEW_STATUSES = ['easy', 'medium', 'hard'];
const SCOPE_TYPES = ['all', 'field', 'resource'];

// How much more likely a card is to be picked next within a session,
// depending on what happened to it so far *in this session*. A card never
// seen this session is far more likely to surface than one already rated
// "easy" here, but nothing ever drops to zero — every card in scope stays
// eligible for the life of the session, per spec.
const TIER_WEIGHT = { unseen: 100, hard: 30, medium: 10, easy: 3 };

async function resolveScopeCardIds(session) {
  if (session.scope_type === 'field') {
    const fieldIds = session.include_subfields
      ? await knowledgeFieldModel.findDescendantIds(session.scope_field_id)
      : [session.scope_field_id];
    return cardFieldModel.getCardIdsForFields(fieldIds);
  }
  if (session.scope_type === 'resource') {
    return cardResourceModel.getCardIdsForResource(session.scope_resource_id);
  }
  return cardModel.findAllIds();
}

async function describeScope(session) {
  if (session.scope_type === 'field') {
    const field = await knowledgeFieldModel.findById(session.scope_field_id);
    const name = field ? field.name : `#${session.scope_field_id}`;
    return `Field: ${name}${session.include_subfields ? ' (+ subfields)' : ''}`;
  }
  if (session.scope_type === 'resource') {
    const resource = await resourceModel.findById(session.scope_resource_id);
    const title = resource ? resource.title : `#${session.scope_resource_id}`;
    return `Resource: ${title}`;
  }
  return 'All cards';
}

async function withScopeInfo(session) {
  return { ...session, scope_description: await describeScope(session) };
}

async function getScopeProgress(session) {
  const [cardIds, reviewedCount] = await Promise.all([
    resolveScopeCardIds(session),
    studySessionReviewModel.distinctCardCount(session.id),
  ]);
  return {
    total_cards_in_scope: cardIds.length,
    reviewed_card_count: reviewedCount,
    all_reviewed: cardIds.length > 0 && reviewedCount >= cardIds.length,
  };
}

function weightFor(cardId, latestStatuses, easeFactors) {
  const tier = latestStatuses[cardId] || 'unseen';
  const easeFactor = easeFactors[cardId] ?? SR_CONFIG.initialEaseFactor;
  return TIER_WEIGHT[tier] * (1 / easeFactor);
}

function weightedPick(ids, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return ids[Math.floor(Math.random() * ids.length)];

  let r = Math.random() * total;
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

async function validateScopePayload({ scope_type, scope_field_id, scope_resource_id }) {
  if (!SCOPE_TYPES.includes(scope_type)) {
    throw new BadRequestError(`scope_type must be one of: ${SCOPE_TYPES.join(', ')}`);
  }
  if (scope_type === 'field') {
    if (!scope_field_id) throw new BadRequestError('scope_field_id is required for scope_type "field"');
    const field = await knowledgeFieldModel.findById(scope_field_id);
    if (!field) throw new NotFoundError(`Knowledge field ${scope_field_id} not found`);
  }
  if (scope_type === 'resource') {
    if (!scope_resource_id) throw new BadRequestError('scope_resource_id is required for scope_type "resource"');
    const resource = await resourceModel.findById(scope_resource_id);
    if (!resource) throw new NotFoundError(`Resource ${scope_resource_id} not found`);
  }
}

// Starts a new study session over the given scope, timestamped now. Any
// other still-open session is closed first — only one session is ever
// "live" at a time.
async function startSession(payload) {
  const { scope_type, scope_field_id = null, include_subfields = false, scope_resource_id = null } = payload;
  await validateScopePayload({ scope_type, scope_field_id, scope_resource_id });

  await studySessionModel.endAllOpen();
  const session = await studySessionModel.create({ scope_type, scope_field_id, include_subfields, scope_resource_id });
  return withScopeInfo(session);
}

async function getOpenSession() {
  const session = await studySessionModel.findOpen();
  return session ? withScopeInfo(session) : null;
}

async function endSession(id) {
  const session = await studySessionModel.findById(id);
  if (!session) throw new NotFoundError(`Study session ${id} not found`);
  return studySessionModel.endSession(id);
}

// History list: every session with its scope description and progress
// counts, newest first.
async function listSessions() {
  const sessions = await studySessionModel.findAll();
  return Promise.all(
    sessions.map(async (session) => ({
      ...(await withScopeInfo(session)),
      ...(await getScopeProgress(session)),
    }))
  );
}

// Full detail for one session: scope, progress, and the chronological list
// of ratings given during it, each with the reviewed card's content.
async function getSessionDetail(id) {
  const session = await studySessionModel.findById(id);
  if (!session) throw new NotFoundError(`Study session ${id} not found`);

  const [scoped, progress, reviews] = await Promise.all([
    withScopeInfo(session),
    getScopeProgress(session),
    studySessionReviewModel.findBySessionId(id),
  ]);

  const uniqueCardIds = [...new Set(reviews.map((r) => r.card_id))];
  const cards = await Promise.all(uniqueCardIds.map((cardId) => cardService.getCardFull(cardId)));
  const cardsById = Object.fromEntries(cards.map((c) => [c.id, c]));

  return {
    ...scoped,
    ...progress,
    reviews: reviews.map((r) => ({ ...r, card: cardsById[r.card_id] || null })),
  };
}

// Weighted-random pick of the next card to study within a session, drawn
// from every card in the session's scope (never a shrinking queue).
async function getNextCard(sessionId) {
  const session = await studySessionModel.findById(sessionId);
  if (!session) throw new NotFoundError(`Study session ${sessionId} not found`);

  const cardIds = await resolveScopeCardIds(session);
  if (cardIds.length === 0) return null;

  const [latestStatuses, easeFactors] = await Promise.all([
    studySessionReviewModel.latestStatusesBySession(sessionId),
    cardReviewModel.getEaseFactorsForCards(cardIds),
  ]);

  const weights = cardIds.map((id) => weightFor(id, latestStatuses, easeFactors));
  const chosenId = weightedPick(cardIds, weights);

  return cardService.getCardFull(chosenId);
}

async function submitSessionReview(sessionId, cardId, status) {
  if (!REVIEW_STATUSES.includes(status)) {
    throw new BadRequestError(`status must be one of: ${REVIEW_STATUSES.join(', ')}`);
  }
  const session = await studySessionModel.findById(sessionId);
  if (!session) throw new NotFoundError(`Study session ${sessionId} not found`);
  const card = await cardModel.findById(cardId);
  if (!card) throw new NotFoundError(`Card ${cardId} not found`);

  await studySessionReviewModel.create({ session_id: sessionId, card_id: cardId, status });
  await cardReviewModel.recordRating(cardId, status);

  return getScopeProgress(session);
}

async function generateForSessionCard(sessionId, cardId, mode) {
  const session = await studySessionModel.findById(sessionId);
  if (!session) throw new NotFoundError(`Study session ${sessionId} not found`);
  return cardService.generateFromCard(cardId, mode, { save: true, study_session_id: sessionId });
}

module.exports = {
  REVIEW_STATUSES,
  SCOPE_TYPES,
  startSession,
  getOpenSession,
  endSession,
  listSessions,
  getSessionDetail,
  getNextCard,
  submitSessionReview,
  generateForSessionCard,
};
