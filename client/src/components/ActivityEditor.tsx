import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Download,
  Bookmark,
  Sparkles,
  Check,
} from 'lucide-react';
import type { ActivityItem, SavedActivity } from '../types';
import { PALETTE, PRESET_PACKS } from '../presets';

interface ActivityEditorProps {
  isOpen: boolean;
  userId: string;
  initialTitle: string;
  initialItems: ActivityItem[];
  onClose: () => void;
  onApply: (title: string, items: ActivityItem[]) => void;
}

const STORAGE_KEY = 'spinbox_saved_activities_v1';

function loadSavedActivities(): SavedActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedActivity[]) : [];
  } catch {
    return [];
  }
}

export const ActivityEditor: React.FC<ActivityEditorProps> = ({
  isOpen,
  userId,
  initialTitle,
  initialItems,
  onClose,
  onApply,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [linesText, setLinesText] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [tab, setTab] = useState<'edit' | 'presets' | 'saved'>('edit');
  const [savedList, setSavedList] = useState<SavedActivity[]>(loadSavedActivities);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setLinesText(initialItems.map((i) => i.text).join('\n'));
      const local = loadSavedActivities();
      setSavedList(local);
      fetch(`/api/saved/${encodeURIComponent(userId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.activities) && data.activities.length > 0) {
            setSavedList(data.activities as SavedActivity[]);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.activities));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialTitle, initialItems, userId]);

  if (!isOpen) return null;

  const parsedLines = linesText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setLinesText((prev) => (prev.trim() ? `${prev.trim()}\n${trimmed}` : trimmed));
    setNewItemText('');
  };

  const handleApply = () => {
    if (parsedLines.length === 0) return;
    const nextItems: ActivityItem[] = parsedLines.map((text, idx) => ({
      id: Math.random().toString(36).slice(2, 10),
      text,
      color: PALETTE[idx % PALETTE.length],
      eliminated: false,
    }));
    onApply(title.trim() || 'Untitled Activity', nextItems);
    onClose();
  };

  const persistSaved = (next: SavedActivity[]) => {
    setSavedList(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    fetch(`/api/saved/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities: next }),
    }).catch(() => {});
  };

  const handleSaveLocally = () => {
    if (parsedLines.length === 0) return;
    const entry: SavedActivity = {
      id: Math.random().toString(36).slice(2, 10),
      title: title.trim() || 'Untitled Activity',
      items: parsedLines,
      updatedAt: Date.now(),
    };
    const next = [entry, ...savedList.filter((s) => s.title !== entry.title)].slice(0, 50);
    persistSaved(next);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const handleDeleteSaved = (id: string) => {
    const next = savedList.filter((s) => s.id !== id);
    persistSaved(next);
  };

  const handleExportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ title: title.trim() || 'Activity', items: parsedLines }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'activity').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.title) setTitle(String(data.title));
        if (Array.isArray(data.items)) {
          setLinesText(data.items.map((x: unknown) => String(x)).join('\n'));
        }
        setTab('edit');
      } catch {
        alert('Invalid JSON file. Expected { "title": "...", "items": ["..."] }');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Customize Activity</h2>
            <p className="modal-subtitle">
              100% free & unlimited — works across Spin the Wheel, Open the Box & Random Cards.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="editor-tabs">
          <button
            className={`tab-btn ${tab === 'edit' ? 'active' : ''}`}
            onClick={() => setTab('edit')}
          >
            Edit Topics ({parsedLines.length})
          </button>
          <button
            className={`tab-btn ${tab === 'presets' ? 'active' : ''}`}
            onClick={() => setTab('presets')}
          >
            <Sparkles size={14} /> Starter Packs
          </button>
          <button
            className={`tab-btn ${tab === 'saved' ? 'active' : ''}`}
            onClick={() => setTab('saved')}
          >
            <Bookmark size={14} /> My Saved ({savedList.length})
          </button>
        </div>

        {tab === 'edit' && (
          <div className="editor-body">
            <label className="field-label">
              Activity Title
              <input
                type="text"
                className="text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Night Icebreakers"
                maxLength={80}
              />
            </label>

            <form className="quick-add-row" onSubmit={handleAddSingle}>
              <input
                type="text"
                className="text-input"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Quick add a topic or prompt..."
              />
              <button type="submit" className="btn btn-secondary">
                <Plus size={16} /> Add
              </button>
            </form>

            <label className="field-label">
              Topics / Items (one per line — paste as many as you want!)
              <textarea
                className="textarea-input"
                rows={9}
                value={linesText}
                onChange={(e) => setLinesText(e.target.value)}
                placeholder="Enter one topic per line..."
              />
            </label>

            <div className="editor-io-row">
              <button className="btn btn-ghost btn-sm" onClick={handleSaveLocally}>
                {justSaved ? <Check size={14} /> : <Bookmark size={14} />}
                {justSaved ? 'Saved!' : 'Save to My Activities'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleExportJson}>
                <Download size={14} /> Export JSON
              </button>
              <label className="btn btn-ghost btn-sm file-upload-btn">
                <Upload size={14} /> Import JSON
                <input type="file" accept=".json,application/json" onChange={handleImportJson} hidden />
              </label>
            </div>
          </div>
        )}

        {tab === 'presets' && (
          <div className="preset-grid">
            {PRESET_PACKS.map((pack) => (
              <div key={pack.id} className="preset-card">
                <div className="preset-badge">{pack.category}</div>
                <h3>{pack.title}</h3>
                <p>{pack.items.length} topics included</p>
                <div className="preset-preview">
                  {pack.items.slice(0, 3).map((item, i) => (
                    <span key={i} className="preset-chip">
                      {item}
                    </span>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setTitle(pack.title);
                    setLinesText(pack.items.join('\n'));
                    setTab('edit');
                  }}
                >
                  Load Pack
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'saved' && (
          <div className="saved-list">
            {savedList.length === 0 ? (
              <div className="empty-saved">
                <p>No saved activities yet. Create a list and click "Save to My Activities"!</p>
              </div>
            ) : (
              savedList.map((saved) => (
                <div key={saved.id} className="saved-row">
                  <div>
                    <h4>{saved.title}</h4>
                    <span>{saved.items.length} topics</span>
                  </div>
                  <div className="saved-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setTitle(saved.title);
                        setLinesText(saved.items.join('\n'));
                        setTab('edit');
                      }}
                    >
                      Load
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => handleDeleteSaved(saved.id)}
                      aria-label="Delete saved activity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={parsedLines.length === 0}
            onClick={handleApply}
          >
            Apply to Room ({parsedLines.length} items)
          </button>
        </div>
      </div>
    </div>
  );
};
