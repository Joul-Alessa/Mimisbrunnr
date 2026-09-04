const cardModel = require('../models/cardModel');
const resourceDetailModel = require('../models/resourceDetailModel');
const cardResourceModel = require('../models/cardResourceModel');
const cardFieldModel = require('../models/cardFieldModel');
const cardReviewModel = require('../models/cardReviewModel');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const CARD_TYPES = ['front_back', 'cloze', 'custom', 'plain'];

function validateCardPayload({ type, front, back, content, cloze_text }) {
  if (!CARD_TYPES.includes(type)) {
    throw new BadRequestError(`type must be one of: ${CARD_TYPES.join(', ')}`);
  }
  if (type === 'front_back' && (!front || !back)) {
    throw new BadRequestError('front_back cards require both front and back');
  }
  if (type === 'plain' && !content) {
    throw new BadRequestError('plain cards require content');
  }
  if (type === 'cloze' && !cloze_text) {
    throw new BadRequestError('cloze cards require cloze_text');
  }
}

// Implements the full card creation flow (spec 4.1): create the card, link
// it to resources, optionally record per-resource location details, assign
// knowledge fields, and initialize spaced repetition state.
async function createCard(payload) {
  const {
    type,
    front,
    back,
    content,
    cloze_text,
    custom_html,
    custom_js,
    custom_css,
    resource_ids = [],
    resource_details = [],
    field_ids = [],
  } = payload;

  validateCardPayload({ type, front, back, content, cloze_text });

  const card = await cardModel.create({ type, front, back, content, cloze_text, custom_html, custom_css, custom_js });

  for (const resource_id of resource_ids) {
    await cardResourceModel.addResourceToCard(card.id, resource_id);
  }

  for (const detail of resource_details) {
    await resourceDetailModel.create({
      resource_id: detail.resource_id,
      card_id: card.id,
      timestamp_seconds: detail.timestamp_seconds ?? null,
      page_number: detail.page_number ?? null,
      extra: detail.extra ?? null,
    });
  }

  if (field_ids.length > 0) {
    await cardFieldModel.setFieldsForCard(card.id, field_ids);
  }

  await cardReviewModel.createForCard(card.id);

  return getCardFull(card.id);
}

async function getCardFull(id) {
  const card = await cardModel.findById(id);
  if (!card) throw new NotFoundError(`Card ${id} not found`);

  const [resources, fields, resourceDetails, review] = await Promise.all([
    cardResourceModel.getResourcesForCard(id),
    cardFieldModel.getFieldsForCard(id),
    resourceDetailModel.findByCardId(id),
    cardReviewModel.findByCardId(id),
  ]);

  return { ...card, resources, fields, resource_details: resourceDetails, review };
}

async function updateCard(id, fields) {
  const existing = await cardModel.findById(id);
  if (!existing) throw new NotFoundError(`Card ${id} not found`);

  await cardModel.update(id, fields);

  if (fields.field_ids) {
    await cardFieldModel.setFieldsForCard(id, fields.field_ids);
  }

  return getCardFull(id);
}

async function deleteCard(id) {
  const existing = await cardModel.findById(id);
  if (!existing) throw new NotFoundError(`Card ${id} not found`);
  await cardModel.remove(id);
}

module.exports = { createCard, getCardFull, updateCard, deleteCard, CARD_TYPES };
