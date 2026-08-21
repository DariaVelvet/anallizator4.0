import { useState, useRef, useEffect } from 'react';
import { models } from '../lib/dataUtils';
import type { DatePreset } from '../lib/types';
import DateRangePicker from './DateRangePicker';
import AvatarLink from './AvatarLink';

interface Props {
  selectedModels: string[];
  selectedAccounts: string[];
  datePreset: DatePreset;
  customFrom: Date | null;
  customTo: Date | null;
  search: string;
  onModelsChange: (v: string[]) => void;
  onAccountsChange: (v: string[]) => void;
  onDatePresetChange: (v: DatePreset) => void;
  onCustomFromChange: (v: Date | null) => void;
  onCustomToChange: (v: Date | null) => void;
  onSearchChange: (v: string) => void;
}

function ModelDropdown({ selectedModels, selectedAccounts, onModelsChange, onAccountsChange }: {
  selectedModels: string[];
  selectedAccounts: string[];
  onModelsChange: (v: string[]) => void;
  onAccountsChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<'all' | 'velvet' | 'gb'>('all');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleModels = models.filter(m => {
    if (teamFilter !== 'all' && m.team !== teamFilter) return false;
    if (modelSearch && !m.name.toLowerCase().includes(modelSearch.toLowerCase())) return false;
    return true;
  });

  const toggleModel = (name: string) => {
    const isCurrentlySelected = selectedModels.includes(name);
    const next = isCurrentlySelected
      ? selectedModels.filter(m => m !== name)
      : [...selectedModels, name];
    onModelsChange(next);

    const model = models.find(m => m.name === name);
    const modelAccounts = model ? model.accounts : [];

    if (isCurrentlySelected) {
      // Model removed: drop its accounts from the selection.
      onAccountsChange(selectedAccounts.filter(a => !modelAccounts.includes(a)));
    } else {
      // Model added: auto-select all of its accounts (user can remove some after).
      const merged = new Set([...selectedAccounts, ...modelAccounts]);
      onAccountsChange(Array.from(merged));
    }
  };

  // Selects/deselects every currently *visible* model — i.e. respecting the
  // active team filter (Velvet/GB/All) and search text. This is how "select
  // all Velvet" or "select all GB" works: filter to a team, then hit this.
  const allVisibleSelected = visibleModels.length > 0 && visibleModels.every(m => selectedModels.includes(m.name));

  const toggleSelectAllVisible = () => {
    const visibleNames = new Set(visibleModels.map(m => m.name));
    const visibleAccounts = new Set(visibleModels.flatMap(m => m.accounts));

    if (allVisibleSelected) {
      onModelsChange(selectedModels.filter(name => !visibleNames.has(name)));
      onAccountsChange(selectedAccounts.filter(a => !visibleAccounts.has(a)));
    } else {
      onModelsChange(Array.from(new Set([...selectedModels, ...visibleNames])));
      onAccountsChange(Array.from(new Set([...selectedAccounts, ...visibleAccounts])));
    }
  };

  const selectAllLabel = teamFilter === 'all' ? 'Все' : teamFilter === 'velvet' ? 'Все Velvet' : 'Все GB';

  const placeholder = selectedModels.length === 0
    ? 'Pick a model'
    : selectedModels.length === 1
    ? selectedModels[0]
    : `${selectedModels.length} models selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>Model</div>
      <div style={{ position: 'relative', minWidth: 200 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={modelSearch}
          onFocus={() => setOpen(true)}
          onChange={e => { setModelSearch(e.target.value); setOpen(true); }}
          style={{
            width: '100%',
            padding: '7px 32px 7px 30px',
            background: 'var(--surface)',
            border: '1px solid ' + (open ? '#93c5fd' : 'var(--border)'),
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            boxSizing: 'border-box',
          }}
        />
        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        {selectedModels.length > 0 && (
          <span style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            pointerEvents: 'none',
          }}>
            {selectedModels.length}
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          zIndex: 500,
          minWidth: 220,
          maxHeight: 380,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid var(--background)' }}>
            {(['all', 'velvet', 'gb'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTeamFilter(t)}
                style={{
                  flex: 1,
                  background: teamFilter === t ? 'var(--primary-light)' : 'var(--surface)',
                  border: '1px solid ' + (teamFilter === t ? 'var(--primary-border)' : 'var(--border)'),
                  borderRadius: 5,
                  color: teamFilter === t ? 'var(--primary)' : 'var(--text-muted)',
                  padding: '4px 0',
                  fontSize: 11,
                  fontWeight: teamFilter === t ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'all' ? 'Все' : t === 'velvet' ? 'Velvet' : 'GB'}
              </button>
            ))}
          </div>

          <div style={{ overflowY: 'auto', padding: '4px 0' }}>
            {visibleModels.length > 0 && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--background)', height: 33 }}>
                <button
                  onClick={toggleSelectAllVisible}
                  title={allVisibleSelected ? `Снять все (${selectAllLabel})` : `Выбрать ${selectAllLabel}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    padding: '8px 14px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '17px',
                  }}
                >
                  {allVisibleSelected ? `Снять все (${selectAllLabel})` : `Выбрать ${selectAllLabel}`}
                </button>
                {selectedModels.length > 0 && (
                  <button
                    onClick={() => { onModelsChange([]); onAccountsChange([]); }}
                    style={{ padding: '8px 14px', background: 'none', border: 'none', borderLeft: '1px solid var(--background)', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0, whiteSpace: 'nowrap', lineHeight: '17px' }}
                  >
                    Очистить всё
                  </button>
                )}
              </div>
            )}
            {visibleModels.length === 0 && (
              <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
                Ничего не найдено
              </div>
            )}
            {visibleModels.map(m => (
              <label
                key={m.name}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                <input
                  type="checkbox"
                  checked={selectedModels.includes(m.name)}
                  onChange={() => toggleModel(m.name)}
                  style={{ accentColor: 'var(--primary)', width: 14, height: 14 }}
                />
                <AvatarLink src={m.avatar} size={22} alt={m.name} fallbackLetter={m.name[0]} border="none" />
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>{m.accounts.length}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountDropdown({ selectedModels, selectedAccounts, onAccountsChange }: {
  selectedModels: string[];
  selectedAccounts: string[];
  onAccountsChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const available = models.filter(m => selectedModels.includes(m.name)).flatMap(m => m.accounts);
  const toggle = (acc: string) => {
    onAccountsChange(selectedAccounts.includes(acc)
      ? selectedAccounts.filter(a => a !== acc)
      : [...selectedAccounts, acc]);
  };

  const label = selectedAccounts.length === 0
    ? 'All accounts'
    : selectedAccounts.length === 1
    ? selectedAccounts[0]
    : `${selectedAccounts.length} accounts`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>Account</div>
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
          color: selectedAccounts.length === 0 ? 'var(--text-faint)' : 'var(--text)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          minWidth: 160,
          justifyContent: 'space-between',
        }}
      >
        {label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          zIndex: 500,
          minWidth: 200,
          maxHeight: 320,
          overflowY: 'auto',
          padding: '4px 0',
        }}>
          {selectedAccounts.length > 0 && (
            <button
              onClick={() => onAccountsChange([])}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--background)', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Clear all
            </button>
          )}
          {available.map(acc => (
            <label
              key={acc}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer' }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseOut={e => (e.currentTarget.style.background = 'none')}
            >
              <input
                type="checkbox"
                checked={selectedAccounts.includes(acc)}
                onChange={() => toggle(acc)}
                style={{ accentColor: 'var(--primary)', width: 14, height: 14 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{acc}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Filters({
  selectedModels, selectedAccounts, datePreset, customFrom, customTo, search,
  onModelsChange, onAccountsChange, onDatePresetChange, onCustomFromChange, onCustomToChange, onSearchChange,
}: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
      <ModelDropdown
        selectedModels={selectedModels}
        selectedAccounts={selectedAccounts}
        onModelsChange={onModelsChange}
        onAccountsChange={onAccountsChange}
      />

      {selectedModels.length > 0 && (
        <AccountDropdown
          selectedModels={selectedModels}
          selectedAccounts={selectedAccounts}
          onAccountsChange={onAccountsChange}
        />
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>Date Range</div>
        <DateRangePicker
          preset={datePreset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={onDatePresetChange}
          onCustomFromChange={onCustomFromChange}
          onCustomToChange={onCustomToChange}
        />
      </div>

      {/* Search */}
      <div style={{ marginLeft: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.02em' }}>Search</div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search subreddit..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              padding: '7px 12px 7px 34px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 13,
              color: 'var(--text)',
              outline: 'none',
              width: 200,
              fontFamily: 'var(--font-sans)',
            }}
          />
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
