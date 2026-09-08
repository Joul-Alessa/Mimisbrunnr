import { get, post, put, del } from './client';

export const listCards = (type) => get(`/cards${type ? `?type=${type}` : ''}`);
export const getCard = (id) => get(`/cards/${id}`);
export const createCard = (data) => post('/cards', data);
export const updateCard = (id, data) => put(`/cards/${id}`, data);
export const deleteCard = (id) => del(`/cards/${id}`);

export const linkResourceToCard = (id, data) => post(`/cards/${id}/resources`, data);
export const unlinkResourceFromCard = (id, resourceId) => del(`/cards/${id}/resources/${resourceId}`);

export const setCardFields = (id, fieldIds) => put(`/cards/${id}/fields`, { field_ids: fieldIds });

export const listCardGenerations = (id) => get(`/cards/${id}/generations`);
