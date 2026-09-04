const express = require('express');
const cardModel = require('../models/cardModel');
const cardService = require('../services/cardService');
const cardResourceModel = require('../models/cardResourceModel');
const resourceDetailModel = require('../models/resourceDetailModel');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  res.json(await cardModel.findAll({ type }));
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
  const { resource_id, timestamp_seconds, page_number, extra } = req.body;
  await cardResourceModel.addResourceToCard(req.params.id, resource_id);

  if (timestamp_seconds != null || page_number != null || extra != null) {
    await resourceDetailModel.create({
      resource_id,
      card_id: req.params.id,
      timestamp_seconds,
      page_number,
      extra,
    });
  }

  res.status(201).json(await cardService.getCardFull(req.params.id));
}));

router.delete('/:id/resources/:resourceId', asyncHandler(async (req, res) => {
  await cardResourceModel.removeResourceFromCard(req.params.id, req.params.resourceId);
  res.json(await cardService.getCardFull(req.params.id));
}));

module.exports = router;
