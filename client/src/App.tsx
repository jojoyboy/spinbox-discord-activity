import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Disc3,
  Package,
  Layers,
  Pencil,
  Volume2,
  VolumeX,
  Users,
  History,
  Lock,
  Unlock,
  HelpCircle,
  Crown,
  Trash2,
  X,
  Link2,
  Check,
} from 'lucide-react';
import { initSession, type DiscordSession } from './discord';
import type { ActivityItem, GameMode, RoomState } from './types';
import { SpinWheel } from './components/SpinWheel';
import { OpenBoxes } from './components/OpenBoxes';
import { RandomCards } from './components/RandomCards';
import { ActivityEditor } from './components/ActivityEditor';
import { sound } from './sound';

export function App() {
  const [session, setSession] = useState<DiscordSession | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    initSession().then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let closedByUser = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId: session.roomId,
            user: session.user,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state') {
            setRoom(msg.state as RoomState);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closedByUser) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [session]);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sound.muted = next;
  };

  const copyRoomLink = () => {
    const url = new URL(window.location.href);
    if (session) url.searchParams.set('room', session.roomId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    });
  };

  if (!session || !room) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Connecting to SpinBox room...</p>
      </div>
    );
  }

  const isHost = room.hostId === session.user.id;
  const canControl = !room.hostOnly || isHost;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <div className="brand-icon">
              <Disc3 size={20} />
            </div>
            <span className="brand-name">SpinBox</span>
          </div>
          <div className="divider-v" />
          <div className="activity-title-group">
            <h1 className="activity-title">{room.title}</h1>
            <span className="topic-count">{room.items.length} topics</span>
          </div>
        </div>

        <nav className="template-switcher" aria-label="Switch Game Template">
          {(
            [
              { id: 'wheel', label: 'Spin the Wheel', icon: Disc3 },
              { id: 'boxes', label: 'Open the Box', icon: Package },
              { id: 'cards', label: 'Random Cards', icon: Layers },
            ] as { id: GameMode; label: string; icon: React.FC<{ size?: number }> }[]
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`template-pill ${room.mode === t.id ? 'active' : ''}`}
                disabled={!canControl}
                onClick={() => send({ type: 'set_mode', mode: t.id })}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="topbar-right">
          <button
            className="btn btn-primary btn-sm"
            disabled={!canControl}
            onClick={() => setEditorOpen(true)}
          >
            <Pencil size={15} />
            Edit Topics
          </button>

          {isHost && (
            <button
              className={`icon-btn ${room.hostOnly ? 'active-warn' : ''}`}
              title={
                room.hostOnly
                  ? 'Host-only mode ON (click to let everyone play)'
                  : 'Everyone can spin/pick (click to lock to host)'
              }
              onClick={() => send({ type: 'set_host_only', hostOnly: !room.hostOnly })}
            >
              {room.hostOnly ? <Lock size={17} /> : <Unlock size={17} />}
            </button>
          )}

          <button
            className="icon-btn"
            onClick={toggleMute}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          {!session.inDiscord && (
            <button
              className="icon-btn"
              onClick={copyRoomLink}
              title="Copy multiplayer room link"
            >
              {copiedLink ? <Check size={17} /> : <Link2 size={17} />}
            </button>
          )}

          <button
            className="icon-btn"
            onClick={() => setHelpOpen(true)}
            title="Discord Activity Setup"
          >
            <HelpCircle size={17} />
          </button>
        </div>
      </header>

      <main className="main-layout">
        <section className="stage-container">
          {!canControl && (
            <div className="host-lock-notice">
              <Lock size={14} /> Host-only controls enabled — watching live
            </div>
          )}

          {room.mode === 'wheel' && (
            <SpinWheel
              room={room}
              canControl={canControl}
              onSpin={() => send({ type: 'spin_wheel' })}
              onResetWheel={() => send({ type: 'reset_wheel' })}
              onToggleEliminate={(val) =>
                send({ type: 'set_eliminate_on_win', eliminateOnWin: val })
              }
            />
          )}

          {room.mode === 'boxes' && (
            <OpenBoxes
              room={room}
              canControl={canControl}
              onOpenBox={(boxIndex) => send({ type: 'open_box', boxIndex })}
              onResetBoxes={(shuffle) => send({ type: 'reset_boxes', shuffle })}
            />
          )}

          {room.mode === 'cards' && (
            <RandomCards
              room={room}
              canControl={canControl}
              onDrawCard={() => send({ type: 'draw_card' })}
              onResetCards={() => send({ type: 'reset_cards' })}
            />
          )}
        </section>

        <aside className="sidebar">
          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <div className="sidebar-title">
                <Users size={16} />
                <span>Players ({room.participants.length})</span>
              </div>
              <span className={`status-dot ${connected ? 'online' : 'offline'}`}>
                {session.inDiscord ? 'Discord' : 'Room'}
              </span>
            </div>
            <ul className="player-list">
              {room.participants.map((p) => (
                <li key={p.id} className="player-row">
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} className="player-avatar" />
                  ) : (
                    <div className="player-avatar fallback">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="player-name">
                    {p.name}
                    {p.id === session.user.id ? ' (You)' : ''}
                  </span>
                  {p.isHost && (
                    <span className="host-badge" title="Room Host">
                      <Crown size={12} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-card history-card">
            <div className="sidebar-card-header">
              <div className="sidebar-title">
                <History size={16} />
                <span>Recent Picks</span>
              </div>
              {room.history.length > 0 && canControl && (
                <button
                  className="icon-btn"
                  title="Clear history"
                  onClick={() => send({ type: 'clear_history' })}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {room.history.length === 0 ? (
              <p className="empty-history">Spin, open a box, or draw a card to start!</p>
            ) : (
              <ul className="history-list">
                {room.history.map((h) => (
                  <li key={h.id} className="history-item">
                    <span
                      className="history-dot"
                      style={{ backgroundColor: h.color }}
                    />
                    <div className="history-content">
                      <span className="history-text">{h.text}</span>
                      <span className="history-meta">by {h.by}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>

      <ActivityEditor
        isOpen={editorOpen}
        userId={session.user.id}
        initialTitle={room.title}
        initialItems={room.items}
        onClose={() => setEditorOpen(false)}
        onApply={(title: string, items: ActivityItem[]) =>
          send({ type: 'set_activity', title, items })
        }
      />

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="modal-card help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Run as a Discord Activity</h2>
              <button className="icon-btn" onClick={() => setHelpOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="help-body">
              <ol>
                <li>
                  Create an app in the{' '}
                  <strong>Discord Developer Portal</strong> and enable{' '}
                  <strong>Activities</strong>.
                </li>
                <li>
                  Copy your <strong>Client ID</strong> & <strong>Client Secret</strong> into{' '}
                  <code>.env</code> as <code>VITE_DISCORD_CLIENT_ID</code> and{' '}
                  <code>DISCORD_CLIENT_SECRET</code>.
                </li>
                <li>
                  Run <code>npm run build && npm start</code> (port <code>3001</code>) and expose
                  it with <code>cloudflared tunnel --url http://localhost:3001</code>.
                </li>
                <li>
                  Paste the tunnel URL into <strong>URL Mappings</strong> (<code>/</code> &rarr;{' '}
                  your tunnel URL) in the Developer Portal, then launch the Activity in any Voice
                  Channel!
                </li>
              </ol>
              <p className="help-note">
                Testing locally? Open this page in two browser tabs with the same{' '}
                <code>?room=demo-room</code> URL to see real-time multiplayer sync.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
