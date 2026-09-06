import { get, post } from './client';

export const listStudySessions = () => get('/study/sessions');
export const getOpenStudySession = () => get('/study/sessions/open');
export const getStudySession = (id) => get(`/study/sessions/${id}`);

export const startStudySession = (payload) => post('/study/sessions', payload);
export const endStudySession = (id) => post(`/study/sessions/${id}/end`);

export const getNextStudyCard = (sessionId) => get(`/study/sessions/${sessionId}/next-card`);
export const submitSessionReview = (sessionId, cardId, status) =>
  post(`/study/sessions/${sessionId}/reviews`, { card_id: cardId, status });

export const generateForSessionCard = (sessionId, cardId, mode = 'random') =>
  post(`/study/sessions/${sessionId}/generate`, { card_id: cardId, mode });
