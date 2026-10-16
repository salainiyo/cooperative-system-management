import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirm } from './ConfirmDialog';

function Harness({ onResult, options }) {
  const [confirm, dialog] = useConfirm();
  return (
    <div>
      <button
        onClick={async () => {
          const result = await confirm('Delete this member?', options);
          onResult(result);
        }}
      >
        Ask
      </button>
      {dialog}
    </div>
  );
}

describe('useConfirm', () => {
  it('resolves true when confirmed', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resolves false when cancelled', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows the custom message, danger styling and confirm label', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <Harness
        onResult={onResult}
        options={{ danger: true, confirmLabel: 'Delete member', title: 'Please confirm' }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ask' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Please confirm');
    expect(dialog).toHaveTextContent('Delete this member?');
    expect(screen.getByRole('button', { name: 'Delete member' })).toBeInTheDocument();
  });

  it('resolves false when clicking the overlay (outside click)', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();

    await user.click(overlay);
    expect(onResult).toHaveBeenCalledWith(false);
  });
});
