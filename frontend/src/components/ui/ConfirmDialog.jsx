import { useState, useCallback } from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} className="max-w-md">
      <div role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="text-lg font-bold text-slate-100 mb-2">{title}</h2>
        <p className="text-slate-400 text-sm mb-6">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function useConfirm() {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (message, options = {}) =>
      new Promise((resolve) => {
        setRequest({
          message,
          title: options.title || 'Please confirm',
          confirmLabel: options.confirmLabel || 'Confirm',
          danger: !!options.danger,
          resolve,
        });
      }),
    []
  );

  const settle = (value) => {
    if (request) request.resolve(value);
    setRequest(null);
  };

  const dialog = request ? (
    <ConfirmDialog
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      danger={request.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return [confirm, dialog];
}
