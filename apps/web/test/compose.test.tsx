import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ComposeClient } from '../components/ComposeClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseProps = {
  initial: {
    subject: 'Hi',
    from: 'Me <me@x.com>',
    body: 'Hello plain',
    recipients: 'a@x.com',
    resume: 'Resume_Test.pdf',
  },
  resumes: [{ name: 'Resume_Test.pdf', size: 1024 }],
  daily: { sentToday: 0, dailyLimit: 10 },
  onSave: vi.fn(async () => ({ ok: true, savedAt: '2026-01-01T00:00:00.000Z' })),
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
});
