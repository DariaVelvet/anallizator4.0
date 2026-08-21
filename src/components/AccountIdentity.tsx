import { accountToModel } from '../lib/dataUtils';
import type { Team } from '../lib/types';
import AvatarLink from './AvatarLink';

export type TeamFilter = 'all' | Team;

export const TEAM_FILTER_LABELS: Record<TeamFilter, string> = { all: 'Все', velvet: 'Velvet', gb: 'GB' };

const TEAM_BADGE_COLORS: Record<Team, { bg: string; text: string }> = {
  velvet: { bg: 'var(--success-bg)', text: 'var(--success-text)' },
  gb: { bg: 'var(--primary-light)', text: 'var(--primary)' },
};

export function TeamBadge({ team }: { team: Team }) {
  return (
    <span style={{
      fontSize: 8.5,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      background: TEAM_BADGE_COLORS[team].bg,
      color: TEAM_BADGE_COLORS[team].text,
      borderRadius: 4,
      padding: '2px 5px',
      flexShrink: 0,
    }}>
      {team}
    </span>
  );
}

/** Account name plus the model it belongs to — used wherever accounts from
 *  possibly-different models are compared, so it's clear at a glance who's who. */
export default function AccountIdentity({ name, compact }: { name: string; compact?: boolean }) {
  const model = accountToModel.get(name);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', minWidth: 0 }} title={model ? `${name} · ${model.name}` : name}>
      <AvatarLink src={model?.avatar ?? ''} size={compact ? 16 : 18} alt={model?.name ?? name} fallbackLetter={(model?.name ?? name)[0]} border="none" />
      <div style={{ overflow: 'hidden', minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 12.5, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {model?.name ?? 'Unknown'}
        </div>
      </div>
    </div>
  );
}
