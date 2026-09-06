import { useEffect, useMemo, useState } from 'react';
import { listCards, getCard, createCard, updateCard, deleteCard, generateFromCard } from '../api/cards';
import { listResources } from '../api/resources';
import { listFields } from '../api/knowledgeFields';
import MarkdownField from '../components/MarkdownField';
import MarkdownView from '../components/MarkdownView';

const CARD_TYPES = ['plain', 'front_back', 'cloze', 'custom'];
const CARD_TYPE_LABELS = {
  plain: 'Plain Knowledge',
  front_back: 'Front / Back',
  cloze: 'Cloze',
  custom: 'Custom',
};

const RESOURCE_TYPE_LABELS = {
  youtube: 'YouTube',
  book: 'Book',
  article: 'Article',
  ai: 'AI',
  other: 'Other',
};

function getTypeLabel(type) {
  return CARD_TYPE_LABELS[type] || type;
}

function getResourceTypeLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

function matchesResourceSearch(resource, search) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [resource.title, resource.author_or_channel, resource.notes, resource.url]
    .filter(Boolean)
    .some((field) => field.toLowerCase().includes(needle));
}

function matchesCardSearch(card, search) {
  if (!search) return true;
  const needle = search.toLowerCase();
  const haystack = [
    card.content,
    card.front,
    card.back,
    card.cloze_text,
    getTypeLabel(card.type),
    ...(card.resources || []).flatMap((r) => [r.title, r.author_or_channel]),
    ...(card.fields || []).map((f) => f.name),
  ];
  return haystack.filter(Boolean).some((field) => field.toLowerCase().includes(needle));
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
  const [resourceSearch, setResourceSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');

  const filteredResources = useMemo(
    () => resources.filter((r) => matchesResourceSearch(r, resourceSearch)),
    [resources, resourceSearch]
  );

  const filteredCards = useMemo(
    () =>
      cards.filter(
        (c) =>
          (typeFilter ? c.type === typeFilter : true) &&
          (fieldFilter ? (c.fields || []).some((f) => String(f.id) === fieldFilter) : true) &&
          matchesCardSearch(c, cardSearch)
      ),
    [cards, cardSearch, typeFilter, fieldFilter]
  );

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
    setResourceSearch('');
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
      setResourceSearch('');
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
        <input
          placeholder="Search content, source, type, knowledge field..."
          value={cardSearch}
          onChange={(e) => setCardSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {CARD_TYPES.map((t) => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
        </select>
        <select value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
          <option value="">All knowledge fields</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <ul className="list">
        {filteredCards.map((c) => (
          <li key={c.id} className="card-list-item">
            <div className="card-list-item-header">
              <strong>[{getTypeLabel(c.type)}]</strong>
              <span className="list-item-actions">
                {c.type === 'plain' && (
                  <button type="button" onClick={() => handleGenerate(c.id)}>Generate (LLM)</button>
                )}
                <button type="button" onClick={() => openEditModal(c)}>Edit</button>
                <button type="button" onClick={() => handleDelete(c.id)}>Delete</button>
              </span>
            </div>
            <div className="card-list-item-body">
              {c.type === 'front_back' ? (
                <>
                  <MarkdownView content={c.front} />
                  <MarkdownView content={c.back} />
                </>
              ) : (
                <MarkdownView content={c.content || c.cloze_text} />
              )}
            </div>
            {c.resources && c.resources.length > 0 && (
              <p className="card-source hint">
                Source: {c.resources.map((r) => `[${getResourceTypeLabel(r.type)}] ${r.title}`).join(', ')}
              </p>
            )}
            {generated[c.id] && (
              <pre className="generated">{generated[c.id].mode}: {generated[c.id].generated_content}</pre>
            )}
          </li>
        ))}
        {cards.length === 0 && <p className="hint">No cards yet.</p>}
        {cards.length > 0 && filteredCards.length === 0 && (
          <p className="hint">No cards match your search/filters.</p>
        )}
      </ul>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit card' : 'Add card'}</h3>
            <form onSubmit={handleSubmit} className="modal-form">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {CARD_TYPES.map((t) => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
              </select>

              {form.type === 'plain' && (
                <MarkdownField
                  placeholder="Plain knowledge content"
                  value={form.content}
                  onChange={(v) => setForm({ ...form, content: v })}
                  required
                />
              )}
              {form.type === 'front_back' && (
                <>
                  <MarkdownField placeholder="Front" value={form.front} onChange={(v) => setForm({ ...form, front: v })} required />
                  <MarkdownField placeholder="Back" value={form.back} onChange={(v) => setForm({ ...form, back: v })} required />
                </>
              )}
              {form.type === 'cloze' && (
                <MarkdownField
                  placeholder="Cloze text (use {{...}} for blanks)"
                  value={form.cloze_text}
                  onChange={(v) => setForm({ ...form, cloze_text: v })}
                  required
                />
              )}

              <fieldset>
                <legend>Resources</legend>
                <input
                  placeholder="Search title, author, notes, URL..."
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                />
                <ul className="list">
                  {filteredResources.map((r) => (
                    <li key={r.id} className="list-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.resource_ids.includes(r.id)}
                          onChange={() => toggleMultiSelect('resource_ids', r.id)}
                        />
                        <strong>[{getResourceTypeLabel(r.type)}]</strong> {r.title} {r.author_or_channel && `— ${r.author_or_channel}`}
                      </label>
                    </li>
                  ))}
                  {filteredResources.length === 0 && <p className="hint">No resources match your search.</p>}
                </ul>
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
