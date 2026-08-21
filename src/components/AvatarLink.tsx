import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  src: string;
  size: number;
  alt?: string;
  fallbackLetter?: string;
  border?: string;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * A model avatar that opens the full-size image in a modal overlay when
 * clicked, without triggering whatever click/label behavior the parent
 * element has (row navigation, checkbox toggles, etc).
 */
export default function AvatarLink({ src, size, alt, fallbackLetter, border }: Props) {
  const [open, setOpen] = useState(false);

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  if (!src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          color: '#fff',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {fallbackLetter ?? '?'}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={e => { stop(e); setOpen(true); }}
        onMouseDown={stop}
        title="Открыть аватар"
        style={{
          display: 'block',
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          border: border ?? '2px solid var(--border)',
          flexShrink: 0,
          cursor: 'zoom-in',
          padding: 0,
          background: 'none',
        }}
      >
        <img src={src} alt={alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </button>

      {open && createPortal(
        <div
          onClick={e => { stop(e); setOpen(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--text)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <button
            onClick={e => { stop(e); setOpen(false); }}
            title="Закрыть"
            style={{
              position: 'absolute',
              top: 20,
              right: 24,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              padding: 8,
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <CloseIcon />
          </button>
          <div
            onClick={stop}
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              lineHeight: 0,
            }}
          >
            <img
              src={src}
              alt={alt ?? ''}
              style={{
                display: 'block',
                maxWidth: '90vw',
                maxHeight: '85vh',
                borderRadius: 6,
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
