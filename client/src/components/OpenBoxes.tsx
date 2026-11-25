import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Shuffle, PackageOpen, Sparkles } from 'lucide-react';
import type { RoomState } from '../types';
import { sound } from '../sound';

interface OpenBoxesProps {
  room: RoomState;
  canControl: boolean;
  onOpenBox: (boxIndex: number) => void;
  onResetBoxes: (shuffle: boolean) => void;
}

export const OpenBoxes: React.FC<OpenBoxesProps> = ({
  room,
  canControl,
  onOpenBox,
  onResetBoxes,
}) => {
  const lastOpenedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const last = room.boxes.lastOpened;
    if (!last) return;
    const key = `${last.boxIndex}-${last.item.id}`;
    if (lastOpenedKeyRef.current !== key) {
      lastOpenedKeyRef.current = key;
      sound.pop();
      confetti({
        particleCount: 45,
        spread: 55,
        origin: { y: 0.6 },
      });
    }
  }, [room.boxes.lastOpened]);

  const itemMap = new Map(room.items.map((item) => [item.id, item]));
  const remainingCount = room.boxes.order.length - room.boxes.opened.length;

  return (
    <div className="game-stage boxes-stage">
      <div className="stage-header-bar">
        <div className="stage-stat">
          <PackageOpen size={18} />
          <span>
            {remainingCount} of {room.boxes.order.length} boxes remaining
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          disabled={!canControl}
          onClick={() => onResetBoxes(true)}
        >
          <Shuffle size={14} />
          Shuffle & Reset Boxes
        </button>
      </div>

      {room.boxes.lastOpened && (
        <div
          className="winner-banner"
          style={{ borderColor: room.boxes.lastOpened.item.color }}
        >
          <Sparkles size={20} style={{ color: room.boxes.lastOpened.item.color }} />
          <div>
            <div className="winner-label">
              Box #{room.boxes.lastOpened.boxIndex + 1} opened by{' '}
              {room.boxes.lastOpened.openedBy}
            </div>
            <div className="winner-text">{room.boxes.lastOpened.item.text}</div>
          </div>
        </div>
      )}

      <div className="boxes-grid">
        {room.boxes.order.map((itemId, index) => {
          const isOpened = room.boxes.opened.includes(index);
          const item = itemMap.get(itemId);
          const isLatest = room.boxes.lastOpened?.boxIndex === index;

          return (
            <button
              key={`${index}-${itemId}`}
              className={`mystery-box ${isOpened ? 'opened' : 'closed'} ${
                isLatest ? 'latest' : ''
              }`}
              disabled={!canControl || isOpened}
              onClick={() => onOpenBox(index)}
              style={
                isOpened && item
                  ? { borderColor: item.color, background: `${item.color}22` }
                  : undefined
              }
            >
              {!isOpened ? (
                <>
                  <div className="box-lid" />
                  <span className="box-number">{index + 1}</span>
                  <span className="box-cta">Tap to open</span>
                </>
              ) : (
                <>
                  <span
                    className="box-opened-badge"
                    style={{ backgroundColor: item?.color || '#6366f1' }}
                  >
                    #{index + 1}
                  </span>
                  <span className="box-reveal-text">{item?.text || 'Empty'}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
