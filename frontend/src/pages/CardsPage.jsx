import { useEffect, useState } from 'react';
import { listCards, getCard, createCard, updateCard, deleteCard, generateFromCard } from '../api/cards';
import { listResources } from '../api/resources';
import { listFields } from '../api/knowledgeFields';

const CARD_TYPES = ['plain', 'front_back', 'cloze', 'custom'];
const CARD_TYPE_LABELS = {
  plain: 'Plain Knowledge',
  front_back: 'Front / Back',
  cloze: 'Cloze',
  custom: 'Custom',
};

function getTypeLabel(type) {
  return CARD_TYPE_LABELS[type] || type;
}

function emptyForm() {
  return {
    type: 'plain',
    content: '',
    front: '',
    back: '',
    cloze_text: '',
    resource_ids: [],
    field_ids: [],
  };
}

export default function CardsPage() {
  const [cards, setCards] = useState([]);
  const [resources, setResources] = useState([]);
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [generated, setGenerated] = useState({});

  async function refresh() {
    try {
      const [cardsData, resourcesData, fieldsData] = await Promise.all([
        listCards(),
        listResources(),
        listFields(),
      ]);
      setCards(cardsData);
      setResources(resourcesData);
      setFields(fieldsData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleMultiSelect(field, value) {
    setForm((prev) => {
      const current = prev[field];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  }

  async function openEditModal(card) {
    setError(null);
    try {
      const full = await getCard(card.id);
      setEditingId(full.id);
      setForm({
        type: full.type,
        content: full.content || '',
        front: full.front || '',
        back: full.back || '',
        cloze_text: full.cloze_text || '',
        resource_ids: (full.resources || []).map((r) => r.id),
        field_ids: (full.fields || []).map((f) => f.id),
      });
      setIsModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await updateCard(editingId, form);
      } else {
        await createCard(form);
      }
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(cardId) {
    if (!window.confirm('Delete this card? This cannot be undone.')) return;
    setError(null);
    try {
      await deleteCard(cardId);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate(cardId) {
    setError(null);
    try {
      const result = await generateFromCard(cardId, 'random');
      setGenerated((prev) => ({ ...prev, [cardId]: result }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Cards</h2>
      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <button type="button" onClick={openCreateModal}>+ Add card</button>
      </div>

      <ul className="list">
        {cards.map((c) => (
          <li key={c.id} className="list-item">
            <span>
              <strong>[{getTypeLabel(c.type)}]</strong> {c.content || c.front || c.cloze_text}
            </span>
            <span className="list-item-actions">
              {c.type === 'plain' && (
                <button type="button" onClick={() => handleGenerate(c.id)}>Generate (LLM)</button>
              )}
              <button type="button" onClick={() => openEditModal(c)}>Edit</button>
              <button type="button" onClick={() => handleDelete(c.id)}>Delete</button>
            </span>
            {generated[c.id] && (
              <pre className="generated">{generated[c.id].mode}: {generated[c.id].generated_content}</pre>
            )}
          </li>
        ))}
        {cards.length === 0 && <p className="hint">No cards yet.</p>}
      </ul>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit card' : 'Add card'}</h3>
            <form onSubmit={handleSubmit} className="modal-form">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {CARD_TYPES.map((t) => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
              </select>

              {form.type === 'plain' && (
                <textarea
                  placeholder="Plain knowledge content"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  required
                />
              )}
              {form.type === 'front_back' && (
                <>
                  <input placeholder="Front" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} required />
                  <input placeholder="Back" value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} required />
                </>
              )}
              {form.type === 'cloze' && (
                <textarea
                  placeholder="Cloze text (use {{...}} for blanks)"
                  value={form.cloze_text}
                  onChange={(e) => setForm({ ...form, cloze_text: e.target.value })}
                  required
                />
              )}

              <fieldset>
                <legend>Resources</legend>
                {resources.map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={form.resource_ids.includes(r.id)}
                      onChange={() => toggleMultiSelect('resource_ids', r.id)}
                    />
                    {r.title}
                  </label>
                ))}
              </fieldset>

              <fieldset>
                <legend>Knowledge fields</legend>
                {fields.map((f) => (
                  <label key={f.id}>
                    <input
                      type="checkbox"
                      checked={form.field_ids.includes(f.id)}
                      onChange={() => toggleMultiSelect('field_ids', f.id)}
                    />
                    {f.name}
                  </label>
                ))}
              </fieldset>

              <div className="modal-actions">
                <button type="button" onClick={closeModal}>Cancel</button>
                <button type="submit">{editingId ? 'Save changes' : 'Add card'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
