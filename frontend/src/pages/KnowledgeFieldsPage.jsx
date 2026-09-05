import { useEffect, useMemo, useRef, useState } from 'react';
import { getFieldTree, listFields, createField, updateField, deleteField } from '../api/knowledgeFields';

const DEPTH_COLORS = [
  '#dbeafe', // blue
  '#fef3c7', // amber
  '#dcfce7', // green
  '#fce7f3', // pink
  '#ede9fe', // violet
  '#ffedd5', // orange
];

function colorForDepth(depth) {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

// All descendant ids of `id` (including itself), computed from the flat
// list — used to stop a field from being dropped onto itself or one of its
// own subfields (the backend rejects it too, but blocking it client-side
// gives instant feedback while dragging).
function descendantIdSet(flatFields, id) {
  const childrenByParent = new Map();
  flatFields.forEach((f) => {
    const key = f.parent_id ?? 'root';
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(f.id);
  });

  const result = new Set([id]);
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const childId of childrenByParent.get(current) || []) {
      if (!result.has(childId)) {
        result.add(childId);
        stack.push(childId);
      }
    }
  }
  return result;
}

function FieldSetNode({
  node,
  depth,
  draggedId,
  onDragStart,
  onDropOn,
  onContextMenu,
  renamingId,
  renameValue,
  onRenameChange,
  onRenameSubmit,
}) {
  const [dragOver, setDragOver] = useState(false);
  const isRenaming = renamingId === node.id;
  const isBeingDragged = draggedId === node.id;

  return (
    <div
      className={`field-set depth-${depth}${dragOver ? ' drag-over' : ''}${isBeingDragged ? ' dragging' : ''}`}
      style={{ background: colorForDepth(depth) }}
      draggable={!isRenaming}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(node.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        onDropOn(node.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node.id);
      }}
    >
      {isRenaming ? (
        <form
          className="field-set-rename"
          onSubmit={(e) => {
            e.preventDefault();
            onRenameSubmit(node.id);
          }}
        >
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => onRenameSubmit(node.id)}
          />
        </form>
      ) : (
        <span
          className="field-set-label"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onContextMenu(null, node.id, 'rename');
          }}
          title="Doble clic para renombrar, clic derecho para más opciones"
        >
          {node.name}
        </span>
      )}

      {node.children?.length > 0 && (
        <div className="field-set-children">
          {node.children.map((child) => (
            <FieldSetNode
              key={child.id}
              node={child}
              depth={depth + 1}
              draggedId={draggedId}
              onDragStart={onDragStart}
              onDropOn={onDropOn}
              onContextMenu={onContextMenu}
              renamingId={renamingId}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeFieldsPage() {
  const [tree, setTree] = useState([]);
  const [flatFields, setFlatFields] = useState([]);
  const [error, setError] = useState(null);

  const [draggedId, setDraggedId] = useState(null);
  const [menu, setMenu] = useState(null); // { x, y, targetId }
  const [addPopup, setAddPopup] = useState(null); // { x, y, parentId }
  const [addValue, setAddValue] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const canvasRef = useRef(null);

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

  useEffect(() => {
    function closeMenus() {
      setMenu(null);
      setAddPopup(null);
    }
    window.addEventListener('click', closeMenus);
    window.addEventListener('scroll', closeMenus, true);
    return () => {
      window.removeEventListener('click', closeMenus);
      window.removeEventListener('scroll', closeMenus, true);
    };
  }, []);

  const nameById = useMemo(() => new Map(flatFields.map((f) => [f.id, f.name])), [flatFields]);

  // Right-click on a field opens the context menu; passing action="rename"
  // (from a double-click) skips the menu and jumps straight into rename mode.
  function handleContextMenu(e, targetId, action) {
    if (action === 'rename') {
      startRename(targetId);
      return;
    }
    setAddPopup(null);
    setMenu({ x: e.clientX, y: e.clientY, targetId });
  }

  function handleCanvasContextMenu(e) {
    e.preventDefault();
    setAddPopup(null);
    setMenu({ x: e.clientX, y: e.clientY, targetId: null });
  }

  function openAddPopup() {
    if (!menu) return;
    setAddPopup({ x: menu.x, y: menu.y, parentId: menu.targetId });
    setAddValue('');
    setMenu(null);
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    if (!addValue.trim()) return;
    setError(null);
    try {
      await createField({ name: addValue.trim(), parent_id: addPopup.parentId });
      setAddPopup(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function startRename(id) {
    setMenu(null);
    setRenamingId(id);
    setRenameValue(nameById.get(id) || '');
  }

  async function handleRenameSubmit(id) {
    const value = renameValue.trim();
    setRenamingId(null);
    if (!value || value === nameById.get(id)) return;
    setError(null);
    try {
      await updateField(id, { name: value });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!menu?.targetId) return;
    const id = menu.targetId;
    setMenu(null);
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${nameById.get(id)}"? Its subfields will become top-level fields.`)) return;
    setError(null);
    try {
      await deleteField(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDropOn(targetId) {
    if (draggedId == null) return;
    const sourceId = draggedId;
    setDraggedId(null);
    if (sourceId === targetId) return;

    if (descendantIdSet(flatFields, sourceId).has(targetId)) {
      setError('No puedes convertir un campo en hijo de uno de sus propios subcampos.');
      return;
    }

    setError(null);
    try {
      await updateField(sourceId, { parent_id: targetId });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDropOnCanvas() {
    if (draggedId == null) return;
    const sourceId = draggedId;
    setDraggedId(null);
    setError(null);
    try {
      await updateField(sourceId, { parent_id: null });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Knowledge Fields</h2>
      <p className="hint">
        Cada burbuja es un conjunto que contiene a sus subcampos. Clic derecho para añadir/borrar,
        doble clic para renombrar, arrastra una burbuja dentro de otra para hacerla su subcampo
        (o suéltala fuera para quitarle el padre).
      </p>
      {error && <p className="error">{error}</p>}

      <div
        ref={canvasRef}
        className="field-canvas"
        onContextMenu={handleCanvasContextMenu}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleDropOnCanvas();
        }}
      >
        {tree.length === 0 && <p className="hint">No hay campos todavía — clic derecho aquí para crear el primero.</p>}
        {tree.map((node) => (
          <FieldSetNode
            key={node.id}
            node={node}
            depth={0}
            draggedId={draggedId}
            onDragStart={setDraggedId}
            onDropOn={handleDropOn}
            onContextMenu={handleContextMenu}
            renamingId={renamingId}
            renameValue={renameValue}
            onRenameChange={setRenameValue}
            onRenameSubmit={handleRenameSubmit}
          />
        ))}
      </div>

      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={openAddPopup}>
            + Add {menu.targetId ? 'subfield' : 'field'}
          </button>
          {menu.targetId && (
            <>
              <button type="button" onClick={() => startRename(menu.targetId)}>Rename</button>
              <button type="button" className="danger" onClick={handleDelete}>Delete</button>
            </>
          )}
        </div>
      )}

      {addPopup && (
        <form
          className="add-popup"
          style={{ left: addPopup.x, top: addPopup.y }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleAddSubmit}
        >
          <input
            autoFocus
            placeholder="Field name"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      )}
    </div>
  );
}
