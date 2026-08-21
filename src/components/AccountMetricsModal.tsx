import { useMemo, useState } from 'react';
import { models, getAccountMetrics, getAccountPostsOnDate } from '../lib/dataUtils';
import { SERIES_PALETTE } from '../lib/palette';
import type { ChartMetric, ChartType } from '../lib/types';
import AccountIdentity, { TeamBadge, TEAM_FILTER_LABELS, type TeamFilter } from './AccountIdentity';
import AccountMetricsChart, { type MetricSeries } from './AccountMetricsChart';

interface Props {
  modelName: string;
  defaultAccounts: string[];
  onClose: () => void;
}

const MAX_ACCOUNTS = 8;

const METRIC_OPTIONS: { key: ChartMetric; label: string }[] = [
  { key: 'karma', label: 'Карма' },
  { key: 'leads', label: 'Лиды' },
];

const CHART_TYPE_OPTIONS: { key: ChartType; label: string }[] = [
  { key: 'line', label: 'Линия' },
  { key: 'candle', label: 'Свечи' },
];

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

export default function AccountMetricsModal({ modelName, defaultAccounts, onClose }: Props) {
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(defaultAccounts);
  const [activeMetrics, setActiveMetrics] = useState<ChartMetric[]>(['karma']);
  const [chartType, setChartType] = useState<ChartType>('line');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTeamFilter, setPickerTeamFilter] = useState<TeamFilter>('all');

  const toggleMetric = (m: ChartMetric) => {
    setActiveMetrics(prev => {
      if (prev.includes(m)) return prev.length > 1 ? prev.filter(x => x !== m) : prev; // at least one stays on
      return [...prev, m];
    });
  };

  const allAccounts = useMemo(
    () => [...models].sort((a, b) => a.name.localeCompare(b.name)).flatMap(m => m.accounts.map(acc => ({ acc, model: m }))),
    [],
  );

  const visiblePickerAccounts = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    return allAccounts.filter(({ acc, model }) => {
      if (pickerTeamFilter !== 'all' && model.team !== pickerTeamFilter) return false;
      if (!q) return true;
      return acc.toLowerCase().includes(q) || model.name.toLowerCase().includes(q);
    });
  }, [allAccounts, pickerSearch, pickerTeamFilter]);

  const toggleAccount = (acc: string) => {
    setSelectedAccounts(prev => {
      if (prev.includes(acc)) return prev.filter(a => a !== acc);
      if (prev.length >= MAX_ACCOUNTS) return prev;
      return [...prev, acc];
    });
  };

  const removeAccount = (acc: string) => setSelectedAccounts(prev => prev.filter(a => a !== acc));

  // Full history — the chart itself owns date navigation via zoom/pan.
  const series: MetricSeries[] = useMemo(() => selectedAccounts.map((acc, i) => ({
    account: acc,
    color: SERIES_PALETTE[i % SERIES_PALETTE.length],
    points: getAccountMetrics(acc),
  })), [selectedAccounts]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: 'min(960px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--background)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Графики</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{modelName} · прирост кармы и лидов по дням</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 4, lineHeight: 0 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
          {/* Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>Метрика</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {METRIC_OPTIONS.map(o => {
                  const active = activeMetrics.includes(o.key);
                  return (
                    <button
                      key={o.key}
                      onClick={() => toggleMetric(o.key)}
                      title="Можно включить обе одновременно"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: active ? 'var(--primary-light)' : 'var(--surface)',
                        border: '1px solid ' + (active ? 'var(--primary-border)' : 'var(--border)'),
                        borderRadius: 6,
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        padding: '7px 14px',
                        fontSize: 12.5,
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <span style={{
                        width: 13, height: 13, borderRadius: 4, flexShrink: 0,
                        border: '1.5px solid ' + (active ? 'var(--primary)' : 'var(--disabled)'),
                        background: active ? 'var(--primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>Тип графика</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {CHART_TYPE_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    onClick={() => setChartType(o.key)}
                    style={{
                      background: chartType === o.key ? 'var(--primary-light)' : 'var(--surface)',
                      border: '1px solid ' + (chartType === o.key ? 'var(--primary-border)' : 'var(--border)'),
                      borderRadius: 6,
                      color: chartType === o.key ? 'var(--primary)' : 'var(--text-muted)',
                      padding: '7px 14px',
                      fontSize: 12.5,
                      fontWeight: chartType === o.key ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Selected accounts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {selectedAccounts.map((acc, i) => (
              <div
                key={acc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--hover-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '4px 6px 4px 10px',
                  fontSize: 12,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SERIES_PALETTE[i % SERIES_PALETTE.length], flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{acc}</span>
                <button
                  onClick={() => removeAccount(acc)}
                  title="Убрать из сравнения"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 3, lineHeight: 0, display: 'flex' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button
              onClick={() => setShowPicker(o => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: showPicker ? 'var(--primary-light)' : 'var(--surface)',
                border: '1px solid ' + (showPicker ? 'var(--primary-border)' : 'var(--border)'),
                borderRadius: 20,
                color: showPicker ? 'var(--primary)' : 'var(--text-muted)',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              Сравнить с другими моделями
            </button>
          </div>

          {/* Account picker — every account across every model, add/remove via checkbox */}
          {showPicker && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--background)', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Поиск аккаунта или модели..."
                  style={{
                    flex: '1 1 200px',
                    padding: '6px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['all', 'velvet', 'gb'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setPickerTeamFilter(t)}
                      style={{
                        background: pickerTeamFilter === t ? 'var(--primary-light)' : 'var(--surface)',
                        border: '1px solid ' + (pickerTeamFilter === t ? 'var(--primary-border)' : 'var(--border)'),
                        borderRadius: 5,
                        color: pickerTeamFilter === t ? 'var(--primary)' : 'var(--text-muted)',
                        padding: '5px 10px',
                        fontSize: 11,
                        fontWeight: pickerTeamFilter === t ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {TEAM_FILTER_LABELS[t]}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>Выбрано {selectedAccounts.length} / {MAX_ACCOUNTS}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                {visiblePickerAccounts.length === 0 ? (
                  <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>Ничего не найдено</div>
                ) : (
                  visiblePickerAccounts.map(({ acc, model }) => (
                    <label
                      key={acc}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer' }}
                      onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'none')}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(acc)}
                        onChange={() => toggleAccount(acc)}
                        style={{ accentColor: 'var(--primary)', width: 13, height: 13, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <AccountIdentity name={acc} compact />
                      </div>
                      {model.team && <TeamBadge team={model.team} />}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chart */}
          {selectedAccounts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 13, padding: '60px 0' }}>
              Выберите хотя бы один аккаунт, чтобы увидеть график
            </div>
          ) : (
            <AccountMetricsChart
              series={series}
              metrics={activeMetrics}
              chartType={chartType}
              getPostsForDate={getAccountPostsOnDate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
