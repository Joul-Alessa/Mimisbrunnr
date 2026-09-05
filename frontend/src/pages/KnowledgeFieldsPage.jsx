import { useEffect, useState } from 'react';
import { getFieldTree, listFields, createField, updateField } from '../api/knowledgeFields';

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

function emptyForm() {
  return { name: '', parent_id: '', reparent_ids: [] };
}

export default function KnowledgeFieldsPage() {
  const [tree, setTree] = useState([]);
  const [flatFields, setFlatFields] = useState([]);
  const [form, setForm] = useState(emptyForm());
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

  function toggleReparent(id) {
    setForm((prev) => ({
      ...prev,
      reparent_ids: prev.reparent_ids.includes(id)
        ? prev.reparent_ids.filter((v) => v !== id)
        : [...prev.reparent_ids, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const newField = await createField({ name: form.name, parent_id: form.parent_id || null });

      // "Insert above" existing fields: re-point their parent_id to the
      // field we just created. The backend still rejects this if it would
      // create a cycle (e.g. picking a field that is itself an ancestor of
      // the chosen parent_id above).
      for (const id of form.reparent_ids) {
        await updateField(id, { parent_id: newField.id });
      }

      setForm(emptyForm());
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  // A field can't be re-parented under the new field if it was just chosen
  // as that new field's own parent.
  const reparentCandidates = flatFields.filter((f) => String(f.id) !== String(form.parent_id));

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
        <select
          value={form.parent_id}
          onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
        >
          <option value="">(no parent — top level)</option>
          {flatFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <fieldset>
          <legend>Insert above (make these existing fields children of the new one)</legend>
          {reparentCandidates.map((f) => (
            <label key={f.id}>
              <input
                type="checkbox"
                checked={form.reparent_ids.includes(f.id)}
                onChange={() => toggleReparent(f.id)}
              />
              {f.name}
            </label>
          ))}
        </fieldset>

        <button type="submit">Add field</button>
      </form>

      <ul className="tree">
        {tree.map((node) => <FieldNode key={node.id} node={node} />)}
      </ul>
    </div>
  );
}
