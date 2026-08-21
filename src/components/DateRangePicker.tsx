import { useState, useRef, useEffect } from 'react';
import type { DatePreset } from '../lib/types';

interface Props {
  preset: DatePreset;
  customFrom: Date | null;
  customTo: Date | null;
  onPresetChange: (p: DatePreset) => void;
  onCustomFromChange: (d: Date | null) => void;
  onCustomToChange: (d: Date | null) => void;
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'Last 30 Days', value: 'month' },
  { label: 'Last 3 Months', value: '3months' },
  { label: 'Custom', value: 'custom' },
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year: number, month: number) {
  // 0=Sun, we want Mon=0
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDisplay(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function formatLabel(preset: DatePreset, from: Date | null, to: Date | null): string {
  if (preset === 'all') return 'All time';
  if (preset === 'week') return 'Last 7 Days';
  if (preset === 'month') return 'Last 30 Days';
  if (preset === '3months') return 'Last 3 Months';
  if (preset === 'custom') {
    if (from && to) return `${formatDisplay(from)} – ${formatDisplay(to)}`;
    if (from) return `From ${formatDisplay(from)}`;
    return 'Custom range';
  }
  return 'Select date range';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface CalendarProps {
  year: number;
  month: number;
  selecting: Date | null;
  from: Date | null;
  to: Date | null;
  hovered: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date) => void;
}

function Calendar({ year, month, selecting, from, to, hovered, onDayClick, onDayHover }: CalendarProps) {
  const days = daysInMonth(year, month);
  const startDay = startDayOfMonth(year, month);
  const prevDays = daysInMonth(year, month - 1 < 0 ? 11 : month - 1);

  const rangeEnd = selecting ? hovered : to;

  const isInRange = (d: Date) => {
    const rangeFrom = from;
    const rangeTo = rangeEnd;
    if (!rangeFrom || !rangeTo) return false;
    const [lo, hi] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
    return d > lo && d < hi;
  };

  const isStart = (d: Date) => {
    if (!from) return false;
    const lo = rangeEnd && from > rangeEnd ? rangeEnd : from;
    return isSameDay(d, lo);
  };

  const isEnd = (d: Date) => {
    if (!rangeEnd) return false;
    const hi = from && from > rangeEnd ? from : rangeEnd;
    return isSameDay(d, hi);
  };

  const cells: { date: Date | null; dimmed: boolean }[] = [];
  for (let i = 0; i < startDay; i++) {
    const day = prevDays - startDay + 1 + i;
    const prevMonth = month - 1 < 0 ? 11 : month - 1;
    const prevYear = month - 1 < 0 ? year - 1 : year;
    cells.push({ date: new Date(prevYear, prevMonth, day), dimmed: true });
  }
  for (let d = 1; d <= days; d++) {
    cells.push({ date: new Date(year, month, d), dimmed: false });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month + 1 > 11 ? 0 : month + 1;
    const nextYear = month + 1 > 11 ? year + 1 : year;
    cells.push({ date: new Date(nextYear, nextMonth, d), dimmed: true });
  }

  return (
    <div style={{ minWidth: 230 }}>
      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', padding: '4px 0', marginBottom: 2 }}>{d}</div>
        ))}
        {cells.map(({ date, dimmed }, i) => {
          if (!date) return <div key={i} />;
          const today = new Date();
          const isToday = isSameDay(date, today);
          const start = isStart(date);
          const end = isEnd(date);
          const inRange = isInRange(date);
          const isSelected = start || end;

          return (
            <div
              key={i}
              onClick={() => !dimmed && onDayClick(date)}
              onMouseEnter={() => onDayHover(date)}
              style={{
                position: 'relative',
                textAlign: 'center',
                cursor: dimmed ? 'default' : 'pointer',
                padding: '4px 0',
              }}
            >
              {/* Range background spans full width except at edges */}
              {(inRange || (isSelected && (start || end))) && (
                <div style={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  left: start ? '50%' : 0,
                  right: end ? '50%' : 0,
                  background: 'var(--primary-light-alt)',
                  zIndex: 0,
                }} />
              )}
              <div style={{
                position: 'relative',
                zIndex: 1,
                width: 28,
                height: 28,
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: isSelected ? 'var(--primary)' : 'transparent',
                color: isSelected ? '#fff' : dimmed ? 'var(--disabled)' : isToday ? 'var(--primary)' : 'var(--text)',
                fontSize: 12,
                fontWeight: isSelected || isToday ? 600 : 400,
              }}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ preset, customFrom, customTo, onPresetChange, onCustomFromChange, onCustomToChange }: Props) {
  const [open, setOpen] = useState(false);
  const [localPreset, setLocalPreset] = useState<DatePreset>(preset);
  const [localFrom, setLocalFrom] = useState<Date | null>(customFrom);
  const [localTo, setLocalTo] = useState<Date | null>(customTo);
  const [selecting, setSelecting] = useState<Date | null>(null); // first click date, waiting for second
  const [hovered, setHovered] = useState<Date | null>(null);

  const now = new Date();
  const [leftMonth, setLeftMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const rightMonth = {
    year: leftMonth.month === 11 ? leftMonth.year + 1 : leftMonth.year,
    month: leftMonth.month === 11 ? 0 : leftMonth.month + 1,
  };

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePresetClick = (p: DatePreset) => {
    setLocalPreset(p);
    if (p !== 'custom') {
      setLocalFrom(null);
      setLocalTo(null);
      setSelecting(null);
      onPresetChange(p);
      onCustomFromChange(null);
      onCustomToChange(null);
      setOpen(false);
    }
  };

  const handleDayClick = (d: Date) => {
    if (!selecting) {
      setSelecting(d);
      setLocalFrom(d);
      setLocalTo(null);
    } else {
      const [lo, hi] = d >= selecting ? [selecting, d] : [d, selecting];
      setLocalFrom(lo);
      setLocalTo(hi);
      setSelecting(null);
    }
    setLocalPreset('custom');
  };

  const handleApply = () => {
    onPresetChange(localPreset);
    onCustomFromChange(localFrom);
    onCustomToChange(localTo);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalFrom(null);
    setLocalTo(null);
    setSelecting(null);
    setLocalPreset('all');
  };

  const displayLabel = formatLabel(preset, customFrom, customTo);

  const rangeDisplay = localFrom && localTo
    ? `${formatDisplay(localFrom)} – ${formatDisplay(localTo)}`
    : localFrom ? `${formatDisplay(localFrom)} – ...` : '';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 13,
          color: preset === 'all' ? 'var(--text-faint)' : 'var(--text)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          minWidth: 180,
          justifyContent: 'space-between',
        }}
      >
        {displayLabel}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          zIndex: 1000,
          display: 'flex',
          minWidth: localPreset === 'custom' ? 620 : 180,
        }}>
          {/* Presets */}
          <div style={{ width: 160, borderRight: localPreset === 'custom' ? '1px solid var(--border-light)' : 'none', padding: '6px 0', flexShrink: 0 }}>
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePresetClick(p.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 16px',
                  background: localPreset === p.value ? 'var(--primary-light)' : 'none',
                  border: 'none',
                  color: localPreset === p.value ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: localPreset === p.value ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  borderLeft: localPreset === p.value ? '3px solid var(--primary)' : '3px solid transparent',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar — only shown once "Custom" is selected */}
          {localPreset === 'custom' && (
            <div style={{ flex: 1, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              {/* Prev arrow */}
              <button
                onClick={() => setLeftMonth(m => ({
                  year: m.month === 0 ? m.year - 1 : m.year,
                  month: m.month === 0 ? 11 : m.month - 1,
                }))}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>

              <Calendar
                year={leftMonth.year}
                month={leftMonth.month}
                selecting={selecting}
                from={localFrom}
                to={localTo}
                hovered={hovered}
                onDayClick={handleDayClick}
                onDayHover={setHovered}
              />

              <Calendar
                year={rightMonth.year}
                month={rightMonth.month}
                selecting={selecting}
                from={localFrom}
                to={localTo}
                hovered={hovered}
                onDayClick={handleDayClick}
                onDayHover={setHovered}
              />

              {/* Next arrow */}
              <button
                onClick={() => setLeftMonth(m => ({
                  year: m.month === 11 ? m.year + 1 : m.year,
                  month: m.month === 11 ? 0 : m.month + 1,
                }))}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 'auto', fontFamily: 'var(--font-mono)' }}>
                {rangeDisplay}
              </span>
              <button
                onClick={handleClear}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '6px 12px', borderRadius: 5, fontFamily: 'var(--font-sans)' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--background)')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'var(--primary)')}
              >
                Apply
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
