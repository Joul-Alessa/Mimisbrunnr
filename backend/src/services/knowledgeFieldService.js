const knowledgeFieldModel = require('../models/knowledgeFieldModel');
const { NotFoundError, BadRequestError } = require('../utils/errors');

async function assertFieldExists(id) {
  const field = await knowledgeFieldModel.findById(id);
  if (!field) throw new NotFoundError(`Knowledge field ${id} not found`);
  return field;
}

// A field can't become its own ancestor: reject a parent_id that is the
// field itself or one of its current descendants.
async function assertNoCycle(id, parent_id) {
  if (parent_id == null) return;
  if (Number(parent_id) === Number(id)) {
    throw new BadRequestError('A field cannot be its own parent');
  }
  const descendantIds = await knowledgeFieldModel.findDescendantIds(id);
  if (descendantIds.map(Number).includes(Number(parent_id))) {
    throw new BadRequestError('A field cannot have one of its own descendants as parent');
  }
}

async function createField({ name, description, parent_id, order_index, color, icon }) {
  if (!name) throw new BadRequestError('name is required');
  if (parent_id != null) await assertFieldExists(parent_id);

  return knowledgeFieldModel.create({ name, description, parent_id, order_index, color, icon });
}

async function updateField(id, fields) {
  await assertFieldExists(id);

  if (fields.parent_id !== undefined && fields.parent_id !== null) {
    await assertFieldExists(fields.parent_id);
    await assertNoCycle(id, fields.parent_id);
  }

  return knowledgeFieldModel.update(id, fields);
}

async function deleteField(id, { cascade = false } = {}) {
  await assertFieldExists(id);
  if (cascade) {
    await knowledgeFieldModel.removeCascade(id);
  } else {
    await knowledgeFieldModel.remove(id);
  }
}

// Builds a nested tree (children arrays) from the flat table.
async function getTree() {
  const all = await knowledgeFieldModel.findAll();
  const byId = new Map(all.map((f) => [f.id, { ...f, children: [] }]));
  const roots = [];

  for (const field of byId.values()) {
    if (field.parent_id != null && byId.has(field.parent_id)) {
      byId.get(field.parent_id).children.push(field);
    } else {
      roots.push(field);
    }
  }

  return roots;
}

module.exports = { createField, updateField, deleteField, getTree, assertFieldExists };
