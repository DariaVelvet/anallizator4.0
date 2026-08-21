import { useMemo, useRef, useState } from 'react';
import { buildModelOverview, pctChange, getLatestKnownDate, type ModelOverview, type AccountOverviewRow } from '../lib/fabricatedMetrics';
import { exportModelOverview } from '../lib/exportUtils';
import { SERIES_PALETTE } from '../lib/palette';
import AvatarLink from './AvatarLink';

interface Props {
  modelName: string;
  avatar: string;
  accounts: string[];
  onClose: () => void;
}

type PeriodMode = 'day' | 'week' | 'month' | 'custom';

const OTHER_COLOR = '#9ca3af';
const MAX_TABLE_DAYS = 31;
const MAX_DIRECT_SERIES = 5;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function shiftDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

function shiftMonths(dateKey: string, months: number): string {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return toDateKey(d);
}

function dayCountOf(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000) + 1;
}

function formatShort(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}.${m}`;
}

function formatFull(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}.${m}.${y}`;
}

function computeRange(mode: PeriodMode, anchor: string, customFrom: string | null, customTo: string | null): [string, string] {
  if (mode === 'day') return [anchor, anchor];
  if (mode === 'week') {
    const d = new Date(anchor + 'T00:00:00Z');
    const weekday = d.getUTCDay(); // 0=Sun
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const monday = shiftDays(anchor, mondayOffset);
    return [monday, shiftDays(monday, 6)];
  }
  if (mode === 'month') {
    const d = new Date(anchor + 'T00:00:00Z');
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return [`${y}-${pad2(m + 1)}-01`, `${y}-${pad2(m + 1)}-${pad2(lastDay)}`];
  }
  return [customFrom ?? anchor, customTo ?? anchor];
}

function formatCompact(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function ChevronLeft() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>;
}
function ChevronRight() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>;
}
function RefreshIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>;
}
function ExportIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>;
}
function LinkIconSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></svg>;
}
function UsersIconSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function KarmaIconSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3.5" /><circle cx="8" cy="8.3" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="8.3" r="1" fill="currentColor" stroke="none" /></svg>;
}

function colorForAccount(account: string, order: string[]): string {
  const idx = order.indexOf(account);
  if (idx < 0 || idx >= MAX_DIRECT_SERIES) return OTHER_COLOR;
  return SERIES_PALETTE[idx % SERIES_PALETTE.length];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 84, h = 28, pad = 2;
  if (data.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...data, 1);
  const min = Math.min(0, ...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface StatTileSpec {
  key: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
  value: number;
  prev: number;
  isPercent?: boolean;
  spark: number[];
}

function StatTile({ spec, deltaVsLabel }: { spec: StatTileSpec; deltaVsLabel: string }) {
  const delta = pctChange(spec.value, spec.prev);
  const up = delta !== null && delta >= 0;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', flex: '1 1 150px', minWidth: 150 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7,
          background: spec.accent + '1a', color: spec.accent, flexShrink: 0,
        }}>
          {spec.icon}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>{spec.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {spec.isPercent ? `${spec.value}%` : formatCompact(spec.value)}
          </div>
          {delta === null ? (
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 3 }}>Новые данные</div>
          ) : (
            <div style={{ fontSize: 10.5, color: up ? 'var(--success-text)' : 'var(--danger-text)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span>{up ? '↑' : '↓'} {Math.abs(delta)}%</span>
              <span style={{ color: 'var(--text-faint)' }}>{deltaVsLabel}</span>
            </div>
          )}
        </div>
        <Sparkline data={spec.spark} color={spec.accent} />
      </div>
    </div>
  );
}

interface LineHover {
  index: number;
  clientX: number;
  clientY: number;
}

function OverviewLineChart({
  daily,
  lanes,
}: {
  daily: { date: string; total: number }[];
  lanes: { key: string; label: string; color: string; values: number[] }[];
}) {
  const [hover, setHover] = useState<LineHover | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 620, H = 260, PAD_L = 44, PAD_R = 12, PAD_T = 14, PAD_B = 30;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = daily.length;

  const allValues = [...daily.map(d => d.total), ...lanes.flatMap(l => l.values)];
  const yMax = Math.max(1, ...allValues) * 1.15;
  const xFor = (i: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW);
  const yFor = (v: number) => PAD_T + (1 - v / yMax) * plotH;

  const totalPath = daily.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.total)}`).join(' ');

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - PAD_L) / plotW) * (n - 1));
    const clamped = Math.max(0, Math.min(n - 1, idx));
    setHover({ index: clamped, clientX: e.clientX, clientY: e.clientY });
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(yMax * f));

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yFor(t)} y2={yFor(t)} stroke="var(--background)" strokeWidth={1} />
            <text x={PAD_L - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={9.5} fill="var(--text-faint)" fontFamily="var(--font-mono)">{t}</text>
          </g>
        ))}

        {daily.map((d, i) => (
          i % Math.ceil(n / 7 || 1) === 0 && (
            <text key={d.date} x={xFor(i)} y={H - PAD_B + 16} textAnchor="middle" fontSize={9.5} fill="var(--text-faint)" fontFamily="var(--font-mono)">
              {formatShort(d.date)}
            </text>
          )
        ))}

        <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="var(--border)" strokeWidth={1} />

        {lanes.map(lane => {
          const path = lane.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
          return <path key={lane.key} d={path} fill="none" stroke={lane.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />;
        })}

        <path d={totalPath} fill="none" stroke="var(--text-secondary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {hover && (
          <line x1={xFor(hover.index)} x2={xFor(hover.index)} y1={PAD_T} y2={H - PAD_B} stroke="var(--text-faint)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {hover && (
          <>
            <circle cx={xFor(hover.index)} cy={yFor(daily[hover.index].total)} r={4} fill="var(--text-secondary)" stroke="var(--surface)" strokeWidth={2} />
            {lanes.map(lane => (
              <circle key={lane.key} cx={xFor(hover.index)} cy={yFor(lane.values[hover.index])} r={4} fill={lane.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </>
        )}
      </svg>

      {hover && (
        <div style={{
          position: 'fixed', left: hover.clientX + 14, top: hover.clientY - 10, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', zIndex: 9999, pointerEvents: 'none',
          boxShadow: 'var(--shadow-md)', fontSize: 11.5, minWidth: 140,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{formatFull(daily[hover.index].date)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-secondary)' }}>
            <span>Всего</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{daily[hover.index].total}</span>
          </div>
          {lanes.map(lane => (
            <div key={lane.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--text-faint)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: lane.color, flexShrink: 0 }} />
                {lane.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{lane.values[hover.index]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DonutSegment { label: string; value: number; color: string; }

function DonutChart({ segments, centerValue, centerLabel }: { segments: DonutSegment[]; centerValue: string; centerLabel: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const size = 168, cx = size / 2, cy = size / 2, rOuter = 74, rInner = 46;

  const polar = (angleDeg: number, r: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arcPath = (startAngle: number, endAngle: number) => {
    const so = polar(endAngle, rOuter), eo = polar(startAngle, rOuter);
    const si = polar(endAngle, rInner), ei = polar(startAngle, rInner);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${so.x} ${so.y} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${eo.x} ${eo.y} L ${ei.x} ${ei.y} A ${rInner} ${rInner} 0 ${largeArc} 1 ${si.x} ${si.y} Z`;
  };

  let angle = 0;
  const arcs = segments.map((seg, i) => {
    const sweep = (seg.value / total) * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle;
    return { ...seg, startAngle, endAngle, index: i };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map(a => (
            <path
              key={a.label}
              d={arcPath(a.startAngle, a.endAngle)}
              fill={a.color}
              stroke="var(--surface)"
              strokeWidth={2}
              opacity={hoverIdx === null || hoverIdx === a.index ? 1 : 0.45}
              style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
              onMouseEnter={() => setHoverIdx(a.index)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{centerValue}</div>
          <div style={{ fontSize: 9.5, color: 'var(--text-faint)', textAlign: 'center', maxWidth: 76 }}>{centerLabel}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {arcs.map(a => (
          <div
            key={a.label}
            onMouseEnter={() => setHoverIdx(a.index)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: hoverIdx === null || hoverIdx === a.index ? 1 : 0.5, cursor: 'default' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{a.label}</span>
            <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
              {formatCompact(a.value)} ({Math.round((a.value / total) * 1000) / 10}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
};
const cardTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 };

export default function ModelOverviewModal({ modelName, avatar, accounts, onClose }: Props) {
  const defaultAnchor = useMemo(() => getLatestKnownDate(accounts) ?? toDateKey(new Date()), [accounts]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  const [anchor, setAnchor] = useState(defaultAnchor);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());

  const [from, to] = computeRange(periodMode, anchor, customFrom, customTo);

  const overview: ModelOverview = useMemo(() => buildModelOverview(accounts, from, to), [accounts, from, to]);

  const colorOrder = useMemo(() => overview.accounts.map(a => a.account), [overview.accounts]);
  const colorFor = (account: string) => colorForAccount(account, colorOrder);

  const dailyTotals = useMemo(() => {
    const subRatio = overview.totals.leads > 0 ? overview.totals.subscribers / overview.totals.leads : 0;
    return overview.daily.map(d => ({
      date: d.date, leads: d.leads, karma: d.karma,
      subscribers: Math.round(d.leads * subRatio),
    }));
  }, [overview]);

  const goPrev = () => {
    if (periodMode === 'day') setAnchor(a => shiftDays(a, -1));
    else if (periodMode === 'week') setAnchor(a => shiftDays(a, -7));
    else if (periodMode === 'month') setAnchor(a => shiftMonths(a, -1));
  };
  const goNext = () => {
    if (periodMode === 'day') setAnchor(a => shiftDays(a, 1));
    else if (periodMode === 'week') setAnchor(a => shiftDays(a, 7));
    else if (periodMode === 'month') setAnchor(a => shiftMonths(a, 1));
  };

  const directAccounts = overview.accounts.slice(0, MAX_DIRECT_SERIES);
  const otherAccounts = overview.accounts.slice(MAX_DIRECT_SERIES);

  const lineLanes = directAccounts.map(a => ({
    key: a.account,
    label: a.account,
    color: colorFor(a.account),
    values: overview.daily.map(d => d.byAccount[a.account] ?? 0),
  }));
  if (otherAccounts.length > 0) {
    lineLanes.push({
      key: '__other__',
      label: `Остальные (${otherAccounts.length})`,
      color: OTHER_COLOR,
      values: overview.daily.map(d => otherAccounts.reduce((s, a) => s + (d.byAccount[a.account] ?? 0), 0)),
    });
  }

  const donutSegments: DonutSegment[] = [
    ...directAccounts.map(a => ({ label: a.account, value: a.leads, color: colorFor(a.account) })),
    ...(otherAccounts.length > 0 ? [{ label: `Остальные (${otherAccounts.length})`, value: otherAccounts.reduce((s, a) => s + a.leads, 0), color: OTHER_COLOR }] : []),
  ].filter(s => s.value > 0);

  const stats: StatTileSpec[] = [
    { key: 'leads', label: 'Всего лидов', icon: <LinkIconSvg />, accent: '#2563eb', value: overview.totals.leads, prev: overview.prevTotals.leads, spark: dailyTotals.map(d => d.leads) },
    { key: 'subs', label: 'Подписчиков', icon: <UsersIconSvg />, accent: '#db2777', value: overview.totals.subscribers, prev: overview.prevTotals.subscribers, spark: dailyTotals.map(d => d.subscribers) },
    { key: 'karma', label: 'Карма', icon: <KarmaIconSvg />, accent: '#FF4500', value: overview.totals.karma, prev: overview.prevTotals.karma, spark: dailyTotals.map(d => d.karma) },
  ];

  const dayCount = dayCountOf(from, to);
  const canShowDailyTable = dayCount > 0 && dayCount <= MAX_TABLE_DAYS;

  const handleExport = () => exportModelOverview(modelName, from, to, overview.accounts);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--background)', borderRadius: 12, width: 'min(1180px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <AvatarLink src={avatar} size={36} alt={modelName} fallbackLetter={modelName[0]} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Обзор</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>{modelName} · карма, подписчики и лиды по аккаунтам</div>
          </div>
          <button
            onClick={handleExport}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}
          >
            <ExportIcon /> Экспорт
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, lineHeight: 0 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Period controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
              {([['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц'], ['custom', 'Период']] as [PeriodMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setPeriodMode(mode)}
                  style={{
                    background: periodMode === mode ? 'var(--primary-light)' : 'none', border: 'none', borderRadius: 5,
                    color: periodMode === mode ? 'var(--primary)' : 'var(--text-muted)', padding: '6px 12px', fontSize: 12,
                    fontWeight: periodMode === mode ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {periodMode === 'custom' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="date"
                  value={customFrom ?? from}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>–</span>
                <input
                  type="date"
                  value={customTo ?? to}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={goPrev} title="Предыдущий период" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <ChevronLeft />
                </button>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '0 6px', minWidth: 150, textAlign: 'center' }}>
                  {from === to ? formatFull(from) : `${formatFull(from)} – ${formatFull(to)}`}
                </span>
                <button onClick={goNext} title="Следующий период" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <ChevronRight />
                </button>
              </div>
            )}

            <button
              onClick={() => setRefreshedAt(new Date())}
              title="Обновить"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
            >
              <RefreshIcon />
              Обновлено: {formatFull(toDateKey(refreshedAt))}, {pad2(refreshedAt.getHours())}:{pad2(refreshedAt.getMinutes())}
            </button>
          </div>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stats.map(spec => (
              <StatTile key={spec.key} spec={spec} deltaVsLabel={`vs ${formatShort(overview.prevFrom)} – ${formatShort(overview.prevTo)}`} />
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{ ...cardStyle, flex: '2 1 420px', minWidth: 320 }}>
              <div style={cardTitleStyle}>Динамика лидов по дням</div>
              {overview.daily.length < 2 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, padding: '60px 0' }}>Недостаточно данных для графика</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8, fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <span style={{ width: 14, height: 2, background: 'var(--text-secondary)', display: 'inline-block' }} /> Всего лидов
                    </span>
                    {lineLanes.map(lane => (
                      <span key={lane.key} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-faint)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: lane.color, display: 'inline-block' }} /> {lane.label}
                      </span>
                    ))}
                  </div>
                  <OverviewLineChart daily={overview.daily.map(d => ({ date: d.date, total: d.leads }))} lanes={lineLanes} />
                </>
              )}
            </div>

            <div style={{ ...cardStyle, flex: '1 1 280px', minWidth: 260 }}>
              <div style={cardTitleStyle}>Лиды по аккаунтам (итого за период)</div>
              {donutSegments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, padding: '40px 0' }}>Нет данных</div>
              ) : (
                <DonutChart segments={donutSegments} centerValue={formatCompact(overview.totals.leads)} centerLabel="Всего лидов" />
              )}
            </div>

            <div style={{ ...cardStyle, flex: '1 1 300px', minWidth: 280, overflowX: 'auto' }}>
              <div style={cardTitleStyle}>Лиды по ссылкам (итого за период)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px 8px 0', fontWeight: 600 }}>Ссылка</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 8px 6px' }}>Лиды</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.linkRows.slice(0, 12).map((row, i) => (
                    <tr key={row.url + i} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td
                        title={row.account ? `Аккаунт: ${row.account}` : 'Не привязана к аккаунту'}
                        style={{ padding: '6px 6px 6px 0', color: row.account ? 'var(--text)' : 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'default' }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.account ? colorFor(row.account) : 'var(--disabled)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.url}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 0 6px 6px', fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{formatCompact(row.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily x account table */}
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <div style={cardTitleStyle}>Статистика по дням и аккаунтам</div>
            {!canShowDailyTable ? (
              <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, padding: '30px 0' }}>
                Период длиннее {MAX_TABLE_DAYS} дней — сузьте период, чтобы увидеть разбивку по дням
              </div>
            ) : (
              <DailyTable modelName={modelName} avatar={avatar} accounts={overview.accounts} daily={overview.daily} colorFor={colorFor} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyTable({
  modelName, avatar, accounts, daily, colorFor,
}: {
  modelName: string; avatar: string; accounts: AccountOverviewRow[]; daily: { date: string }[]; colorFor: (a: string) => string;
}) {
  const thStyle: React.CSSProperties = { padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const tdStyle: React.CSSProperties = { padding: '6px 8px', fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' };
  const stickyCol: React.CSSProperties = { position: 'sticky', left: 0, background: 'var(--surface)', textAlign: 'left', zIndex: 1 };

  const totalsByDay = daily.map((_, i) => accounts.reduce((s, a) => s + (a.daily[i]?.leads ?? 0), 0));
  const grandLeads = accounts.reduce((s, a) => s + a.leads, 0);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: daily.length * 60 + 260 }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, ...stickyCol }}>Аккаунт / Ссылка</th>
          {daily.map(d => (
            <th key={d.date} style={{ ...thStyle, textAlign: 'right' }}>{formatShort(d.date)}</th>
          ))}
          <th style={{ ...thStyle, textAlign: 'right', borderLeft: '1px solid var(--border)' }}>Итого</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ background: 'var(--hover-bg)' }}>
          <td style={{ ...tdStyle, ...stickyCol, background: 'var(--hover-bg)', fontFamily: 'var(--font-sans)', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AvatarLink src={avatar} size={20} alt={modelName} fallbackLetter={modelName[0]} />
            {modelName} ({accounts.length} аккаунт{accounts.length === 1 ? '' : accounts.length < 5 ? 'а' : 'ов'})
          </td>
          {daily.map((_, i) => <td key={i} style={tdStyle} />)}
          <td style={{ ...tdStyle, borderLeft: '1px solid var(--border)' }} />
        </tr>
        {accounts.map(a => (
          <tr key={a.account} style={{ borderTop: '1px solid var(--border-light)' }}>
            <td style={{ ...tdStyle, ...stickyCol, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: colorFor(a.account), flexShrink: 0 }} />
              {a.account}
            </td>
            {a.daily.map((d, i) => (
              <td key={i} style={{ ...tdStyle, color: 'var(--text)', fontWeight: d.leads > 0 ? 600 : 400 }}>{d.leads || ''}</td>
            ))}
            <td style={{ ...tdStyle, borderLeft: '1px solid var(--border)', color: 'var(--text)', fontWeight: 700 }}>{formatCompact(a.leads)}</td>
          </tr>
        ))}
        <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
          <td style={{ ...tdStyle, ...stickyCol, fontFamily: 'var(--font-sans)', color: 'var(--text)', fontWeight: 700 }}>Итого</td>
          {totalsByDay.map((t, i) => (
            <td key={i} style={{ ...tdStyle, color: 'var(--text)' }}>{t || ''}</td>
          ))}
          <td style={{ ...tdStyle, borderLeft: '1px solid var(--border)', color: 'var(--text)' }}>{formatCompact(grandLeads)}</td>
        </tr>
      </tbody>
    </table>
  );
}
