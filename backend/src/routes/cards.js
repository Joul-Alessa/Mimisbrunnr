const express = require('express');
const cardService = require('../services/cardService');
const cardResourceModel = require('../models/cardResourceModel');
const cardFieldModel = require('../models/cardFieldModel');
const resourceDetailModel = require('../models/resourceDetailModel');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  res.json(await cardService.listCardsFull({ type }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await cardService.getCardFull(req.params.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await cardService.createCard(req.body));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  res.json(await cardService.updateCard(req.params.id, req.body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await cardService.deleteCard(req.params.id);
  res.status(204).end();
}));

// Link/unlink an existing resource to a card, with an optional location
// detail (timestamp/page/extra) for that specific resource.
router.post('/:id/resources', asyncHandler(async (req, res) => {
  const { resource_id, timestamp_seconds, timestamp_seconds_end, page_number, page_number_end, extra } = req.body;
  await cardResourceModel.addResourceToCard(req.params.id, resource_id);

  if (timestamp_seconds != null || page_number != null || extra != null) {
    await resourceDetailModel.create({
      resource_id,
      card_id: req.params.id,
      timestamp_seconds,
      timestamp_seconds_end,
      page_number,
      page_number_end,
      extra,
    });
  }

  res.status(201).json(await cardService.getCardFull(req.params.id));
}));

router.delete('/:id/resources/:resourceId', asyncHandler(async (req, res) => {
  await cardResourceModel.removeResourceFromCard(req.params.id, req.params.resourceId);
  res.json(await cardService.getCardFull(req.params.id));
}));

// Knowledge field associations (a card can belong to multiple fields).
router.get('/:id/fields', asyncHandler(async (req, res) => {
  res.json(await cardFieldModel.getFieldsForCard(req.params.id));
}));

// Replaces the full set of fields for the card.
router.put('/:id/fields', asyncHandler(async (req, res) => {
  await cardFieldModel.setFieldsForCard(req.params.id, req.body.field_ids || []);
  res.json(await cardService.getCardFull(req.params.id));
}));

router.post('/:id/fields', asyncHandler(async (req, res) => {
  await cardFieldModel.addFieldToCard(req.params.id, req.body.field_id);
  res.status(201).json(await cardService.getCardFull(req.params.id));
}));

router.delete('/:id/fields/:fieldId', asyncHandler(async (req, res) => {
  await cardFieldModel.removeFieldFromCard(req.params.id, req.params.fieldId);
  res.json(await cardService.getCardFull(req.params.id));
}));

// LLM transformation of a "plain" knowledge card (spec section 5). Currently
// backed by a stub that echoes the prompt instead of a real model response —
// see backend/src/services/llmService.js.
router.post('/:id/generate', asyncHandler(async (req, res) => {
  const { mode = 'random', save = true } = req.body;
  res.status(201).json(await cardService.generateFromCard(req.params.id, mode, { save }));
}));

router.get('/:id/generations', asyncHandler(async (req, res) => {
  res.json(await cardService.listGenerations(req.params.id));
}));

module.exports = router;
