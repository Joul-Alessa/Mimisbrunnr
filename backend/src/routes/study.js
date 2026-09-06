const express = require('express');
const studyService = require('../services/studyService');
const asyncHandler = require('../utils/asyncHandler');
const { BadRequestError } = require('../utils/errors');

const router = express.Router();

router.get('/sessions', asyncHandler(async (req, res) => {
  res.json(await studyService.listSessions());
}));

// The currently open (unfinished) session, if any — null otherwise.
router.get('/sessions/open', asyncHandler(async (req, res) => {
  res.json(await studyService.getOpenSession());
}));

router.get('/sessions/:id', asyncHandler(async (req, res) => {
  res.json(await studyService.getSessionDetail(req.params.id));
}));

// Starts a new session over a scope: { scope_type: 'all'|'field'|'resource',
// scope_field_id?, include_subfields?, scope_resource_id? }. Closes any
// other still-open session first.
router.post('/sessions', asyncHandler(async (req, res) => {
  res.status(201).json(await studyService.startSession(req.body));
}));

router.post('/sessions/:id/end', asyncHandler(async (req, res) => {
  res.json(await studyService.endSession(req.params.id));
}));

// Weighted-random pick of the next card to show for this session.
router.get('/sessions/:id/next-card', asyncHandler(async (req, res) => {
  res.json(await studyService.getNextCard(req.params.id));
}));

router.post('/sessions/:id/reviews', asyncHandler(async (req, res) => {
  const { card_id, status } = req.body;
  if (!card_id) throw new BadRequestError('card_id is required');
  res.status(201).json(await studyService.submitSessionReview(req.params.id, card_id, status));
}));

// LLM transformation of a "plain" card, triggered from within a study
// session so the resulting generation is tied to that session.
router.post('/sessions/:id/generate', asyncHandler(async (req, res) => {
  const { card_id, mode = 'random' } = req.body;
  if (!card_id) throw new BadRequestError('card_id is required');
  res.status(201).json(await studyService.generateForSessionCard(req.params.id, card_id, mode));
}));

module.exports = router;
