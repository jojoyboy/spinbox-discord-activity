import { DiscordSDK } from '@discord/embedded-app-sdk';
import type { UserIdentity } from './types';

export interface DiscordSession {
  inDiscord: boolean;
  roomId: string;
  user: UserIdentity;
}

const ADJECTIVES = ['Cosmic', 'Lucky', 'Hyper', 'Chill', 'Neon', 'Pixel', 'Sunny', 'Swift'];
const NOUNS = ['Fox', 'Panda', 'Otter', 'Falcon', 'Koala', 'Tiger', 'Penguin', 'Lynx'];

function getStandaloneUser(): UserIdentity {
  const stored = sessionStorage.getItem('spinbox_user');
  if (stored) {
    try {
      return JSON.parse(stored) as UserIdentity;
    } catch {
      // fall through
    }
  }
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const user: UserIdentity = {
    id: 'local_' + Math.random().toString(36).slice(2, 10),
    name: `${adj} ${noun}`,
    avatar: null,
  };
  sessionStorage.setItem('spinbox_user', JSON.stringify(user));
  return user;
}

export async function initSession(): Promise<DiscordSession> {
  const params = new URLSearchParams(window.location.search);
  const hasFrameId = params.has('frame_id');
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

  if (!hasFrameId || !clientId || clientId === 'your_discord_client_id_here') {
    const roomParam = params.get('room') || 'demo-room';
    return {
      inDiscord: false,
      roomId: roomParam,
      user: getStandaloneUser(),
    };
  }

  try {
    const discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();

    const { code } = await discordSdk.commands.authorize({
      client_id: clientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds'],
    });

    const tokenRes = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const auth = await discordSdk.commands.authenticate({ access_token });
    const discordUser = auth.user;

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`
      : null;

    return {
      inDiscord: true,
      roomId: discordSdk.channelId || discordSdk.instanceId || 'discord-room',
      user: {
        id: discordUser.id,
        name: discordUser.global_name || discordUser.username,
        avatar: avatarUrl,
      },
    };
  } catch (err) {
    console.warn('Discord SDK init failed, falling back to standalone mode:', err);
    return {
      inDiscord: false,
      roomId: params.get('room') || 'demo-room',
      user: getStandaloneUser(),
    };
  }
}
