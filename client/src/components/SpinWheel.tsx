import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Sparkles, Play } from 'lucide-react';
import type { ActivityItem, RoomState } from '../types';
import { sound } from '../sound';

interface SpinWheelProps {
  room: RoomState;
  canControl: boolean;
  onSpin: () => void;
  onResetWheel: () => void;
  onToggleEliminate: (val: boolean) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArc, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

function truncateLabel(text: string, maxLen: number) {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export const SpinWheel: React.FC<SpinWheelProps> = ({
  room,
  canControl,
  onSpin,
  onResetWheel,
  onToggleEliminate,
}) => {
  const activeItems: ActivityItem[] = room.items.filter((i) => !i.eliminated);
  const eliminatedCount = room.items.length - activeItems.length;
  const lastSpinIdRef = useRef<number>(room.wheel.spinId);
  const lastWinnerIdRef = useRef<string | null>(null);

  // Play decelerating ticks while spinning
  useEffect(() => {
    if (!room.wheel.isSpinning) return;
    if (room.wheel.spinId === lastSpinIdRef.current && room.wheel.spinId === 0) return;
    lastSpinIdRef.current = room.wheel.spinId;

    const timeouts: number[] = [];
    const tickTimes = [
      80, 160, 250, 350, 460, 580, 710, 860, 1020, 1200,
      1400, 1620, 1870, 2150, 2460, 2810, 3200, 3650,
    ];
    for (const ms of tickTimes) {
      timeouts.push(window.setTimeout(() => sound.tick(), ms));
    }
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [room.wheel.isSpinning, room.wheel.spinId]);

  // Celebrate when winner lands
  useEffect(() => {
    const winner = room.wheel.winner;
    if (winner && !room.wheel.isSpinning) {
      const key = `${room.wheel.spinId}-${winner.id}`;
      if (lastWinnerIdRef.current !== key) {
        lastWinnerIdRef.current = key;
        sound.win();
        confetti({
          particleCount: 70,
          spread: 65,
          origin: { y: 0.55 },
        });
      }
    }
  }, [room.wheel.winner, room.wheel.isSpinning, room.wheel.spinId]);

  const sliceDeg = activeItems.length > 0 ? 360 / activeItems.length : 360;

  return (
    <div className="game-stage wheel-stage">
      <div className="wheel-controls-bar">
        <label className="toggle-pill">
          <input
            type="checkbox"
            checked={room.wheel.eliminateOnWin}
            disabled={!canControl}
            onChange={(e) => onToggleEliminate(e.target.checked)}
          />
          <span>Eliminate winner after spin</span>
        </label>

        {eliminatedCount > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            disabled={!canControl || room.wheel.isSpinning}
            onClick={onResetWheel}
          >
            <RotateCcw size={14} />
            Restore {eliminatedCount} eliminated
          </button>
        )}
      </div>

      {activeItems.length === 0 ? (
        <div className="empty-stage-card">
          <h3>All topics have been picked!</h3>
          <p>Restore the eliminated topics to spin again.</p>
          <button className="btn btn-primary" disabled={!canControl} onClick={onResetWheel}>
            <RotateCcw size={16} />
            Restore All Topics
          </button>
        </div>
      ) : (
        <div className="wheel-wrapper">
          <div className="wheel-pointer" aria-hidden="true" />
          <svg
            viewBox="0 0 500 500"
            className="wheel-svg"
            style={{
              transform: `rotate(${room.wheel.rotation}deg)`,
              transition: room.wheel.isSpinning
                ? 'transform 4.2s cubic-bezier(0.12, 0.82, 0.14, 1)'
                : 'none',
            }}
          >
            <circle cx="250" cy="250" r="242" fill="#1e2235" stroke="#3a4063" strokeWidth="6" />
            {activeItems.length === 1 ? (
              <g>
                <circle cx="250" cy="250" r="232" fill={activeItems[0].color} />
                <text
                  x="250"
                  y="165"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontWeight="700"
                  fontSize="18"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.45)' }}
                >
                  {truncateLabel(activeItems[0].text, 24)}
                </text>
              </g>
            ) : (
              activeItems.map((item, idx) => {
                const startAngle = idx * sliceDeg - 90;
                const endAngle = (idx + 1) * sliceDeg - 90;
                const midAngle = startAngle + sliceDeg / 2;
                const fontSize = activeItems.length > 14 ? 11 : activeItems.length > 9 ? 13 : 15;
                const maxLen = activeItems.length > 12 ? 16 : 22;

                return (
                  <g key={item.id}>
                    <path
                      d={describeSlice(250, 250, 232, startAngle, endAngle)}
                      fill={item.color}
                      stroke="#141726"
                      strokeWidth="2.5"
                    />
                    <g transform={`translate(250, 250) rotate(${midAngle})`}>
                      <text
                        x="140"
                        y="5"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontWeight="700"
                        fontSize={fontSize}
                        style={{
                          textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                          pointerEvents: 'none',
                        }}
                      >
                        {truncateLabel(item.text, maxLen)}
                      </text>
                    </g>
                  </g>
                );
              })
            )}
            {/* Outer rim pegs */}
            {activeItems.map((_, idx) => {
              const pegPos = polarToCartesian(250, 250, 236, idx * sliceDeg - 90);
              return (
                <circle
                  key={`peg-${idx}`}
                  cx={pegPos.x}
                  cy={pegPos.y}
                  r="4"
                  fill="#ffffff"
                  opacity="0.85"
                />
              );
            })}
          </svg>

          <button
            className="wheel-hub-btn"
            disabled={!canControl || room.wheel.isSpinning}
            onClick={onSpin}
            title={canControl ? 'Spin the wheel!' : 'Only host can spin'}
          >
            <Play size={22} fill="currentColor" />
            <span>{room.wheel.isSpinning ? '...' : 'SPIN'}</span>
          </button>
        </div>
      )}

      {room.wheel.winner && !room.wheel.isSpinning && (
        <div
          className="winner-banner"
          style={{ borderColor: room.wheel.winner.color }}
        >
          <Sparkles size={20} style={{ color: room.wheel.winner.color }} />
          <div>
            <div className="winner-label">
              {room.wheel.spunBy ? `Spun by ${room.wheel.spunBy}` : 'Selected Topic'}
            </div>
            <div className="winner-text">{room.wheel.winner.text}</div>
          </div>
        </div>
      )}
    </div>
  );
};
