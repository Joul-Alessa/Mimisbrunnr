import { useEffect, useMemo, useState } from 'react';
import { listResources, createResource, updateResource } from '../api/resources';

const RESOURCE_TYPES = ['youtube', 'book', 'article', 'ai', 'other'];

function emptyForm() {
  return { type: 'youtube', title: '', author_or_channel: '', url: '', editorial: '', notes: '' };
}

function matchesSearch(resource, search) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [resource.title, resource.author_or_channel, resource.notes, resource.url]
    .filter(Boolean)
    .some((field) => field.toLowerCase().includes(needle));
}

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

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

  const filteredResources = useMemo(
    () => resources.filter((r) => (typeFilter ? r.type === typeFilter : true) && matchesSearch(r, search)),
    [resources, search, typeFilter]
  );

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  }

  function openEditModal(resource) {
    setEditingId(resource.id);
    setForm({
      type: resource.type,
      title: resource.title,
      author_or_channel: resource.author_or_channel || '',
      url: resource.url || '',
      editorial: resource.editorial || '',
      notes: resource.notes || '',
    });
    setIsModalOpen(true);
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
        await updateResource(editingId, form);
      } else {
        await createResource(form);
      }
      closeModal();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Resources</h2>
      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <button type="button" onClick={openCreateModal}>+ Add resource</button>
        <input
          placeholder="Search title, author, notes, URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <ul className="list">
        {filteredResources.map((r) => (
          <li key={r.id} className="list-item">
            <span>
              <strong>[{r.type}]</strong> {r.title} {r.author_or_channel && `— ${r.author_or_channel}`}
            </span>
            <button type="button" onClick={() => openEditModal(r)}>Edit</button>
          </li>
        ))}
        {filteredResources.length === 0 && <p className="hint">No resources match your search/filter.</p>}
      </ul>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit resource' : 'Add resource'}</h3>
            <form onSubmit={handleSubmit} className="modal-form">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
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
              <input
                placeholder="Editorial (books)"
                value={form.editorial}
                onChange={(e) => setForm({ ...form, editorial: e.target.value })}
              />
              <input
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" onClick={closeModal}>Cancel</button>
                <button type="submit">{editingId ? 'Save changes' : 'Add resource'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
