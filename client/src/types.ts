export type GameMode = 'wheel' | 'boxes' | 'cards';

export interface ActivityItem {
  id: string;
  text: string;
  color: string;
  eliminated?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string | null;
  isHost: boolean;
}

export interface HistoryEntry {
  id: string;
  mode: GameMode;
  text: string;
  color: string;
  by: string;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  title: string;
  mode: GameMode;
  items: ActivityItem[];
  wheel: {
    rotation: number;
    isSpinning: boolean;
    targetIndex: number | null;
    winner: ActivityItem | null;
    eliminateOnWin: boolean;
    spinId: number;
    spunBy: string | null;
  };
  boxes: {
    order: string[];
    opened: number[];
    lastOpened: {
      boxIndex: number;
      item: ActivityItem;
      openedBy: string;
    } | null;
  };
  cards: {
    deckOrder: string[];
    drawn: string[];
    currentCard: {
      item: ActivityItem;
      drawnBy: string;
    } | null;
  };
  history: HistoryEntry[];
  hostId: string | null;
  hostOnly: boolean;
  participants: Participant[];
}

export interface SavedActivity {
  id: string;
  title: string;
  items: string[];
  updatedAt: number;
}

export interface UserIdentity {
  id: string;
  name: string;
  avatar: string | null;
}
