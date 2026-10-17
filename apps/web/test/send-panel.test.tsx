import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SendPanel } from '../components/SendPanel';
import { doneSnapshot, jsonResponse, snapshot } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SendPanel', () => {
  it('renders per-recipient states and the event ticker', () => {
    render(<SendPanel initial={snapshot()} onClose={() => undefined} pollMs={20} />);
    expect(screen.getByText('a@x.com')).toBeInTheDocument();
    expect(screen.getAllByText('b@y.com')).toHaveLength(2); // recipient row + "Sending to" line
    expect(screen.getByText(/^Sending to/)).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
    expect(screen.getByText('sending')).toBeInTheDocument();
    expect(screen.getByText('mid-1')).toBeInTheDocument();
    expect(screen.getByText(/Sent a@x\.com/)).toBeInTheDocument();
    expect(screen.getByText(/1 sent · 0 failed · 1 left/)).toBeInTheDocument();
  });

  it('requests a stop and shows the stopping state', async () => {
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
    render(<SendPanel initial={snapshot()} onClose={() => undefined} pollMs={20} />);

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(deleted).toBe(true);
    expect(await screen.findByRole('button', { name: 'Stopping…' })).toBeDisabled();
    expect(screen.getByText(/^Finishing/)).toBeInTheDocument();
  });

  it('shows the summary and closes when finished', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SendPanel initial={doneSnapshot()} onClose={onClose} pollMs={20} />);

    expect(screen.getByText('Send complete')).toBeInTheDocument();
    expect(screen.getByText(/2 sent · 0 failed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
