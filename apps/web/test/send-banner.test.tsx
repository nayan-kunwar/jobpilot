import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SendBanner } from '../components/SendBanner';
import { idleSnapshot, jsonResponse, snapshot } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SendBanner', () => {
  it('renders nothing when no batch is running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(idleSnapshot())),
    );
    const { container } = render(<SendBanner pollMs={20} />);
    await new Promise((r) => setTimeout(r, 60)); // let the first poll land
    expect(container).toBeEmptyDOMElement();
  });

  it('shows live progress and stops the batch from the dashboard', async () => {
    const user = userEvent.setup();
    let deleted = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          deleted = true;
          return jsonResponse({ ok: true });
        }
        return jsonResponse(snapshot({ stopping: deleted }));
      }),
    );
    render(<SendBanner pollMs={20} />);

    expect(await screen.findByText('Sending now')).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 done/)).toBeInTheDocument();
    expect(screen.getByText(/current: b@y\.com/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(deleted).toBe(true);
    expect(await screen.findByText('Stopping after the current email')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
  });
});
