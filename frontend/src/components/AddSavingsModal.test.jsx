import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddSavingsModal from './AddSavingsModal';

vi.mock('../api', () => ({
  api: { createSavings: vi.fn() },
}));

import { api } from '../api';

describe('AddSavingsModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    api.createSavings.mockResolvedValue({});
  });

  it('records a deposit by default', async () => {
    const user = userEvent.setup();
    render(<AddSavingsModal memberId={7} onClose={onClose} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/deposit amount/i), '2500');
    await user.click(screen.getByRole('button', { name: /record deposit/i }));

    expect(api.createSavings).toHaveBeenCalledWith(7, {
      amount: 2500,
      transaction_type: 'deposit',
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('switches to withdrawal mode and sends transaction_type=withdrawal', async () => {
    const user = userEvent.setup();
    render(<AddSavingsModal memberId={7} onClose={onClose} onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Withdrawal' }));
    expect(screen.getByLabelText(/withdrawal amount/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/withdrawal amount/i), '1000');
    await user.click(screen.getByRole('button', { name: /record withdrawal/i }));

    expect(api.createSavings).toHaveBeenCalledWith(7, {
      amount: 1000,
      transaction_type: 'withdrawal',
    });
  });

  it('shows the API error and does not report success', async () => {
    api.createSavings.mockRejectedValue(
      new Error('Withdrawal exceeds the available balance of 500.')
    );
    const user = userEvent.setup();
    render(<AddSavingsModal memberId={7} onClose={onClose} onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/deposit amount/i), '5000');
    await user.click(screen.getByRole('button', { name: /record deposit/i }));

    expect(
      await screen.findByText('Withdrawal exceeds the available balance of 500.')
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps submit disabled for empty or non-positive amounts', async () => {
    const user = userEvent.setup();
    render(<AddSavingsModal memberId={7} onClose={onClose} onSuccess={onSuccess} />);

    const submit = screen.getByRole('button', { name: /record deposit/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/deposit amount/i), '0');
    expect(submit).toBeDisabled();

    expect(onClose).not.toHaveBeenCalled();
  });
});
