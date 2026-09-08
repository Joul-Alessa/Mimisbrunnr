import { useEffect, useMemo, useRef, useState } from 'react';
import { getFieldTree, listFields, createField, updateField, deleteField } from '../api/knowledgeFields';

const DEPTH_CLASS_COUNT = 6; // matches the .depth-0..depth-5 rules in App.css

// Touch has no right-click or native HTML5 drag-and-drop, so both are
// reimplemented on top of Pointer Events: a hold opens the context menu
// (mirrors onContextMenu), and moving past a small threshold before that
// fires starts a drag (mirrors onDragStart/onDrop) instead.
const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 10;

// Finds what a touch point at (x, y) is over: a field bubble (by its
// data-field-id) or the canvas background — the same two drop targets the
// native mouse onDrop handlers already support.
function findTouchTarget(x, y, canvasEl) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const fieldEl = el.closest('[data-field-id]');
  if (fieldEl) return { type: 'field', id: Number(fieldEl.dataset.fieldId) };
  if (canvasEl && canvasEl.contains(el)) return { type: 'canvas' };
  return null;
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
  touchHoverId,
  onNodePointerDown,
  onNodePointerMove,
  onNodePointerUp,
  onNodePointerCancel,
}) {
  const [dragOver, setDragOver] = useState(false);
  const isRenaming = renamingId === node.id;
  const isBeingDragged = draggedId === node.id;
  const isTouchHovered = touchHoverId === node.id;

  return (
    <div
      className={`field-set depth-${depth % DEPTH_CLASS_COUNT}${(dragOver || isTouchHovered) ? ' drag-over' : ''}${isBeingDragged ? ' dragging' : ''}`}
      data-field-id={node.id}
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
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        e.stopPropagation();
        onNodePointerDown(node.id, e);
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'touch') return;
        onNodePointerMove(node.id, e);
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch') return;
        onNodePointerUp(node.id, e);
      }}
      onPointerCancel={(e) => {
        if (e.pointerType !== 'touch') return;
        onNodePointerCancel(node.id, e);
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
              touchHoverId={touchHoverId}
              onNodePointerDown={onNodePointerDown}
              onNodePointerMove={onNodePointerMove}
              onNodePointerUp={onNodePointerUp}
              onNodePointerCancel={onNodePointerCancel}
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
  const [deleteModal, setDeleteModal] = useState(null); // { id, name, hasChildren, cascade }
  const [touchHoverId, setTouchHoverId] = useState(null);

  const canvasRef = useRef(null);
  const touchStateRef = useRef(null); // { id, startX, startY, timer, dragging, longPressFired }
  const canvasTouchRef = useRef(null); // { timer, longPressFired }

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

  function handleDelete() {
    if (!menu?.targetId) return;
    const id = menu.targetId;
    setMenu(null);
    const hasChildren = flatFields.some((f) => f.parent_id === id);
    setDeleteModal({ id, name: nameById.get(id), hasChildren, cascade: false });
  }

  function closeDeleteModal() {
    setDeleteModal(null);
  }

  async function confirmDelete() {
    const { id, cascade } = deleteModal;
    setDeleteModal(null);
    setError(null);
    try {
      await deleteField(id, cascade);
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

  // --- Touch support: a hold opens the context menu (no right-click on
  // touch); moving past a small threshold before that fires starts a drag
  // instead (no native HTML5 drag-and-drop on touch either).

  function handleNodePointerDown(nodeId, e) {
    if (renamingId === nodeId) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const state = { id: nodeId, startX, startY, dragging: false, longPressFired: false };
    state.timer = setTimeout(() => {
      state.longPressFired = true;
      setAddPopup(null);
      setMenu({ x: startX, y: startY, targetId: nodeId });
    }, LONG_PRESS_MS);
    touchStateRef.current = state;
  }

  function handleNodePointerMove(nodeId, e) {
    const state = touchStateRef.current;
    if (!state || state.id !== nodeId) return;

    if (!state.dragging && !state.longPressFired) {
      const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
      if (dist > DRAG_THRESHOLD_PX) {
        clearTimeout(state.timer);
        state.dragging = true;
        setDraggedId(nodeId);
      }
      return;
    }

    if (state.dragging) {
      e.preventDefault();
      const target = findTouchTarget(e.clientX, e.clientY, canvasRef.current);
      setTouchHoverId(target?.type === 'field' && target.id !== nodeId ? target.id : null);
    }
  }

  function handleNodePointerUp(nodeId, e) {
    const state = touchStateRef.current;
    if (!state || state.id !== nodeId) return;
    clearTimeout(state.timer);
    touchStateRef.current = null;

    // Only suppress the browser's trailing synthetic click when something
    // actually happened (menu opened, or a drag completed) — a plain short
    // tap needs its natural click to still fire, since that's also what
    // lets tapping elsewhere dismiss an already-open menu.
    if (state.longPressFired || state.dragging) {
      e.preventDefault();
    }

    if (state.dragging) {
      const target = findTouchTarget(e.clientX, e.clientY, canvasRef.current);
      setTouchHoverId(null);
      if (target?.type === 'field') {
        handleDropOn(target.id);
      } else if (target?.type === 'canvas') {
        handleDropOnCanvas();
      } else {
        setDraggedId(null);
      }
    }
  }

  function handleNodePointerCancel(nodeId) {
    const state = touchStateRef.current;
    if (!state || state.id !== nodeId) return;
    clearTimeout(state.timer);
    touchStateRef.current = null;
    setDraggedId(null);
    setTouchHoverId(null);
  }

  function handleCanvasPointerDown(e) {
    if (e.pointerType !== 'touch') return;
    if (e.target.closest('[data-field-id]')) return; // the node's own handler covers this
    const x = e.clientX;
    const y = e.clientY;
    const state = { startX: x, startY: y, longPressFired: false };
    state.timer = setTimeout(() => {
      state.longPressFired = true;
      setAddPopup(null);
      setMenu({ x, y, targetId: null });
    }, LONG_PRESS_MS);
    canvasTouchRef.current = state;
  }

  function handleCanvasPointerMove(e) {
    const state = canvasTouchRef.current;
    if (!state || state.longPressFired) return;
    const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
    if (dist > DRAG_THRESHOLD_PX) cancelCanvasLongPress();
  }

  function handleCanvasPointerUp(e) {
    const state = canvasTouchRef.current;
    if (!state) return;
    clearTimeout(state.timer);
    canvasTouchRef.current = null;
    // Only suppress the trailing click when the long-press actually opened
    // a menu — otherwise a plain tap needs its click so tapping empty
    // canvas can still dismiss an already-open menu.
    if (state.longPressFired) {
      e.preventDefault();
    }
  }

  function cancelCanvasLongPress() {
    const state = canvasTouchRef.current;
    if (state) clearTimeout(state.timer);
    canvasTouchRef.current = null;
  }

  return (
    <div>
      <h2>Knowledge Fields</h2>
      <p className="hint">
        Cada burbuja es un conjunto que contiene a sus subcampos. Clic derecho para añadir/borrar,
        doble clic para renombrar, arrastra una burbuja dentro de otra para hacerla su subcampo
        (o suéltala fuera para quitarle el padre). En móvil: mantén presionado para el menú, o
        arrastra con el dedo para reordenar.
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
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={cancelCanvasLongPress}
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
            touchHoverId={touchHoverId}
            onNodePointerDown={handleNodePointerDown}
            onNodePointerMove={handleNodePointerMove}
            onNodePointerUp={handleNodePointerUp}
            onNodePointerCancel={handleNodePointerCancel}
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

      {deleteModal && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete "{deleteModal.name}"</h3>
            {deleteModal.hasChildren ? (
              <div className="modal-form">
                <p className="hint">This field has subfields. Choose what should happen to them:</p>
                <label>
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={!deleteModal.cascade}
                    onChange={() => setDeleteModal({ ...deleteModal, cascade: false })}
                  />
                  {' '}Keep subfields — they become top-level fields
                </label>
                <label>
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={deleteModal.cascade}
                    onChange={() => setDeleteModal({ ...deleteModal, cascade: true })}
                  />
                  {' '}Delete subfields too
                </label>
              </div>
            ) : (
              <p className="hint">This field will be permanently deleted.</p>
            )}
            <div className="modal-actions">
              <button type="button" onClick={closeDeleteModal}>Cancel</button>
              <button type="button" className="danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
