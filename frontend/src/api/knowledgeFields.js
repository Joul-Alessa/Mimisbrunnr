import { get, post, put, del } from './client';

export const listFields = () => get('/knowledge-fields');
export const getFieldTree = () => get('/knowledge-fields?tree=1');
export const getField = (id) => get(`/knowledge-fields/${id}`);
export const getFieldCards = (id, includeSubfields = false) =>
  get(`/knowledge-fields/${id}/cards${includeSubfields ? '?includeSubfields=1' : ''}`);
export const createField = (data) => post('/knowledge-fields', data);
export const updateField = (id, data) => put(`/knowledge-fields/${id}`, data);
export const deleteField = (id, cascade = false) => del(`/knowledge-fields/${id}${cascade ? '?cascade=1' : ''}`);
