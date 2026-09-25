import type { VerifyResponse } from '@worknoon/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { verifyResponse } from '@/test/fixtures';
import { jsonResponse, mockFetch, renderWithProviders } from '@/test/utils';
import { VerifyForm, verifyFormSchema } from './VerifyForm';

describe('verifyFormSchema', () => {
  it('accepts a valid email and order number', () => {
    expect(
      verifyFormSchema.safeParse({ email: ' ada@example.com ', orderNumber: 'WN-1001' }).success,
    ).toBe(true);
  });

  it.each([
    [{ email: '', orderNumber: 'WN-1001' }, 'email'],
    [{ email: 'not-an-email', orderNumber: 'WN-1001' }, 'email'],
    [{ email: 'ada@example.com', orderNumber: 'W#1' }, 'orderNumber'],
    [{ email: 'ada@example.com', orderNumber: 'W1' }, 'orderNumber'],
  ])('rejects %o on %s', (input, field) => {
    const result = verifyFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });
});

describe('<VerifyForm />', () => {
  it('shows field errors and does not call the API when the input is invalid', async () => {
    const { fetchMock } = mockFetch([]);
    const user = userEvent.setup();
    renderWithProviders(<VerifyForm onVerified={vi.fn<(response: VerifyResponse) => void>()} />);

    await user.click(screen.getByRole('button', { name: /find my order/i }));
    expect(await screen.findByText('Enter the email you used for the order.')).toBeInTheDocument();
    expect(screen.getByText('Enter your order number.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Email address'), 'nope');
    await user.type(screen.getByLabelText('Order number'), 'W#1');
    await user.click(screen.getByRole('button', { name: /find my order/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText(/order numbers look like/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a generic inline error on VERIFICATION_FAILED', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/customers/verify',
        respond: () =>
          jsonResponse(
            {
              error: {
                code: 'VERIFICATION_FAILED',
                message: "We couldn't find an order matching those details.",
              },
            },
            404,
          ),
      },
    ]);
    const user = userEvent.setup();
    const onVerified = vi.fn<(response: VerifyResponse) => void>();
    renderWithProviders(<VerifyForm onVerified={onVerified} />);

    await user.type(screen.getByLabelText('Email address'), 'ada.okafor@example.com');
    await user.type(screen.getByLabelText('Order number'), 'WN-9999');
    await user.click(screen.getByRole('button', { name: /find my order/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn't find an order matching those details/i,
    );
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('shows a friendly message when rate limited', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/customers/verify',
        respond: () =>
          jsonResponse({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429),
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(
      <VerifyForm
        defaultValues={{ email: 'ada@example.com', orderNumber: 'WN-1001' }}
        onVerified={vi.fn<(response: VerifyResponse) => void>()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /find my order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a moment/i);
  });

  it('submits trimmed values and reports the verified conversation', async () => {
    const { calls } = mockFetch([
      {
        method: 'POST',
        path: '/customers/verify',
        respond: () => jsonResponse(verifyResponse, 201),
      },
    ]);
    const user = userEvent.setup();
    const onVerified = vi.fn<(response: VerifyResponse) => void>();
    renderWithProviders(<VerifyForm onVerified={onVerified} />);

    await user.type(screen.getByLabelText('Email address'), '  ada.okafor@example.com ');
    await user.type(screen.getByLabelText('Order number'), 'WN-1001');
    await user.click(screen.getByRole('button', { name: /find my order/i }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(verifyResponse));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/api/laravel/v1/customers/verify',
      body: { email: 'ada.okafor@example.com', orderNumber: 'WN-1001' },
    });
  });
});
