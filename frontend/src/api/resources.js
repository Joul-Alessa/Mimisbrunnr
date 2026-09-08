import { get, post, put, del } from './client';

export const listResources = (type) => get(`/resources${type ? `?type=${type}` : ''}`);
export const getResource = (id) => get(`/resources/${id}`);
export const getResourceCards = (id) => get(`/resources/${id}/cards`);
export const createResource = (data) => post('/resources', data);
export const updateResource = (id, data) => put(`/resources/${id}`, data);
export const deleteResource = (id) => del(`/resources/${id}`);
