const express = require('express');
const studyService = require('../services/studyService');
const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/errors');

const router = express.Router();

// GET /api/study/queue?fieldId=&includeSubfields=1&limit=10
router.get('/queue', asyncHandler(async (req, res) => {
  const { fieldId, includeSubfields, limit } = req.query;

  res.json(await studyService.getStudyQueue({
    fieldId: fieldId || null,
    includeSubfields: includeSubfields === '1',
    limit: limit ? parseInt(limit, 10) : 20,
  }));
}));

// POST /api/study/review  { card_id, status }
router.post('/review', asyncHandler(async (req, res) => {
  const { card_id, status } = req.body;
  if (!card_id) throw new BadRequestError('card_id is required');

  res.json(await studyService.submitReview(card_id, status));
}));

module.exports = router;
