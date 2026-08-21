import { useState } from 'react';
import type { PostWithMeta } from '../lib/types';
import { formatKyivTime } from '../lib/timeUtils';

interface Props {
  posts: PostWithMeta[];
}

interface TooltipState {
  post: PostWithMeta;
  clientX: number;
  clientY: number;
}

export default function TopPostsCell({ posts }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (posts.length === 0) return <span style={{ color: 'var(--disabled)', fontSize: 11 }}>—</span>;

  const handleEnter = (post: PostWithMeta, e: React.MouseEvent) => {
    setTooltip({ post, clientX: e.clientX, clientY: e.clientY });
  };

  const handleMove = (e: React.MouseEvent) => {
    if (tooltip) setTooltip(t => t ? { ...t, clientX: e.clientX, clientY: e.clientY } : null);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} onMouseMove={handleMove}>
      {posts.map(post => (
        <a
          key={post.id}
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={e => handleEnter(post, e)}
          onMouseLeave={() => setTooltip(null)}
          style={{
            display: 'block',
            width: 20,
            height: 20,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--border)',
            flexShrink: 0,
            transition: 'border-color 0.15s, transform 0.15s',
          }}
          onMouseOver={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--primary)';
            el.style.transform = 'scale(1.15)';
          }}
          onMouseOut={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--border)';
            el.style.transform = 'scale(1)';
          }}
        >
          {post.modelAvatar ? (
            <img src={post.modelAvatar} alt={post.modelName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>
              {post.modelName[0]}
            </div>
          )}
        </a>
      ))}

      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.clientX + 14,
          top: tooltip.clientY - 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 14px',
          zIndex: 9999,
          pointerEvents: 'none',
          minWidth: 190,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--background)' }}>
            {tooltip.post.modelAvatar && (
              <img src={tooltip.post.modelAvatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border)' }} />
            )}
            <div>
              <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{tooltip.post.modelName}</div>
              <div style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>@{tooltip.post.account}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 16px', fontSize: 12 }}>
            <span style={{ color: 'var(--text-faint)' }}>Upvotes</span>
            <span style={{ color: '#FF4500', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{tooltip.post.score}</span>
            <span style={{ color: 'var(--text-faint)' }}>Comments</span>
            <span style={{ color: '#7c3aed', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{tooltip.post.comments}</span>
            <span style={{ color: 'var(--text-faint)' }}>Score</span>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{tooltip.post.successScore}</span>
          </div>
          <div style={{ marginTop: 10, color: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            {formatKyivTime(tooltip.post.created_utc)}
          </div>
        </div>
      )}
    </div>
  );
}
