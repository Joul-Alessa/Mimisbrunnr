import { useEffect, useState } from 'react';
import { getFieldTree, listFields, createField } from '../api/knowledgeFields';

function FieldNode({ node }) {
  return (
    <li>
      {node.name}
      {node.children?.length > 0 && (
        <ul>
          {node.children.map((child) => <FieldNode key={child.id} node={child} />)}
        </ul>
      )}
    </li>
  );
}

export default function KnowledgeFieldsPage() {
  const [tree, setTree] = useState([]);
  const [flatFields, setFlatFields] = useState([]);
  const [form, setForm] = useState({ name: '', parent_id: '' });
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      const [treeData, flatData] = await Promise.all([getFieldTree(), listFields()]);
      setTree(treeData);
      setFlatFields(flatData);
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
      await createField({ name: form.name, parent_id: form.parent_id || null });
      setForm({ name: '', parent_id: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Knowledge Fields</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="card-form">
        <input
          placeholder="Field name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
          <option value="">(no parent — top level)</option>
          {flatFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button type="submit">Add field</button>
      </form>

      <ul className="tree">
        {tree.map((node) => <FieldNode key={node.id} node={node} />)}
      </ul>
    </div>
  );
}
