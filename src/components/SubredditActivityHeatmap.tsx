import { useMemo, useState } from 'react';
import type { Post } from '../lib/types';
import { kyivHour, shiftWeekday } from '../lib/timeUtils';
import { useTheme } from '../lib/theme';

interface Props {
  posts: Post[];
}

interface CellHover {
  weekdayLabel: string;
  hour: number;
  count: number;
  clientX: number;
  clientY: number;
}

// Rows top-to-bottom Mon..Sun; each entry is the JS Date.getUTCDay() value
// (0=Sun..6=Sat) that row represents.
const ROW_JS_DAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// Sequential single-hue ramp (blue, matching the app's primary accent),
// light→dark. Dark mode flips the anchor so the empty end sits near the
// dark surface instead of near white.
const RAMP = {
  light: { empty: '#eef2f7', full: '#1d4ed8' },
  dark: { empty: '#1f242c', full: '#60a5fa' },
};

export default function SubredditActivityHeatmap({ posts }: Props) {
  const { theme } = useTheme();
  const [hover, setHover] = useState<CellHover | null>(null);

  const { grid, max } = useMemo(() => {
    const g: number[][] = ROW_JS_DAYS.map(() => new Array(24).fill(0));
    const rowIndexByJsDay = new Map(ROW_JS_DAYS.map((jsDay, i) => [jsDay, i]));
    for (const post of posts) {
      const jsDay = shiftWeekday(post.created_utc);
      const hour = kyivHour(post.created_utc);
      const rowIndex = rowIndexByJsDay.get(jsDay);
      if (rowIndex === undefined) continue;
      g[rowIndex][hour] += 1;
    }
    let m = 0;
    for (const row of g) for (const c of row) if (c > m) m = c;
    return { grid: g, max: m };
  }, [posts]);

  const ramp = RAMP[theme];

  const cellColor = (count: number) => {
    if (count === 0) return ramp.empty;
    const t = max > 0 ? 0.15 + 0.85 * (count / max) : 0;
    return lerpColor(ramp.empty, ramp.full, t);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Активность постинга</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>По дню недели и часу (Kyiv)</div>
      </div>

      <div>
        {ROW_JS_DAYS.map((jsDay, rowIndex) => (
          <div key={jsDay} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
            <div style={{ width: 32, flexShrink: 0, fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {WEEKDAY_LABELS[jsDay]}
            </div>
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
              {HOURS.map(hour => {
                const count = grid[rowIndex][hour];
                return (
                  <div
                    key={hour}
                    onMouseEnter={e => setHover({ weekdayLabel: WEEKDAY_LABELS[jsDay], hour, count, clientX: e.clientX, clientY: e.clientY })}
                    onMouseMove={e => setHover(h => (h ? { ...h, clientX: e.clientX, clientY: e.clientY } : h))}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      flex: 1,
                      height: 18,
                      borderRadius: 2,
                      background: cellColor(count),
                      cursor: 'default',
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Hour axis */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 34 }}>
          {HOURS.map(hour => (
            <div key={hour} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
              {hour}h
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Меньше</span>
        {[0, 0.35, 0.6, 0.85, 1].map(t => (
          <div key={t} style={{ width: 14, height: 10, borderRadius: 2, background: t === 0 ? ramp.empty : lerpColor(ramp.empty, ramp.full, t) }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Больше</span>
      </div>

      {hover && (
        <div style={{
          position: 'fixed',
          left: hover.clientX + 14,
          top: hover.clientY - 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '9px 12px',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
            {hover.weekdayLabel} at {hover.hour}:00
          </div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {hover.count} post{hover.count === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
