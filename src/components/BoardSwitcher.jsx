import { useEffect, useRef, useState } from "react";

/**
 * Board switcher: pick the active workspace, create additional boards.
 * Boards are personal (single owner) in this phase.
 */
export function BoardSwitcher({ boards, currentId, onSelect, onCreate, onDelete, canDelete }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  const current = boards.find((b) => b.id === currentId);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const submitNew = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="board-switcher" ref={ref}>
      <button
        className="board-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        title="Switch board"
      >
        <span className="board-switcher-name">{current ? current.name : "Loading…"}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="board-switcher-menu" role="listbox">
          {boards.map((b) => (
            <div
              key={b.id}
              role="option"
              aria-selected={b.id === currentId}
              className={`board-menu-item ${b.id === currentId ? "is-active" : ""}`}
              onClick={() => { onSelect(b.id); setOpen(false); }}
            >
              <span className="board-menu-name">{b.name}</span>
              {boards.length > 1 && (
                <button
                  className="board-menu-delete"
                  title={canDelete(b.id) ? "Delete board" : "Only empty boards can be deleted"}
                  disabled={!canDelete(b.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canDelete(b.id)) { onDelete(b.id); setOpen(false); }
                  }}
                  aria-label={`Delete ${b.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {creating ? (
            <form className="board-new-form" onSubmit={submitNew}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Board name…"
                maxLength={60}
              />
              <button type="submit" disabled={!newName.trim()}>Add</button>
            </form>
          ) : (
            <button className="board-menu-new" onClick={() => setCreating(true)}>
              + New board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
