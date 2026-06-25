'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Icon set (inline SVG, ~16px). Use via Icons.verify, Icons.hide, etc.
// ---------------------------------------------------------------------------

export const Icons: Record<string, ReactNode> = {
  verify: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  hide: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  remove: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
  trash: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
  restore: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
    </svg>
  ),
  edit: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  approve: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  reject: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  add: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  view: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  planned: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Spinner (used when pending=true)
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: 'admin-spin 0.7s linear infinite' }}
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// IconAction
// ---------------------------------------------------------------------------

export type IconActionVariant = 'default' | 'primary' | 'success' | 'danger';

export interface IconActionProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: IconActionVariant;
  disabled?: boolean;
  pending?: boolean;
}

export function IconAction({
  icon,
  label,
  onClick,
  href,
  variant = 'default',
  disabled = false,
  pending = false,
}: IconActionProps) {
  const cls = `admin-icon-btn admin-icon-btn--${variant}`;
  const content = pending ? <Spinner /> : icon;

  if (href && !disabled) {
    return (
      <Link href={href} className={cls} title={label} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled || pending}
    >
      {content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ConfirmAction
// ---------------------------------------------------------------------------

export interface ConfirmActionProps {
  icon: ReactNode;
  label: string;
  confirmTitle: string;
  confirmBody?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: 'danger' | 'default';
  disabled?: boolean;
}

export function ConfirmAction({
  icon,
  label,
  confirmTitle,
  confirmBody,
  confirmLabel = 'Verwijderen',
  onConfirm,
  variant = 'default',
  disabled = false,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync open state with the <dialog> native show/close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  // Close on native cancel (Esc key).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = () => closeDialog();
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    setError(null);
    setOpen(false);
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      // Keep the dialog open and surface the friendly Dutch message thrown by
      // the server action, falling back to a generic message.
      const message = e instanceof Error && e.message ? e.message : null;
      setError(message ?? 'Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setPending(false);
    }
  }

  const triggerCls = `admin-icon-btn admin-icon-btn--${variant === 'danger' ? 'danger' : 'default'}`;
  const confirmBtnCls = `btn btn-sm ${variant === 'danger' ? 'btn-danger' : 'btn-soft'}`;

  return (
    <>
      <button
        type="button"
        className={triggerCls}
        title={label}
        aria-label={label}
        onClick={openDialog}
        disabled={disabled}
      >
        {icon}
      </button>

      <dialog ref={dialogRef} className="admin-confirm-dialog" aria-labelledby="confirm-title">
        <div className="admin-confirm-overlay" onClick={() => closeDialog()} aria-hidden="true" />
        <div className="admin-confirm-box">
          <p id="confirm-title" className="admin-confirm-title">
            {confirmTitle}
          </p>
          {confirmBody ? <p className="admin-confirm-body">{confirmBody}</p> : null}
          {error ? (
            <p
              className="admin-confirm-error"
              role="alert"
              style={{ color: 'var(--red, #dc2626)' }}
            >
              {error}
            </p>
          ) : null}
          <div className="admin-confirm-actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => closeDialog()}
              disabled={pending}
            >
              Annuleren
            </button>
            <button
              type="button"
              className={confirmBtnCls}
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending ? <Spinner /> : null}
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
