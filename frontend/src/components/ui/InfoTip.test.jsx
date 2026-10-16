import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InfoTip from './InfoTip';

describe('InfoTip', () => {
  const title = 'Outstanding Principal';
  const body = 'Sum of remaining balances across all active loans.';

  it('renders an accessible trigger button', () => {
    render(<InfoTip title={title}>{body}</InfoTip>);
    const trigger = screen.getByRole('button', { name: `What is ${title}?` });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip on hover with the explanation', async () => {
    const user = userEvent.setup();
    render(<InfoTip title={title}>{body}</InfoTip>);
    const trigger = screen.getByRole('button', { name: `What is ${title}?` });

    await user.hover(trigger);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(title);
    expect(tooltip).toHaveTextContent(body);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('hides the tooltip on mouse leave', async () => {
    const user = userEvent.setup();
    render(<InfoTip title={title}>{body}</InfoTip>);
    const trigger = screen.getByRole('button', { name: `What is ${title}?` });

    await user.hover(trigger);
    await screen.findByRole('tooltip');
    await user.unhover(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on focus (keyboard) and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<InfoTip title={title}>{body}</InfoTip>);
    const trigger = screen.getByRole('button', { name: `What is ${title}?` });

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('toggles open/closed on click for touch users', async () => {
    const user = userEvent.setup();
    render(<InfoTip title={title}>{body}</InfoTip>);
    const trigger = screen.getByRole('button', { name: `What is ${title}?` });

    await user.click(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
