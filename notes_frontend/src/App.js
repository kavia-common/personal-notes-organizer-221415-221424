import React, { useEffect, useMemo, useReducer, useState } from 'react';
import './App.css';

/**
 * Ocean Professional Theme constants
 */
const THEME = {
  primary: '#2563EB',
  secondary: '#F59E0B',
  success: '#F59E0B',
  error: '#EF4444',
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
};

/**
 * Notes data model
 * id: string
 * title: string
 * content: string (markdown-friendly)
 * tags: string[]
 * createdAt: number
 * updatedAt: number
 * pinned: boolean
 */

/**
 * Data provider abstraction
 * This allows swapping between LocalStorage and API later.
 */

// PUBLIC_INTERFACE
export class NotesProvider {
  /** Create a note */
  // PUBLIC_INTERFACE
  async create(note) {
    throw new Error('Not implemented');
  }
  /** Get all notes */
  // PUBLIC_INTERFACE
  async list() {
    throw new Error('Not implemented');
  }
  /** Update a note by id */
  // PUBLIC_INTERFACE
  async update(id, patch) {
    throw new Error('Not implemented');
  }
  /** Delete a note by id */
  // PUBLIC_INTERFACE
  async remove(id) {
    throw new Error('Not implemented');
  }
}

/**
 * LocalStorage implementation
 */
const LS_KEY = 'notes_app__notes_v1';

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(notes) {
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
}

class LocalStorageProvider extends NotesProvider {
  async list() {
    return readLocal();
  }
  async create(note) {
    const notes = readLocal();
    notes.push(note);
    writeLocal(notes);
    return note;
  }
  async update(id, patch) {
    const notes = readLocal();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error('Note not found');
    const updated = { ...notes[idx], ...patch, updatedAt: Date.now() };
    notes[idx] = updated;
    writeLocal(notes);
    return updated;
  }
  async remove(id) {
    const notes = readLocal();
    const filtered = notes.filter((n) => n.id !== id);
    writeLocal(filtered);
    return true;
  }
}

/**
 * Placeholder API Provider (reads env vars)
 * Can be implemented later to call a backend API.
 */
class ApiProvider extends NotesProvider {
  constructor() {
    super();
    this.base =
      process.env.REACT_APP_API_BASE ||
      process.env.REACT_APP_BACKEND_URL ||
      '';
  }
  async list() {
    // Placeholder: fall back to local storage for now
    const ls = new LocalStorageProvider();
    return ls.list();
  }
  async create(note) {
    const ls = new LocalStorageProvider();
    return ls.create(note);
  }
  async update(id, patch) {
    const ls = new LocalStorageProvider();
    return ls.update(id, patch);
  }
  async remove(id) {
    const ls = new LocalStorageProvider();
    return ls.remove(id);
  }
}

/**
 * Utility helpers
 */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function normalizeTag(t) {
  return t.trim().toLowerCase();
}

/**
 * State management with useReducer
 */
const initialState = {
  loading: true,
  notes: [],
  search: '',
  selectedTag: 'all',
  editorOpen: false,
  editingNote: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, loading: false, notes: action.notes };
    case 'SET_SEARCH':
      return { ...state, search: action.value };
    case 'SET_TAG':
      return { ...state, selectedTag: action.value };
    case 'OPEN_EDITOR':
      return { ...state, editorOpen: true, editingNote: action.note || null };
    case 'CLOSE_EDITOR':
      return { ...state, editorOpen: false, editingNote: null };
    case 'UPSERT_NOTE': {
      const exists = state.notes.some((n) => n.id === action.note.id);
      const notes = exists
        ? state.notes.map((n) => (n.id === action.note.id ? action.note : n))
        : [action.note, ...state.notes];
      // Keep pinned notes first
      notes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
      return { ...state, notes };
    }
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    default:
      return state;
  }
}

/**
 * UI Components: TopBar, Sidebar, NotesList, NoteCard, NoteEditor, Skeletons, EmptyState
 */

function AppShell({ children }) {
  return (
    <div style={{ background: THEME.background, minHeight: '100vh' }}>
      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(249,250,251,1))',
          minHeight: '100vh',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TopBar({ search, onSearch, onNew }) {
  return (
    <header
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: THEME.surface,
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: THEME.primary, fontSize: 18 }}>
        Notes
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', maxWidth: 520, width: '100%' }}>
        <input
          aria-label="Search notes"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search notes by title or content..."
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            transition: 'box-shadow 0.2s, border-color 0.2s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = THEME.primary;
            e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e5e7eb';
            e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
          }}
        />
      </div>
      <button
        onClick={onNew}
        className="btn-primary"
        aria-label="Create new note"
        style={{
          marginLeft: 12,
          backgroundColor: THEME.primary,
          color: '#fff',
          border: 'none',
          padding: '10px 14px',
          borderRadius: 10,
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
          transition: 'transform 0.12s ease, box-shadow 0.2s ease',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        + New
      </button>
    </header>
  );
}

function Sidebar({ tags, selectedTag, setSelectedTag, onNew }) {
  return (
    <aside
      aria-label="Categories and actions"
      style={{
        width: 260,
        minWidth: 220,
        backgroundColor: THEME.surface,
        borderRight: '1px solid #e5e7eb',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <button
        onClick={onNew}
        className="btn-primary"
        style={{
          backgroundColor: THEME.primary,
          color: '#fff',
          border: 'none',
          padding: '10px 14px',
          borderRadius: 10,
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
        }}
      >
        + New Note
      </button>
      <div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 0.5,
            color: '#6b7280',
            textTransform: 'uppercase',
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
          Tags
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <TagPill
            tag="all"
            active={selectedTag === 'all'}
            onClick={() => setSelectedTag('all')}
          />
          {tags.map((t) => (
            <TagPill
              key={t}
              tag={t}
              active={selectedTag === t}
              onClick={() => setSelectedTag(t)}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          marginTop: 'auto',
          fontSize: 12,
          color: '#6b7280',
        }}
      >
        Ocean Professional theme
      </div>
    </aside>
  );
}

function TagPill({ tag, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        border: `1px solid ${active ? THEME.primary : '#e5e7eb'}`,
        color: active ? THEME.primary : THEME.text,
        backgroundColor: active ? 'rgba(37,99,235,0.06)' : THEME.surface,
        padding: '6px 10px',
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: 13,
        transition: 'all 0.2s ease',
      }}
    >
      {tag}
    </button>
  );
}

function NotesList({ notes, onOpen, onDelete, onTogglePin }) {
  if (!notes || notes.length === 0) {
    return <EmptyState />;
  }
  return (
    <div
      role="list"
      aria-label="Notes"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {notes.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          onOpen={() => onOpen(n)}
          onDelete={() => onDelete(n.id)}
          onTogglePin={() => onTogglePin(n)}
        />
      ))}
    </div>
  );
}

function NoteCard({ note, onOpen, onDelete, onTogglePin }) {
  const preview = useMemo(() => {
    const text = (note.content || '').replace(/\s+/g, ' ').trim();
    return text.length > 120 ? text.slice(0, 120) + '…' : text;
  }, [note.content]);

  return (
    <article
      role="listitem"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      style={{
        background: THEME.surface,
        border: '1px solid #e5e7eb',
        borderRadius: 14,
        padding: 14,
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'transform 0.12s ease, box-shadow 0.2s ease',
        outline: 'none',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)')
      }
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            color: THEME.text,
            lineHeight: 1.3,
            fontWeight: 700,
            flex: 1,
          }}
        >
          {note.title || 'Untitled'}
        </h3>
        <button
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          title={note.pinned ? 'Unpin' : 'Pin'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: note.pinned ? THEME.secondary : '#9ca3af',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          {note.pinned ? '📌' : '📍'}
        </button>
      </div>
      <p
        style={{
          margin: '8px 0 12px',
          color: '#4b5563',
          fontSize: 13,
          minHeight: 40,
        }}
      >
        {preview || 'No content yet.'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(note.tags || []).slice(0, 4).map((t) => (
          <span
            key={t}
            style={{
              background: 'rgba(37,99,235,0.06)',
              color: THEME.primary,
              border: `1px solid rgba(37,99,235,0.25)`,
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
        <small style={{ color: '#6b7280' }}>
          {new Date(note.updatedAt || note.createdAt).toLocaleString()}
        </small>
        <div style={{ flex: 1 }} />
        <button
          aria-label="Delete note"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: THEME.error,
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          🗑
        </button>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        textAlign: 'center',
        color: '#6b7280',
        padding: '48px 16px',
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 8 }}>🗒️</div>
      <div style={{ fontWeight: 700 }}>No notes yet</div>
      <div style={{ fontSize: 14 }}>Create your first note to get started.</div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: THEME.surface,
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div
            style={{
              height: 14,
              width: '60%',
              background: '#e5e7eb',
              borderRadius: 6,
              marginBottom: 10,
              animation: 'pulse 1.6s infinite',
            }}
          />
          <div
            style={{
              height: 10,
              width: '90%',
              background: '#e5e7eb',
              borderRadius: 6,
              marginBottom: 6,
              animation: 'pulse 1.6s infinite',
            }}
          />
          <div
            style={{
              height: 10,
              width: '70%',
              background: '#e5e7eb',
              borderRadius: 6,
              animation: 'pulse 1.6s infinite',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.5)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          background: THEME.surface,
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EditorForm({ note, onCancel, onSave }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tagsInput, setTagsInput] = useState((note?.tags || []).join(', '));
  const [pinned, setPinned] = useState(!!note?.pinned);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const tags = tagsInput
          .split(',')
          .map((t) => normalizeTag(t))
          .filter(Boolean);
        onSave({
          title: title.trim(),
          content,
          tags,
          pinned,
        });
      }}
    >
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            autoFocus
            placeholder="Note title"
            aria-label="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              outline: 'none',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Write your note in plain text or Markdown…"
            aria-label="Note content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              outline: 'none',
              resize: 'vertical',
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            }}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <input
            placeholder="Tags (comma separated)"
            aria-label="Tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              outline: 'none',
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 16,
          borderTop: '1px solid #e5e7eb',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            color: THEME.text,
            padding: '10px 14px',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            background: THEME.primary,
            border: 'none',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
          }}
        >
          Save
        </button>
      </div>
    </form>
  );
}

/**
 * Root App
 */
// PUBLIC_INTERFACE
function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const provider = useMemo(() => {
    // Easily switch to ApiProvider later
    const useApi = false && (process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL);
    return useApi ? new ApiProvider() : new LocalStorageProvider();
  }, []);

  // load notes
  useEffect(() => {
    let mounted = true;
    (async () => {
      const notes = await provider.list();
      if (mounted) dispatch({ type: 'INIT', notes: sortNotes(notes) });
    })();
    return () => {
      mounted = false;
    };
  }, [provider]);

  // Derived values
  const tags = useMemo(() => {
    const s = new Set();
    state.notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [state.notes]);

  const filteredNotes = useMemo(() => {
    const q = state.search.trim().toLowerCase();
    return state.notes.filter((n) => {
      const matchesQuery =
        !q ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q);
      const matchesTag =
        state.selectedTag === 'all' ||
        (n.tags || []).map(normalizeTag).includes(normalizeTag(state.selectedTag));
      return matchesQuery && matchesTag;
    });
  }, [state.notes, state.search, state.selectedTag]);

  function sortNotes(arr) {
    const notes = [...arr];
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
    return notes;
  }

  async function handleSaveNote(partial) {
    if (state.editingNote) {
      const updated = await provider.update(state.editingNote.id, partial);
      dispatch({ type: 'UPSERT_NOTE', note: updated });
    } else {
      const now = Date.now();
      const newNote = {
        id: uid(),
        title: partial.title || '',
        content: partial.content || '',
        tags: partial.tags || [],
        createdAt: now,
        updatedAt: now,
        pinned: !!partial.pinned,
      };
      await provider.create(newNote);
      dispatch({ type: 'UPSERT_NOTE', note: newNote });
    }
    dispatch({ type: 'CLOSE_EDITOR' });
  }

  async function handleDelete(id) {
    await provider.remove(id);
    dispatch({ type: 'DELETE_NOTE', id });
  }

  async function handleTogglePin(note) {
    const updated = await provider.update(note.id, { pinned: !note.pinned });
    dispatch({ type: 'UPSERT_NOTE', note: updated });
  }

  return (
    <AppShell>
      <TopBar
        search={state.search}
        onSearch={(value) => dispatch({ type: 'SET_SEARCH', value })}
        onNew={() => dispatch({ type: 'OPEN_EDITOR', note: null })}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 0,
          minHeight: 'calc(100vh - 65px)',
        }}
      >
        <Sidebar
          tags={tags}
          selectedTag={state.selectedTag}
          setSelectedTag={(value) => dispatch({ type: 'SET_TAG', value })}
          onNew={() => dispatch({ type: 'OPEN_EDITOR', note: null })}
        />
        <main
          role="main"
          style={{
            padding: 16,
            maxWidth: 1200,
            width: '100%',
          }}
        >
          {state.loading ? (
            <SkeletonList />
          ) : (
            <NotesList
              notes={filteredNotes}
              onOpen={(n) => dispatch({ type: 'OPEN_EDITOR', note: n })}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          )}
        </main>
      </div>

      <Modal
        open={state.editorOpen}
        onClose={() => dispatch({ type: 'CLOSE_EDITOR' })}
        title={state.editingNote ? 'Edit note' : 'New note'}
      >
        <EditorForm
          note={state.editingNote}
          onCancel={() => dispatch({ type: 'CLOSE_EDITOR' })}
          onSave={handleSaveNote}
        />
      </Modal>
    </AppShell>
  );
}

export default App;
