const express = require('express');
const resourceModel = require('../models/resourceModel');
const cardResourceModel = require('../models/cardResourceModel');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const router = express.Router();
const RESOURCE_TYPES = ['youtube', 'book', 'article', 'ai', 'other'];

async function loadResourceOr404(id) {
  const resource = await resourceModel.findById(id);
  if (!resource) throw new NotFoundError(`Resource ${id} not found`);
  return resource;
}

router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;
  res.json(await resourceModel.findAll({ type }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await loadResourceOr404(req.params.id));
}));

router.get('/:id/cards', asyncHandler(async (req, res) => {
  await loadResourceOr404(req.params.id);
  res.json(await cardResourceModel.getCardsForResource(req.params.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { type, title, author_or_channel, url, editorial, notes } = req.body;

  if (!RESOURCE_TYPES.includes(type)) {
    throw new BadRequestError(`type must be one of: ${RESOURCE_TYPES.join(', ')}`);
  }
  if (!title) {
    throw new BadRequestError('title is required');
  }

  const resource = await resourceModel.create({ type, title, author_or_channel, url, editorial, notes });
  res.status(201).json(resource);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  await loadResourceOr404(req.params.id);

  if (req.body.type && !RESOURCE_TYPES.includes(req.body.type)) {
    throw new BadRequestError(`type must be one of: ${RESOURCE_TYPES.join(', ')}`);
  }

  res.json(await resourceModel.update(req.params.id, req.body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await loadResourceOr404(req.params.id);
  await resourceModel.remove(req.params.id);
  res.status(204).end();
}));

module.exports = router;
