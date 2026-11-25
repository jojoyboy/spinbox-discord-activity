import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);
const DISCORD_CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';

const PALETTE = [
  '#FF595E',
  '#FF924C',
  '#FFCA3A',
  '#8AC926',
  '#1982C4',
  '#6A4C93',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
];

const DEFAULT_ITEMS = [
  'Two truths and a lie',
  'Most embarrassing moment',
  'Unpopular opinion',
  'Dream travel destination',
  'Best concert or live event',
  'Weirdest food combo you love',
  'Hidden talent',
  'Last song you had on repeat',
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeItems(rawItems) {
  return rawItems
    .map((item, idx) => {
      const text = typeof item === 'string' ? item.trim() : String(item?.text ?? '').trim();
      if (!text) return null;
      return {
        id: typeof item === 'object' && item?.id ? String(item.id) : makeId(),
        text,
        color:
          typeof item === 'object' && item?.color
            ? String(item.color)
            : PALETTE[idx % PALETTE.length],
        eliminated: Boolean(typeof item === 'object' ? item?.eliminated : false),
      };
    })
    .filter(Boolean);
}

function createRoom(roomId) {
  const items = normalizeItems(DEFAULT_ITEMS);
  const itemIds = items.map((i) => i.id);
  return {
    roomId,
    title: 'Icebreaker Topics',
    mode: 'wheel',
    items,
    wheel: {
      rotation: 0,
      isSpinning: false,
      targetIndex: null,
      winner: null,
      eliminateOnWin: false,
      spinId: 0,
      spunBy: null,
    },
    boxes: {
      order: shuffleArray(itemIds),
      opened: [],
      lastOpened: null,
    },
    cards: {
      deckOrder: shuffleArray(itemIds),
      drawn: [],
      currentCard: null,
    },
    history: [],
    hostId: null,
    hostOnly: false,
    participants: new Map(),
    spinTimer: null,
  };
}

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId);
}

function serializeRoom(room) {
  return {
    roomId: room.roomId,
    title: room.title,
    mode: room.mode,
    items: room.items,
    wheel: room.wheel,
    boxes: room.boxes,
    cards: room.cards,
    history: room.history,
    hostId: room.hostId,
    hostOnly: room.hostOnly,
    participants: Array.from(room.participants.values()),
  };
}

function broadcastRoom(room) {
  const payload = JSON.stringify({
    type: 'state',
    state: serializeRoom(room),
  });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.roomId === room.roomId) {
      client.send(payload);
    }
  }
}

function syncDerivedOrders(room, shouldShuffle = true) {
  const ids = room.items.map((i) => i.id);
  room.boxes = {
    order: shouldShuffle ? shuffleArray(ids) : ids,
    opened: [],
    lastOpened: null,
  };
  room.cards = {
    deckOrder: shouldShuffle ? shuffleArray(ids) : ids,
    drawn: [],
    currentCard: null,
  };
  room.wheel = {
    ...room.wheel,
    isSpinning: false,
    targetIndex: null,
    winner: null,
  };
  if (room.spinTimer) {
    clearTimeout(room.spinTimer);
    room.spinTimer = null;
  }
}

const app = express();
app.use(express.json());

const DATA_DIR = path.join(__dirname, '../data');
const SAVED_FILE = path.join(DATA_DIR, 'saved-activities.json');

function readAllSaved() {
  try {
    if (!fs.existsSync(SAVED_FILE)) return {};
    return JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAllSaved(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SAVED_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get('/api/saved/:userId', (req, res) => {
  const userId = String(req.params.userId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!userId) return res.json({ activities: [] });
  const all = readAllSaved();
  res.json({ activities: Array.isArray(all[userId]) ? all[userId] : [] });
});

app.put('/api/saved/:userId', (req, res) => {
  const userId = String(req.params.userId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!userId) return res.status(400).json({ error: 'Invalid userId' });
  const activities = Array.isArray(req.body?.activities) ? req.body.activities.slice(0, 50) : [];
  const all = readAllSaved();
  all[userId] = activities;
  writeAllSaved(all);
  res.json({ ok: true, activities });
});

app.post('/api/token', async (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Server is missing VITE_DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET',
    });
  }

  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('Discord token exchange error:', err);
    return res.status(500).json({ error: 'Failed to exchange Discord token' });
  }
});

const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.clientId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const roomId = String(msg.roomId || 'demo-room').slice(0, 64);
      const user = msg.user || {};
      const clientId = String(user.id || makeId());
      const name = String(user.name || 'Player').slice(0, 32);
      const avatar = user.avatar ? String(user.avatar) : null;

      ws.roomId = roomId;
      ws.clientId = clientId;

      const room = getOrCreateRoom(roomId);
      if (room.cleanupTimer) {
        clearTimeout(room.cleanupTimer);
        room.cleanupTimer = null;
      }
      if (!room.hostId) {
        room.hostId = clientId;
      }
      room.participants.set(clientId, {
        id: clientId,
        name,
        avatar,
        isHost: room.hostId === clientId,
      });

      broadcastRoom(room);
      return;
    }

    if (!ws.roomId) return;
    const room = getOrCreateRoom(ws.roomId);
    const sender = room.participants.get(ws.clientId);
    const senderName = sender?.name || 'Player';
    const isHost = room.hostId === ws.clientId;

    const canControl = !room.hostOnly || isHost;

    switch (msg.type) {
      case 'set_host_only': {
        if (!isHost) return;
        room.hostOnly = Boolean(msg.hostOnly);
        broadcastRoom(room);
        break;
      }

      case 'set_mode': {
        if (!canControl) return;
        const allowed = ['wheel', 'boxes', 'cards'];
        if (allowed.includes(msg.mode)) {
          room.mode = msg.mode;
          broadcastRoom(room);
        }
        break;
      }

      case 'set_activity': {
        if (!canControl) return;
        const nextTitle = String(msg.title || 'Untitled Activity').trim().slice(0, 80);
        const nextItems = normalizeItems(Array.isArray(msg.items) ? msg.items : []);
        if (nextItems.length === 0) return;

        room.title = nextTitle || 'Untitled Activity';
        room.items = nextItems;
        syncDerivedOrders(room, true);
        broadcastRoom(room);
        break;
      }

      case 'set_eliminate_on_win': {
        if (!canControl) return;
        room.wheel.eliminateOnWin = Boolean(msg.eliminateOnWin);
        broadcastRoom(room);
        break;
      }

      case 'spin_wheel': {
        if (!canControl || room.wheel.isSpinning) return;
        const activeItems = room.items.filter((i) => !i.eliminated);
        if (activeItems.length === 0) return;

        const targetIndex = Math.floor(Math.random() * activeItems.length);
        const sliceDeg = 360 / activeItems.length;
        // Pointer is at top (0 deg / 12 o'clock). Slice i spans [i*sliceDeg, (i+1)*sliceDeg] clockwise from 12 o'clock.
        // To land slice targetIndex under top pointer, wheel rotation mod 360 should be:
        // 360 - (targetIndex + 0.5) * sliceDeg (plus slight random jitter inside slice).
        const jitter = (Math.random() - 0.5) * sliceDeg * 0.65;
        const desiredMod = ((360 - (targetIndex + 0.5) * sliceDeg + jitter) % 360 + 360) % 360;
        const currentMod = ((room.wheel.rotation % 360) + 360) % 360;
        let delta = desiredMod - currentMod;
        if (delta <= 0) delta += 360;

        const extraSpins = (5 + Math.floor(Math.random() * 3)) * 360;
        const nextRotation = room.wheel.rotation + extraSpins + delta;
        const winnerItem = activeItems[targetIndex];
        const spinId = room.wheel.spinId + 1;

        room.wheel = {
          ...room.wheel,
          rotation: nextRotation,
          isSpinning: true,
          targetIndex,
          winner: null,
          spinId,
          spunBy: senderName,
        };
        broadcastRoom(room);

        if (room.spinTimer) clearTimeout(room.spinTimer);
        room.spinTimer = setTimeout(() => {
          room.spinTimer = null;
          room.wheel = {
            ...room.wheel,
            isSpinning: false,
            winner: winnerItem,
          };
          if (room.wheel.eliminateOnWin) {
            room.items = room.items.map((item) =>
              item.id === winnerItem.id ? { ...item, eliminated: true } : item
            );
          }
          room.history = [
            {
              id: makeId(),
              mode: 'wheel',
              text: winnerItem.text,
              color: winnerItem.color,
              by: senderName,
              timestamp: Date.now(),
            },
            ...room.history,
          ].slice(0, 25);
          broadcastRoom(room);
        }, 4200);
        break;
      }

      case 'reset_wheel': {
        if (!canControl) return;
        room.items = room.items.map((i) => ({ ...i, eliminated: false }));
        room.wheel.winner = null;
        broadcastRoom(room);
        break;
      }

      case 'open_box': {
        if (!canControl) return;
        const boxIndex = Number(msg.boxIndex);
        if (
          !Number.isInteger(boxIndex) ||
          boxIndex < 0 ||
          boxIndex >= room.boxes.order.length ||
          room.boxes.opened.includes(boxIndex)
        ) {
          return;
        }
        const itemId = room.boxes.order[boxIndex];
        const item = room.items.find((i) => i.id === itemId);
        if (!item) return;

        room.boxes = {
          ...room.boxes,
          opened: [...room.boxes.opened, boxIndex],
          lastOpened: { boxIndex, item, openedBy: senderName },
        };
        room.history = [
          {
            id: makeId(),
            mode: 'boxes',
            text: `Box #${boxIndex + 1}: ${item.text}`,
            color: item.color,
            by: senderName,
            timestamp: Date.now(),
          },
          ...room.history,
        ].slice(0, 25);
        broadcastRoom(room);
        break;
      }

      case 'reset_boxes': {
        if (!canControl) return;
        const ids = room.items.map((i) => i.id);
        room.boxes = {
          order: msg.shuffle !== false ? shuffleArray(ids) : ids,
          opened: [],
          lastOpened: null,
        };
        broadcastRoom(room);
        break;
      }

      case 'draw_card': {
        if (!canControl) return;
        const remaining = room.cards.deckOrder.filter(
          (id) => !room.cards.drawn.includes(id)
        );
        if (remaining.length === 0) return;

        const nextId = remaining[0];
        const item = room.items.find((i) => i.id === nextId);
        if (!item) return;

        room.cards = {
          ...room.cards,
          drawn: [...room.cards.drawn, nextId],
          currentCard: { item, drawnBy: senderName },
        };
        room.history = [
          {
            id: makeId(),
            mode: 'cards',
            text: item.text,
            color: item.color,
            by: senderName,
            timestamp: Date.now(),
          },
          ...room.history,
        ].slice(0, 25);
        broadcastRoom(room);
        break;
      }

      case 'reset_cards': {
        if (!canControl) return;
        const ids = room.items.map((i) => i.id);
        room.cards = {
          deckOrder: shuffleArray(ids),
          drawn: [],
          currentCard: null,
        };
        broadcastRoom(room);
        break;
      }

      case 'clear_history': {
        if (!canControl) return;
        room.history = [];
        broadcastRoom(room);
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (!ws.roomId || !ws.clientId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.participants.delete(ws.clientId);

    if (room.participants.size === 0) {
      if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
      const targetRoomId = ws.roomId;
      room.cleanupTimer = setTimeout(() => {
        if (room.spinTimer) clearTimeout(room.spinTimer);
        rooms.delete(targetRoomId);
      }, 30 * 60 * 1000);
      return;
    }

    if (room.hostId === ws.clientId) {
      const nextHost = room.participants.values().next().value;
      room.hostId = nextHost.id;
      room.participants.set(nextHost.id, { ...nextHost, isHost: true });
    }
    broadcastRoom(room);
  });
});

server.listen(PORT, () => {
  console.log(`SpinBox server listening on http://localhost:${PORT}`);
});
