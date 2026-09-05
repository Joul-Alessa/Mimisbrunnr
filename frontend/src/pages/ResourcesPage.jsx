import { useEffect, useState } from 'react';
import { listResources, createResource } from '../api/resources';

const RESOURCE_TYPES = ['youtube', 'book', 'article', 'ai', 'other'];

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ type: 'youtube', title: '', author_or_channel: '', url: '' });

  async function refresh() {
    try {
      setResources(await listResources());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await createResource(form);
      setForm({ type: 'youtube', title: '', author_or_channel: '', url: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Resources</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="card-form">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          placeholder="Author / Channel"
          value={form.author_or_channel}
          onChange={(e) => setForm({ ...form, author_or_channel: e.target.value })}
        />
        <input
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <button type="submit">Add resource</button>
      </form>

      <ul className="list">
        {resources.map((r) => (
          <li key={r.id}>
            <strong>[{r.type}]</strong> {r.title} {r.author_or_channel && `— ${r.author_or_channel}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
