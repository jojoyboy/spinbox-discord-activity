import React, { useEffect, useRef } from 'react';
import { Layers, Shuffle, Sparkles } from 'lucide-react';
import type { RoomState } from '../types';
import { sound } from '../sound';

interface RandomCardsProps {
  room: RoomState;
  canControl: boolean;
  onDrawCard: () => void;
  onResetCards: () => void;
}

export const RandomCards: React.FC<RandomCardsProps> = ({
  room,
  canControl,
  onDrawCard,
  onResetCards,
}) => {
  const lastCardKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const current = room.cards.currentCard;
    if (!current) return;
    const key = `${room.cards.drawn.length}-${current.item.id}`;
    if (lastCardKeyRef.current !== key) {
      lastCardKeyRef.current = key;
      sound.pop();
    }
  }, [room.cards.currentCard, room.cards.drawn.length]);

  const remaining = room.cards.deckOrder.length - room.cards.drawn.length;
  const current = room.cards.currentCard;

  return (
    <div className="game-stage cards-stage">
      <div className="stage-header-bar">
        <div className="stage-stat">
          <Layers size={18} />
          <span>
            {remaining} of {room.cards.deckOrder.length} cards left in deck
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          disabled={!canControl}
          onClick={onResetCards}
        >
          <Shuffle size={14} />
          Shuffle & Reset Deck
        </button>
      </div>

      <div className="cards-arena">
        <button
          className="deck-stack"
          disabled={!canControl || remaining === 0}
          onClick={onDrawCard}
        >
          <div className="deck-layer deck-layer-3" />
          <div className="deck-layer deck-layer-2" />
          <div className="deck-top">
            <Layers size={36} />
            <span className="deck-title">
              {remaining > 0 ? 'Deal a Card' : 'Deck Empty'}
            </span>
            <span className="deck-sub">
              {remaining > 0 ? `${remaining} remaining` : 'Click Shuffle to reset'}
            </span>
          </div>
        </button>

        <div className="drawn-card-slot">
          {current ? (
            <div
              className="drawn-card"
              style={{ borderColor: current.item.color }}
            >
              <div
                className="drawn-card-ribbon"
                style={{ backgroundColor: current.item.color }}
              >
                <Sparkles size={14} />
                <span>Drawn by {current.drawnBy}</span>
              </div>
              <div className="drawn-card-body">{current.item.text}</div>
              <div className="drawn-card-footer">
                Card {room.cards.drawn.length} / {room.cards.deckOrder.length}
              </div>
            </div>
          ) : (
            <div className="drawn-card-placeholder">
              <p>Tap the deck to deal the first card!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
