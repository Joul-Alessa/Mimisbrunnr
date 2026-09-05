import { get, post } from './client';

export const getStudyQueue = ({ fieldId, includeSubfields, limit } = {}) => {
  const params = new URLSearchParams();
  if (fieldId) params.set('fieldId', fieldId);
  if (includeSubfields) params.set('includeSubfields', '1');
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  return get(`/study/queue${qs ? `?${qs}` : ''}`);
};

export const submitReview = (cardId, status) => post('/study/review', { card_id: cardId, status });
