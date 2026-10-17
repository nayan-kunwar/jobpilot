import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposeClient } from '../components/ComposeClient';
import type { SendJobSnapshot } from '../lib/types';
import { doneSnapshot, idleSnapshot, jsonResponse, snapshot } from './fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  initial: {
    subject: 'Hi',
    from: 'Me <me@x.com>',
    body: 'Hello plain',
    recipients: 'a@x.com, b@y.com',
    resume: 'Resume_Test.pdf',
  },
  resumes: [{ name: 'Resume_Test.pdf', size: 1024 }],
  daily: { sentToday: 0, dailyLimit: 10 },
  delayMs: 5000,
  onSave: vi.fn(async () => ({ ok: true, savedAt: '2026-01-01T00:00:00.000Z' })),
  sendPollMs: 20,
};

describe('ComposeClient', () => {
  it('renders **bold** in the HTML preview and strips it in plain view', async () => {
    const user = userEvent.setup();
    render(<ComposeClient {...baseProps} />);
    const bodyInput = screen.getByLabelText('Email body');
    await user.clear(bodyInput);
    await user.type(bodyInput, 'I have **2+ years** now');
    const bold = screen.getByText('2+ years');
    expect(bold.tagName).toBe('B');
    await user.click(screen.getByRole('button', { name: 'Plain text' }));
    expect(screen.getByText('I have 2+ years now')).toBeInTheDocument();
  });

  it('counts recipients and removed duplicates live', async () => {
    const user = userEvent.setup();
    render(<ComposeClient {...baseProps} />);
    const recipientsInput = screen.getByLabelText('Recipients');
    await user.clear(recipientsInput);
    await user.type(recipientsInput, 'a@x.com, A@X.com, b@y.com');
    expect(screen.getByText(/2 recipients/)).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate removed/)).toBeInTheDocument();
  });

  it('saves via the injected action and reports success', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_input: unknown) => ({
      ok: true,
      savedAt: '2026-01-01T00:00:00.000Z',
    }));
    render(<ComposeClient {...baseProps} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Saved/)).toBeInTheDocument();
  });

  it('saves first, then asks for confirmation on Send now', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true, savedAt: '2026-01-01T00:00:00.000Z' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(idleSnapshot())),
    );
    render(<ComposeClient {...baseProps} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Send now' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByRole('dialog', { name: 'Confirm send' });
    expect(dialog).toHaveTextContent('Send 2 emails now?');
    expect(dialog).toHaveTextContent('Resume_Test.pdf');
    expect(dialog).toHaveTextContent('10 remaining of 10');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts the batch after confirming and follows it to completion', async () => {
    const user = userEvent.setup();
    const statuses: SendJobSnapshot[] = [idleSnapshot(), snapshot(), snapshot(), doneSnapshot()];
    let statusCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/send/status')) {
        return jsonResponse(statuses[Math.min(statusCalls++, statuses.length - 1)]);
      }
      if (url.includes('/api/send') && (init?.method ?? 'POST') === 'POST') {
        return jsonResponse({ ok: true, total: 2 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ComposeClient {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Send now' }));
    await user.click(screen.getByRole('button', { name: 'Send 2 now' }));

    expect(await screen.findByText('Sending…')).toBeInTheDocument();
    expect(await screen.findByText('Send complete')).toBeInTheDocument();
    expect(screen.getByText(/2 sent · 0 failed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();

    const posted = fetchMock.mock.calls.some(
      ([url, init]) =>
        String(url).includes('/api/send') && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(posted).toBe(true);
  });

  it('shows the start error returned by the API', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/api/send/status')
          ? jsonResponse(idleSnapshot())
          : jsonResponse(
              { error: 'Gmail is not connected (no token.json). Run "npm run auth", then try again.' },
              400,
            ),
      ),
    );
    render(<ComposeClient {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Send now' }));
    await user.click(screen.getByRole('button', { name: 'Send 2 now' }));

    expect(await screen.findByText(/npm run auth/)).toBeInTheDocument();
    expect(screen.queryByTestId('send-panel')).not.toBeInTheDocument();
  });
});
