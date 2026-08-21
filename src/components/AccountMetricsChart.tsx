import { useMemo, useRef, useState } from 'react';
import type { AccountDailyMetric, ChartMetric, ChartType, PostWithMeta } from '../lib/types';
import { accountToModel } from '../lib/dataUtils';

export interface MetricSeries {
  account: string;
  color: string;
  points: AccountDailyMetric[]; // full history — this component owns its own zoom/pan
}

interface Props {
  series: MetricSeries[];
  metrics: ChartMetric[]; // 1 or 2 of ['karma', 'leads'], shown simultaneously
  chartType: ChartType;
  getPostsForDate: (account: string, date: string) => PostWithMeta[];
  height?: number;
}

interface XDomain {
  xMin: number;
  xMax: number;
}

interface PointHover {
  account: string;
  date: string;
  karma: number;
  leads: number;
  clientX: number;
  clientY: number;
}

interface CandleHover {
  account: string;
  metric: ChartMetric;
  weekStart: number;
  weekEnd: number;
  open: number;
  high: number;
  low: number;
  close: number;
  clientX: number;
  clientY: number;
}

const VIEW_W = 820;
const PAD_L = 50;
const PAD_R = 50;
const PAD_T = 16;
const PAD_B = 46;
const DAY_MS = 86400000;

const METRIC_LABELS: Record<ChartMetric, string> = { karma: 'Карма', leads: 'Лиды' };
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function dateToMs(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${WEEKDAYS[d.getUTCDay()]} ${dd}.${mm}`;
}

function formatShortDate(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

function mondayOf(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekBoundaries(xMin: number, xMax: number): number[] {
  const boundaries: number[] = [];
  let cur = mondayOf(xMin);
  while (cur <= xMax) {
    boundaries.push(cur);
    cur += 7 * DAY_MS;
  }
  return boundaries;
}

// Every (metric × account) combination gets its own "lane" — its own line/set
// of candles, drawn against that metric's own y-scale, styled solid (karma)
// or dashed (leads) so overlapping series stay legible in dual-metric mode.
interface Lane {
  key: string;
  account: string;
  metric: ChartMetric;
  color: string;
  points: AccountDailyMetric[];
}

const toolBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 11,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};

export default function AccountMetricsChart({ series, metrics, chartType, getPostsForDate, height = 380 }: Props) {
  const [pointHover, setPointHover] = useState<PointHover | null>(null);
  const [candleHover, setCandleHover] = useState<CandleHover | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ startX: number; domain: XDomain; moved: boolean } | null>(null);

  // The point tooltip is itself clickable (a post list), so leaving the point
  // for the tooltip must not hide it immediately — a short delay lets the
  // pointer cross the gap, same as the settings-menu flyouts.
  const pointCloseTimer = useRef<number | null>(null);
  const cancelPointClose = () => {
    if (pointCloseTimer.current) { window.clearTimeout(pointCloseTimer.current); pointCloseTimer.current = null; }
  };
  const schedulePointClose = () => {
    pointCloseTimer.current = window.setTimeout(() => setPointHover(null), 200);
  };

  const lanes: Lane[] = useMemo(
    () => metrics.flatMap(metric => series.map(s => ({ key: `${metric}:${s.account}`, account: s.account, metric, color: s.color, points: s.points }))),
    [series, metrics],
  );

  const fullXDomain: XDomain = useMemo(() => {
    const allPoints = series.flatMap(s => s.points);
    if (allPoints.length === 0) {
      const now = Date.now();
      return { xMin: now - 7 * DAY_MS, xMax: now };
    }
    const times = allPoints.map(p => dateToMs(p.date));
    let xMin = Math.min(...times);
    let xMax = Math.max(...times);
    if (xMin === xMax) { xMin -= DAY_MS; xMax += DAY_MS; }
    const pad = DAY_MS * 0.6;
    return { xMin: xMin - pad, xMax: xMax + pad };
  }, [series]);

  const [xDomain, setXDomain] = useState<XDomain>(fullXDomain);
  // Keep the zoom state in sync whenever the underlying series set changes
  // (accounts added/removed) rather than carrying over a stale window.
  const seriesKey = series.map(s => s.account).join(',');
  const lastSeriesKey = useRef(seriesKey);
  if (lastSeriesKey.current !== seriesKey) {
    lastSeriesKey.current = seriesKey;
    if (xDomain !== fullXDomain) setXDomain(fullXDomain);
  }

  const plotW = VIEW_W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const xScale = (t: number) => PAD_L + ((t - xDomain.xMin) / (xDomain.xMax - xDomain.xMin || 1)) * plotW;

  // Y auto-fits to whatever's currently visible in the zoomed/panned window —
  // only the X axis (time/period) is user-navigable, per metric.
  const yDomainFor = (metric: ChartMetric) => {
    const visible = lanes
      .filter(l => l.metric === metric)
      .flatMap(l => l.points.filter(p => { const ms = dateToMs(p.date); return ms >= xDomain.xMin && ms <= xDomain.xMax; }))
      .map(p => p[metric]);
    if (visible.length === 0) return { yMin: 0, yMax: 10 };
    const yMin = Math.min(0, ...visible);
    let yMax = Math.max(...visible);
    if (yMax === yMin) yMax = yMin + 10;
    return { yMin, yMax: yMax * 1.12 };
  };

  const yDomains: Record<ChartMetric, { yMin: number; yMax: number }> = {
    karma: yDomainFor('karma'),
    leads: yDomainFor('leads'),
  };

  const yScaleFor = (metric: ChartMetric) => {
    const { yMin, yMax } = yDomains[metric];
    return (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  };

  const toSvgX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * VIEW_W;
  };

  const clampXDomain = (d: XDomain): XDomain => {
    const minSpan = DAY_MS * 0.8;
    const fullSpan = fullXDomain.xMax - fullXDomain.xMin;
    let { xMin, xMax } = d;
    if (xMax - xMin < minSpan) {
      const c = (xMax + xMin) / 2;
      xMin = c - minSpan / 2;
      xMax = c + minSpan / 2;
    }
    if (xMax - xMin > fullSpan) { xMin = fullXDomain.xMin; xMax = fullXDomain.xMax; }
    if (xMin < fullXDomain.xMin) { xMax += fullXDomain.xMin - xMin; xMin = fullXDomain.xMin; }
    if (xMax > fullXDomain.xMax) { xMin -= xMax - fullXDomain.xMax; xMax = fullXDomain.xMax; }
    return { xMin: Math.max(xMin, fullXDomain.xMin), xMax: Math.min(xMax, fullXDomain.xMax) };
  };

  const zoomAt = (factor: number, pivotXpx: number) => {
    setXDomain(d => {
      const pivotData = d.xMin + ((pivotXpx - PAD_L) / plotW) * (d.xMax - d.xMin);
      const xMin = pivotData - (pivotData - d.xMin) * factor;
      const xMax = pivotData + (d.xMax - pivotData) * factor;
      return clampXDomain({ xMin, xMax });
    });
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    zoomAt(e.deltaY > 0 ? 1.15 : 0.87, toSvgX(e.clientX));
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragState.current = { startX: toSvgX(e.clientX), domain: xDomain, moved: false };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.current) return;
    const x = toSvgX(e.clientX);
    const drag = dragState.current;
    const dxPx = x - drag.startX;
    if (Math.abs(dxPx) > 1) drag.moved = true;
    const dxData = (dxPx / plotW) * (drag.domain.xMax - drag.domain.xMin);
    setXDomain(clampXDomain({ xMin: drag.domain.xMin - dxData, xMax: drag.domain.xMax - dxData }));
  };

  const endDrag = () => { dragState.current = null; };

  const isZoomed = Math.abs(xDomain.xMin - fullXDomain.xMin) > 1000 || Math.abs(xDomain.xMax - fullXDomain.xMax) > 1000;

  const dayTicks = useMemo(() => {
    const ticks: number[] = [];
    let cur = new Date(xDomain.xMin);
    cur.setUTCHours(0, 0, 0, 0);
    if (cur.getTime() < xDomain.xMin) cur.setUTCDate(cur.getUTCDate() + 1);
    while (cur.getTime() <= xDomain.xMax) {
      ticks.push(cur.getTime());
      cur = new Date(cur.getTime() + DAY_MS);
    }
    return ticks;
  }, [xDomain]);

  const weekBoundaries = useMemo(
    () => (chartType === 'candle' ? getWeekBoundaries(xDomain.xMin, xDomain.xMax) : []),
    [chartType, xDomain],
  );

  const hoveredPosts = pointHover ? getPostsForDate(pointHover.account, pointHover.date) : [];
  const openPost = (post: PostWithMeta) => window.open(post.url, '_blank', 'noopener,noreferrer');

  const showRightAxis = metrics.includes('leads') && metrics.length === 2;
  const karmaTicks = metrics.includes('karma') ? niceTicks(yDomains.karma.yMin, yDomains.karma.yMax, 5) : [];
  const leadsTicks = metrics.includes('leads') ? niceTicks(yDomains.leads.yMin, yDomains.leads.yMax, 5) : [];
  const leftTicks = metrics.includes('karma') ? karmaTicks : leadsTicks;
  const leftMetric: ChartMetric = metrics.includes('karma') ? 'karma' : 'leads';

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={() => zoomAt(0.7, PAD_L + plotW / 2)} title="Приблизить" style={toolBtnStyle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35M11 8v6M8 11h6" /></svg>
        </button>
        <button onClick={() => zoomAt(1.4, PAD_L + plotW / 2)} title="Отдалить" style={toolBtnStyle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35M8 11h6" /></svg>
        </button>
        <button
          onClick={() => setXDomain(fullXDomain)}
          disabled={!isZoomed}
          title="Сбросить масштаб"
          style={{ ...toolBtnStyle, opacity: isZoomed ? 1 : 0.4, cursor: isZoomed ? 'pointer' : 'default' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          Сброс
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>Колесо мыши — зум, перетаскивание — период</span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
        {series.map(s => {
          const model = accountToModel.get(s.account);
          return (
            <div key={s.account} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{s.account}</span>
              {model && <span style={{ color: 'var(--text-faint)' }}>({model.name})</span>}
            </div>
          );
        })}
        {metrics.length === 2 && (
          <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
            <span>— Карма</span>
            <span style={{ fontStyle: 'italic' }}>┄ Лиды</span>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block', cursor: dragState.current ? 'grabbing' : 'grab', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-light)' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        {/* Left axis (primary metric) */}
        {leftTicks.map((t, i) => (
          <g key={'l' + i}>
            <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={yScaleFor(leftMetric)(t)} y2={yScaleFor(leftMetric)(t)} stroke="var(--background)" strokeWidth={1} />
            <text x={PAD_L - 8} y={yScaleFor(leftMetric)(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--text-faint)" fontFamily="var(--font-mono)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {/* Right axis (secondary metric, only when both active) */}
        {showRightAxis && leadsTicks.map((t, i) => (
          <text key={'r' + i} x={VIEW_W - PAD_R + 8} y={yScaleFor('leads')(t)} textAnchor="start" dominantBaseline="middle" fontSize={10} fill="var(--text-faint)" fontFamily="var(--font-mono)">
            {Math.round(t)}
          </text>
        ))}

        {/* Day gridlines + weekday-dated labels */}
        {dayTicks.map((t, i) => (
          <g key={'d' + i}>
            <line x1={xScale(t)} x2={xScale(t)} y1={PAD_T} y2={height - PAD_B} stroke="var(--hover-bg)" strokeWidth={1} />
            <text
              x={xScale(t)} y={height - PAD_B + 14}
              textAnchor="end" fontSize={9.5} fill="var(--text-faint)" fontFamily="var(--font-mono)"
              transform={`rotate(-40 ${xScale(t)} ${height - PAD_B + 14})`}
            >
              {formatDayLabel(t)}
            </text>
          </g>
        ))}

        <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={height - PAD_B} y2={height - PAD_B} stroke="var(--border)" strokeWidth={1} />
        <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={height - PAD_B} stroke="var(--border)" strokeWidth={1} />
        {showRightAxis && <line x1={VIEW_W - PAD_R} x2={VIEW_W - PAD_R} y1={PAD_T} y2={height - PAD_B} stroke="var(--border)" strokeWidth={1} />}

        <text x={14} y={(PAD_T + height - PAD_B) / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-sans)" transform={`rotate(-90 14 ${(PAD_T + height - PAD_B) / 2})`}>
          {METRIC_LABELS[leftMetric]}
        </text>
        {showRightAxis && (
          <text x={VIEW_W - 10} y={(PAD_T + height - PAD_B) / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-sans)" transform={`rotate(90 ${VIEW_W - 10} ${(PAD_T + height - PAD_B) / 2})`}>
            {METRIC_LABELS.leads}
          </text>
        )}

        <clipPath id="metrics-plot-clip">
          <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} />
        </clipPath>

        <g clipPath="url(#metrics-plot-clip)">
          {chartType === 'line' ? (
            lanes.map(lane => {
              const scale = yScaleFor(lane.metric);
              const sorted = [...lane.points].sort((a, b) => a.date.localeCompare(b.date));
              const path = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(dateToMs(p.date))} ${scale(p[lane.metric])}`).join(' ');
              const dashed = lane.metric === 'leads';
              return (
                <g key={lane.key}>
                  <path d={path} fill="none" stroke={lane.color} strokeWidth={2} strokeDasharray={dashed ? '6 4' : undefined} />
                  {sorted.map(p => (
                    <circle
                      key={p.date}
                      cx={xScale(dateToMs(p.date))}
                      cy={scale(p[lane.metric])}
                      r={3.6}
                      fill={lane.color}
                      stroke="#fff"
                      strokeWidth={1.1}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => {
                        cancelPointClose();
                        setPointHover({ account: lane.account, date: p.date, karma: p.karma, leads: p.leads, clientX: e.clientX, clientY: e.clientY });
                      }}
                      onMouseMove={e => setPointHover(h => (h ? { ...h, clientX: e.clientX, clientY: e.clientY } : h))}
                      onMouseLeave={schedulePointClose}
                    />
                  ))}
                </g>
              );
            })
          ) : (
            weekBoundaries.map(ws => {
              const we = ws + 7 * DAY_MS;
              const weekPxW = xScale(we) - xScale(ws);
              const clusterW = weekPxW * 0.7;
              const clusterX0 = xScale(ws) + weekPxW * 0.15;
              const n = lanes.length || 1;
              return lanes.map((lane, i) => {
                const scale = yScaleFor(lane.metric);
                const inWeek = lane.points
                  .filter(p => { const ms = dateToMs(p.date); return ms >= ws && ms < we; })
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (inWeek.length === 0) return null;
                const values = inWeek.map(p => p[lane.metric]);
                const open = values[0];
                const close = values[values.length - 1];
                const high = Math.max(...values);
                const low = Math.min(...values);
                const candleW = (clusterW / n) * 0.75;
                const cx = clusterX0 + (clusterW / n) * (i + 0.5);
                const up = close >= open;
                const bodyTop = scale(Math.max(open, close));
                const bodyBottom = scale(Math.min(open, close));
                const dashed = lane.metric === 'leads';
                return (
                  <g
                    key={lane.key + ws}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => setCandleHover({ account: lane.account, metric: lane.metric, weekStart: ws, weekEnd: we, open, high, low, close, clientX: e.clientX, clientY: e.clientY })}
                    onMouseMove={e => setCandleHover(h => (h ? { ...h, clientX: e.clientX, clientY: e.clientY } : h))}
                    onMouseLeave={() => setCandleHover(null)}
                  >
                    <line x1={cx} x2={cx} y1={scale(high)} y2={scale(low)} stroke={lane.color} strokeWidth={1.4} strokeDasharray={dashed ? '3 2' : undefined} />
                    <rect
                      x={cx - candleW / 2}
                      y={Math.min(bodyTop, bodyBottom)}
                      width={candleW}
                      height={Math.max(1.5, Math.abs(bodyBottom - bodyTop))}
                      fill={lane.color}
                      fillOpacity={up ? 0.9 : 0.25}
                      stroke={lane.color}
                      strokeWidth={1.4}
                      strokeDasharray={dashed ? '3 2' : undefined}
                    />
                  </g>
                );
              });
            })
          )}
        </g>
      </svg>

      {pointHover && (
        <div
          onMouseEnter={cancelPointClose}
          onMouseLeave={schedulePointClose}
          style={{
            position: 'fixed',
            left: pointHover.clientX + 14,
            top: pointHover.clientY - 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 12px',
            zIndex: 9999,
            maxWidth: 280,
            boxShadow: '0 8px 30px rgba(0,0,0,0.14)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{pointHover.account}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
            {formatDayLabel(dateToMs(pointHover.date))}
            {metrics.includes('karma') && <> · Карма: <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>+{pointHover.karma}</span></>}
            {metrics.includes('leads') && <> · Лиды: <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>+{pointHover.leads}</span></>}
          </div>
          {hoveredPosts.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Постов в этот день нет</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {hoveredPosts.slice(0, 8).map(post => (
                <div
                  key={post.id}
                  title={post.title}
                  onClick={() => openPost(post)}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, cursor: 'pointer', padding: '2px 0' }}
                  onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseOut={e => (e.currentTarget.style.color = '')}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>r/{post.subreddit}</span>
                  <span style={{ color: '#FF4500', fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>▲ {post.score}</span>
                </div>
              ))}
              {hoveredPosts.length > 8 && (
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>+{hoveredPosts.length - 8} ещё</div>
              )}
            </div>
          )}
        </div>
      )}

      {candleHover && (
        <div style={{
          position: 'fixed',
          left: candleHover.clientX + 14,
          top: candleHover.clientY - 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 12px',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.14)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
            {candleHover.account} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· {METRIC_LABELS[candleHover.metric]}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>
            {formatShortDate(candleHover.weekStart)} – {formatShortDate(candleHover.weekEnd - DAY_MS)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', fontSize: 11 }}>
            <span style={{ color: 'var(--text-faint)' }}>Open</span><span style={{ fontFamily: 'var(--font-mono)' }}>{candleHover.open}</span>
            <span style={{ color: 'var(--text-faint)' }}>High</span><span style={{ fontFamily: 'var(--font-mono)' }}>{candleHover.high}</span>
            <span style={{ color: 'var(--text-faint)' }}>Low</span><span style={{ fontFamily: 'var(--font-mono)' }}>{candleHover.low}</span>
            <span style={{ color: 'var(--text-faint)' }}>Close</span><span style={{ fontFamily: 'var(--font-mono)' }}>{candleHover.close}</span>
          </div>
        </div>
      )}
    </div>
  );
}
