import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import MembersDirectory from './MembersDirectory';

vi.mock('../api', () => ({
  api: {
    getMembers: vi.fn(),
    downloadCsv: vi.fn(),
  },
}));

import { api } from '../api';

const members = [
  {
    id: 1,
    first_name: 'Alice',
    last_name: 'Uwase',
    phone_number: '0788111222',
    total_savings: '125000',
  },
  {
    id: 2,
    first_name: 'Bob',
    last_name: 'Mugisha',
    phone_number: '0788333444',
    total_savings: '5000',
  },
];

const renderDirectory = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <MembersDirectory />
      </ToastProvider>
    </MemoryRouter>
  );

describe('MembersDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getMembers.mockResolvedValue({ members, total_count: 2 });
    api.downloadCsv.mockResolvedValue(undefined);
  });

  it('loads and renders the member list with savings', async () => {
    renderDirectory();

    expect(await screen.findByText('Alice Uwase')).toBeInTheDocument();
    expect(screen.getByText('Bob Mugisha')).toBeInTheDocument();
    expect(screen.getByText('0788111222')).toBeInTheDocument();
    expect(screen.getByText(/125,000 RWF savings/)).toBeInTheDocument();
    expect(api.getMembers).toHaveBeenCalledWith(0, 20);
    expect(screen.getByText(/2 total members registered/)).toBeInTheDocument();
  });

  it('shows an empty state when nobody is registered', async () => {
    api.getMembers.mockResolvedValue({ members: [], total_count: 0 });
    renderDirectory();

    expect(await screen.findByText('No members found')).toBeInTheDocument();
  });

  it('exports the CSV when the export button is clicked', async () => {
    const user = userEvent.setup();
    renderDirectory();
    await screen.findByText('Alice Uwase');

    await user.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(api.downloadCsv).toHaveBeenCalledWith('members'));
    expect(await screen.findByText('Members CSV downloaded')).toBeInTheDocument();
  });

  it('surfaces load failures', async () => {
    api.getMembers.mockRejectedValue(new Error('Network down'));
    renderDirectory();

    expect(await screen.findByText('No members found')).toBeInTheDocument();
  });
});
