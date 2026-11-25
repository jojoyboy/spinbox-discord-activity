# SpinBox — Wordwall-Style Discord Activity

Free, unpaywalled interactive party & topic games (**Spin the Wheel**, **Open the Box**, and **Random Cards**) built for **Discord Activities** and standalone browsers.

## Features
- **3 Switchable Templates** (like Wordwall): enter your topics once and switch between **Spin the Wheel**, **Open the Box**, and **Random Cards** at any time.
- **No Paywalls**: unlimited topics, bulk paste (one per line), starter packs, local saved activities, and JSON import/export.
- **Real-Time Multiplayer**: WebSocket-synced rooms keyed by Discord Voice Channel `instanceId` (or `?room=...` in standalone mode).
- **Host Controls & Sound**: Optional host-only lock, eliminate-winner-after-spin toggle, Web Audio API sound effects, and confetti.

## Quick Start (Local Browser)
```bash
npm install
npm --prefix client install
npm run dev
```
Open `http://localhost:5173` in two tabs to test real-time multiplayer sync!

## Running as a Discord Activity
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create an Application.
2. Enable **Activities** under the **Activities** settings tab.
3. Copy `.env.example` to `.env` and fill in `VITE_DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
4. Build and start the unified server:
   ```bash
   npm run build
   npm start
   ```
5. Expose port `3001` via a tunnel (e.g. `cloudflared tunnel --url http://localhost:3001`).
6. In the Developer Portal under **Activities -> URL Mappings**, map `/` to your tunnel URL.
7. Join a Discord Voice Channel and launch your Activity!
