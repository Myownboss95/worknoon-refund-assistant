import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { escalatedDetail, IDS } from '@/test/fixtures';
import { jsonResponse, mockFetch, renderWithProviders } from '@/test/utils';
import { AdminSessionProvider } from '../hooks/useAdminSession';
import { ReviewPanel, validateReviewNote } from './ReviewPanel';

function renderPanel() {
  window.sessionStorage.setItem('worknoon.adminToken', 'demo-admin');
  return renderWithProviders(
    <AdminSessionProvider>
      <ReviewPanel refundRequestId={IDS.refund} />
    </AdminSessionProvider>,
  );
}

describe('validateReviewNote', () => {
  it('requires at least 3 non-space characters', () => {
    expect(validateReviewNote('')).toMatch(/at least 3/);
    expect(validateReviewNote('  ok  ')).toMatch(/at least 3/);
    expect(validateReviewNote('yes')).toBeNull();
  });
});

describe('<ReviewPanel />', () => {
  it('blocks approve/deny until the note has 3+ characters', async () => {
    const { fetchMock } = mockFetch([]);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /approve refund/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 3 characters/);
    expect(screen.getByLabelText('Reviewer note')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Reviewer note'), 'ok');
    await user.click(screen.getByRole('button', { name: /deny refund/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 3 characters/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the review with the admin token', async () => {
    const reviewed = {
      ...escalatedDetail,
      status: 'approved' as const,
      decidedBy: 'human' as const,
      review: {
        decision: 'approve' as const,
        note: 'Photos confirm damage',
        reviewer: 'admin',
        reviewedAt: escalatedDetail.createdAt,
      },
    };
    const { calls } = mockFetch([
      {
        method: 'POST',
        path: `/admin/refund-requests/${IDS.refund}/review`,
        respond: () => jsonResponse(reviewed),
      },
    ]);
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('Reviewer note'), 'Photos confirm damage');
    await user.click(screen.getByRole('button', { name: /approve refund/i }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { decision: 'approve', note: 'Photos confirm damage' },
      headers: { 'X-Admin-Token': 'demo-admin' },
    });
    await waitFor(() => expect(screen.getByLabelText('Reviewer note')).toHaveValue(''));
  });
});
