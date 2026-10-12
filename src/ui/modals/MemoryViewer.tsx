import React, { useState } from 'react';
import { X, Database, Trash2, Plus, Edit2, Check } from 'lucide-react';
import type { UserMemoryItem } from '../../types/hud';

interface MemoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  memories: UserMemoryItem[];
  onAddMemory: (content: string, category: UserMemoryItem['category']) => void;
  onDeleteMemory: (id: string) => void;
  onUpdateMemory: (id: string, newContent: string) => void;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  onUpdateMemory,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] =
    useState<UserMemoryItem['category']>('preference');

  if (!isOpen) return null;

  const handleStartEdit = (item: UserMemoryItem) => {
    setEditingId(item.id);
    setEditText(item.content);
  };

  const handleSaveEdit = (id: string) => {
    if (editText.trim()) {
      onUpdateMemory(id, editText.trim());
    }
    setEditingId(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddMemory(newContent.trim(), newCategory);
    setNewContent('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="hud-panel modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        <div className="modal-header">
          <div
            className="modal-title"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Database size={18} color="var(--cyan-primary)" />
            <span>PERSISTENT USER MEMORY // LOCAL STORE</span>
          </div>
          <button
            className="hud-btn hud-btn-icon"
            onClick={onClose}
            style={{ width: '28px', height: '28px' }}
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
          <select
            className="form-select"
            style={{ width: '130px' }}
            value={newCategory}
            onChange={(e) =>
              setNewCategory(e.target.value as UserMemoryItem['category'])
            }
          >
            <option value="preference">Preference</option>
            <option value="system">System</option>
            <option value="personal">Personal</option>
            <option value="context">Context</option>
          </select>
          <input
            type="text"
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Add durable memory item (e.g. 'Prefers dark theme with cyan accent')..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <button
            type="submit"
            className="hud-btn hud-btn-primary"
            disabled={!newContent.trim()}
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '350px',
            overflowY: 'auto',
          }}
        >
          {memories.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              No memories recorded in local store.
            </div>
          ) : (
            memories.map((mem) => (
              <div
                key={mem.id}
                style={{
                  background: 'rgba(5, 8, 17, 0.75)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span className="hud-tag">
                      {mem.category.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {mem.createdAt}
                    </span>
                  </div>

                  {editingId === mem.id ? (
                    <div
                      style={{ display: 'flex', gap: '6px', marginTop: '6px' }}
                    >
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1 }}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="hud-btn hud-btn-icon"
                        onClick={() => handleSaveEdit(mem.id)}
                      >
                        <Check size={14} color="#86efac" />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        userSelect: 'text',
                      }}
                    >
                      {mem.content}
                    </div>
                  )}
                </div>

                {editingId !== mem.id && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="hud-btn hud-btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      title="Edit Memory"
                      onClick={() => handleStartEdit(mem)}
                    >
                      <Edit2 size={12} color="var(--cyan-primary)" />
                    </button>
                    <button
                      className="hud-btn hud-btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      title="Delete Memory"
                      onClick={() => onDeleteMemory(mem.id)}
                    >
                      <Trash2 size={12} color="var(--state-error)" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
