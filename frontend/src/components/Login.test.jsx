import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

vi.mock('../api', () => ({
  api: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
  tokenManager: {
    isAuthenticated: vi.fn(() => false),
    clearTokens: vi.fn(),
  },
}));

import { api } from '../api';

const renderLogin = (setUser = vi.fn()) =>
  render(
    <MemoryRouter>
      <Login setUser={setUser} />
    </MemoryRouter>
  );

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in and hands the current user to the app', async () => {
    const setUser = vi.fn();
    api.login.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    api.getCurrentUser.mockResolvedValue({ email: 'admin@coop.rw', is_admin: true });

    const user = userEvent.setup();
    renderLogin(setUser);

    await user.type(screen.getByLabelText(/email address/i), 'admin@coop.rw');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(api.login).toHaveBeenCalledWith('admin@coop.rw', 'secret123');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeEnabled();
    expect(setUser).toHaveBeenCalledWith({ email: 'admin@coop.rw', is_admin: true });
  });

  it('surfaces an error message when the API rejects the credentials', async () => {
    api.login.mockRejectedValue(new Error('Invalid credentials'));

    const setUser = vi.fn();
    const user = userEvent.setup();
    renderLogin(setUser);

    await user.type(screen.getByLabelText(/email address/i), 'admin@coop.rw');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(setUser).not.toHaveBeenCalled();
  });

  it('links to the password recovery page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /forgot password\?/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });
});
