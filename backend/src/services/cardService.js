const cardModel = require('../models/cardModel');
const resourceDetailModel = require('../models/resourceDetailModel');
const cardResourceModel = require('../models/cardResourceModel');
const cardFieldModel = require('../models/cardFieldModel');
const cardReviewModel = require('../models/cardReviewModel');
const cardGenerationModel = require('../models/cardGenerationModel');
const llmService = require('./llmService');
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
      timestamp_seconds_end: detail.timestamp_seconds_end ?? null,
      page_number: detail.page_number ?? null,
      page_number_end: detail.page_number_end ?? null,
      extra: detail.extra ?? null,
    });
  }

  if (field_ids.length > 0) {
    await cardFieldModel.setFieldsForCard(card.id, field_ids);
  }

  await cardReviewModel.createForCard(card.id);

  return getCardFull(card.id);
}

// Lists cards with their resources and knowledge fields attached, batching
// the joins so the list view doesn't need to fetch each card individually.
async function listCardsFull({ type } = {}) {
  const cards = await cardModel.findAll({ type });
  const ids = cards.map((c) => c.id);

  const [resourcesByCard, fieldsByCard, detailsByCard] = await Promise.all([
    cardResourceModel.getResourcesForCards(ids),
    cardFieldModel.getFieldsForCards(ids),
    resourceDetailModel.getDetailsForCards(ids),
  ]);

  return cards.map((card) => ({
    ...card,
    resources: resourcesByCard[card.id] || [],
    fields: fieldsByCard[card.id] || [],
    resource_details: detailsByCard[card.id] || [],
  }));
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

  if (fields.resource_ids) {
    await cardResourceModel.setResourcesForCard(id, fields.resource_ids);
  }

  if (fields.resource_details) {
    await resourceDetailModel.replaceForCard(id, fields.resource_details);
  }

  return getCardFull(id);
}

async function deleteCard(id) {
  const existing = await cardModel.findById(id);
  if (!existing) throw new NotFoundError(`Card ${id} not found`);
  await cardModel.remove(id);
}

// Sends a plain-knowledge card's content through the LLM interface (spec
// section 5). `save: false` skips persisting to card_generation, letting the
// caller preview a transformation without keeping it around.
async function generateFromCard(id, mode, { save = true, study_session_id = null } = {}) {
  const card = await cardModel.findById(id);
  if (!card) throw new NotFoundError(`Card ${id} not found`);
  if (card.type !== 'plain') {
    throw new BadRequestError('Only "plain" knowledge cards can be transformed by the LLM');
  }

  const result = await llmService.generateFromContent(mode, card.content);

  if (save) {
    result.generation = await cardGenerationModel.create({
      card_id: id,
      mode: result.mode,
      generated_content: result.generated_content,
      study_session_id,
    });
  }

  return result;
}

async function listGenerations(id) {
  const card = await cardModel.findById(id);
  if (!card) throw new NotFoundError(`Card ${id} not found`);
  return cardGenerationModel.findByCardId(id);
}

module.exports = {
  createCard,
  listCardsFull,
  getCardFull,
  updateCard,
  deleteCard,
  generateFromCard,
  listGenerations,
  CARD_TYPES,
};
