import { useEffect, useState } from 'react';
import { listCards, createCard, generateFromCard } from '../api/cards';
import { listResources } from '../api/resources';
import { listFields } from '../api/knowledgeFields';

const CARD_TYPES = ['plain', 'front_back', 'cloze', 'custom'];

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await createCard(form);
      setForm(emptyForm());
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

      <form onSubmit={handleSubmit} className="card-form">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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

        <button type="submit">Add card</button>
      </form>

      <ul className="list">
        {cards.map((c) => (
          <li key={c.id}>
            <strong>[{c.type}]</strong> {c.content || c.front || c.cloze_text}
            {c.type === 'plain' && (
              <button type="button" onClick={() => handleGenerate(c.id)}>Generate (LLM)</button>
            )}
            {generated[c.id] && (
              <pre className="generated">{generated[c.id].mode}: {generated[c.id].generated_content}</pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
