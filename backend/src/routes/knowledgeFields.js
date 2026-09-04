const express = require('express');
const knowledgeFieldModel = require('../models/knowledgeFieldModel');
const cardFieldModel = require('../models/cardFieldModel');
const knowledgeFieldService = require('../services/knowledgeFieldService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.tree === '1') {
    return res.json(await knowledgeFieldService.getTree());
  }
  res.json(await knowledgeFieldModel.findAll());
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await knowledgeFieldService.assertFieldExists(req.params.id));
}));

router.get('/:id/children', asyncHandler(async (req, res) => {
  await knowledgeFieldService.assertFieldExists(req.params.id);
  res.json(await knowledgeFieldModel.findChildren(req.params.id));
}));

// Cards in this field. Pass ?includeSubfields=1 to also include cards from
// every descendant field (spec 4.2: "field + subfields recursively").
router.get('/:id/cards', asyncHandler(async (req, res) => {
  await knowledgeFieldService.assertFieldExists(req.params.id);

  const fieldIds = req.query.includeSubfields === '1'
    ? await knowledgeFieldModel.findDescendantIds(req.params.id)
    : [req.params.id];

  const cardLists = await Promise.all(fieldIds.map((id) => cardFieldModel.getCardsForField(id)));
  const byId = new Map();
  cardLists.flat().forEach((card) => byId.set(card.id, card));
  res.json([...byId.values()]);
}));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await knowledgeFieldService.createField(req.body));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  res.json(await knowledgeFieldService.updateField(req.params.id, req.body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await knowledgeFieldService.deleteField(req.params.id);
  res.status(204).end();
}));

module.exports = router;
