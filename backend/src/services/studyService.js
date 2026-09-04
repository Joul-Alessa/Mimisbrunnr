const knowledgeFieldModel = require('../models/knowledgeFieldModel');
const cardReviewModel = require('../models/cardReviewModel');
const cardService = require('./cardService');
const { computeNextReviewState } = require('./spacedRepetition');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const REVIEW_STATUSES = ['easy', 'medium', 'hard'];

// How overdue (in days) a card is, relative to `asOf`. Cards with no
// next_review_at yet (brand new) count as maximally due.
function overdueDays(review, asOf) {
  if (!review.next_review_at) return 999;
  const diffMs = asOf.getTime() - new Date(review.next_review_at).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

// Weighted so cards that are more overdue and/or have a lower ease_factor
// (i.e. historically harder) are more likely to be picked first, per spec
// 4.2.3, while still leaving room for randomness rather than a strict sort.
function weightFor(review, asOf) {
  const easeFactor = review.ease_factor ?? 2.5;
  const dueBoost = 1 + overdueDays(review, asOf) * 0.2;
  const difficultyBoost = 1 / easeFactor;
  return dueBoost * difficultyBoost;
}

// Weighted random sample without replacement, up to `limit` items.
function weightedSample(items, weights, limit) {
  const pool = items.map((item, i) => ({ item, weight: weights[i] }));
  const picked = [];

  while (pool.length > 0 && picked.length < limit) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * total;
    let index = 0;
    for (; index < pool.length; index++) {
      r -= pool[index].weight;
      if (r <= 0) break;
    }
    const chosenIndex = Math.min(index, pool.length - 1);
    picked.push(pool[chosenIndex].item);
    pool.splice(chosenIndex, 1);
  }

  return picked;
}

// Resolves the study scope (spec 4.2.1): a specific field, that field plus
// its subfields recursively, or every field (global study) when none given.
async function resolveFieldIds({ fieldId, includeSubfields }) {
  if (!fieldId) return null;

  const field = await knowledgeFieldModel.findById(fieldId);
  if (!field) throw new NotFoundError(`Knowledge field ${fieldId} not found`);

  return includeSubfields ? knowledgeFieldModel.findDescendantIds(fieldId) : [Number(fieldId)];
}

async function getStudyQueue({ fieldId, includeSubfields = false, limit = 20 } = {}) {
  const fieldIds = await resolveFieldIds({ fieldId, includeSubfields });

  // Pull a larger due candidate pool than `limit` so the weighted sample has
  // something meaningful to choose from, then narrow down to `limit`.
  const candidatePoolSize = Math.max(limit * 5, 50);
  const dueReviews = await cardReviewModel.findDue({ fieldIds, limit: candidatePoolSize });

  const asOf = new Date();
  const weights = dueReviews.map((review) => weightFor(review, asOf));
  const selected = weightedSample(dueReviews, weights, limit);

  return Promise.all(selected.map((review) => cardService.getCardFull(review.card_id)));
}

async function submitReview(card_id, status) {
  if (!REVIEW_STATUSES.includes(status)) {
    throw new BadRequestError(`status must be one of: ${REVIEW_STATUSES.join(', ')}`);
  }

  const review = await cardReviewModel.findByCardId(card_id);
  if (!review) throw new NotFoundError(`No review state for card ${card_id}`);

  const nextState = computeNextReviewState(review, status);
  await cardReviewModel.update(card_id, nextState);

  return cardService.getCardFull(card_id);
}

module.exports = { getStudyQueue, submitReview, REVIEW_STATUSES };
