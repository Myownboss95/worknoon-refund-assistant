import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conversationAfterDecision, IDS, sendResponse, verifyResponse } from '@/test/fixtures';
import { jsonResponse, mockFetch, renderWithProviders } from '@/test/utils';
import { CustomerPage } from './CustomerPage';

const STORED_KEY = 'worknoon.conversation.laravel';

async function verifyAndDraft(user: ReturnType<typeof userEvent.setup>, message: string) {
  await user.type(screen.getByLabelText('Email address'), 'ada.okafor@example.com');
  await user.type(screen.getByLabelText('Order number'), 'WN-1001');
  await user.click(screen.getByRole('button', { name: /find my order/i }));
  await user.click(await screen.findByRole('checkbox', { name: /problend 600 blender/i }));
  await user.type(screen.getByLabelText('Your message'), message);
}

function setupApi() {
  return mockFetch([
    { method: 'POST', path: '/customers/verify', respond: () => jsonResponse(verifyResponse, 201) },
    {
      method: 'POST',
      path: `/conversations/${IDS.conversation}/messages`,
      respond: () => jsonResponse(sendResponse),
    },
    {
      method: 'GET',
      path: `/conversations/${IDS.conversation}`,
      respond: () => jsonResponse(conversationAfterDecision),
    },
  ]);
}

describe('Customer chat flow', () => {
  it('verifies, selects an item, sends a message and shows the decision', async () => {
    const { calls } = setupApi();
    const user = userEvent.setup();
    renderWithProviders(<CustomerPage />);

    // Verify
    await user.type(screen.getByLabelText('Email address'), 'ada.okafor@example.com');
    await user.type(screen.getByLabelText('Order number'), 'WN-1001');
    await user.click(screen.getByRole('button', { name: /find my order/i }));

    // Order card + greeting
    expect(await screen.findByText('ProBlend 600 Blender')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(STORED_KEY)).toBe(IDS.conversation);
    expect(
      within(screen.getByRole('list', { name: 'Conversation' })).getByText(
        /I can help with order WN-1001/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Final sale')).toBeInTheDocument();

    // Already-refunded item is disabled
    expect(screen.getByRole('checkbox', { name: /stoneware mug set/i })).toBeDisabled();

    // Send is disabled until an item is selected and text is entered
    const send = screen.getByRole('button', { name: /^send$/i });
    expect(send).toBeDisabled();
    await user.type(
      screen.getByLabelText('Your message'),
      'My blender arrived with a cracked jug.',
    );
    expect(send).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /problend 600 blender/i }));
    expect(send).toBeEnabled();
    expect(screen.getByText('38/1000')).toBeInTheDocument();

    await user.click(send);

    // Decision card
    const card = await screen.findByTestId('decision-card');
    expect(within(card).getByText('Refund approved')).toBeInTheDocument();
    expect(within(card).getByText('$89.00')).toBeInTheDocument();
    expect(within(card).getByText('Your refund of $89.00 has been approved.')).toBeInTheDocument();
    expect(within(card).getByText('R08')).toBeInTheDocument();

    // Conversation closed -> composer replaced by a closed notice
    expect(screen.getByText(/this conversation is closed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your message')).not.toBeInTheDocument();

    // Live region announces the latest assistant message
    expect(screen.getByTestId('assistant-live-region')).toHaveTextContent(
      /refund of \$89\.00 has been approved/,
    );

    const sent = calls.find((call) => call.url.endsWith('/messages'));
    expect(sent?.body).toEqual({
      text: 'My blender arrived with a cracked jug.',
      itemIds: [IDS.itemBlender],
    });

    // Start over returns to the verify form
    await user.click(within(card).getByRole('button', { name: /start over/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /find my order/i })).toBeInTheDocument(),
    );
    expect(window.sessionStorage.getItem(STORED_KEY)).toBeNull();
  });

  it('keeps the chat open after a clarification reply', async () => {
    const clarification = {
      ...sendResponse,
      conversation: {
        ...sendResponse.conversation,
        status: 'open' as const,
        clarificationTurns: 1,
      },
      decision: null,
    };
    mockFetch([
      {
        method: 'POST',
        path: '/customers/verify',
        respond: () => jsonResponse(verifyResponse, 201),
      },
      { method: 'POST', path: /\/messages$/, respond: () => jsonResponse(clarification) },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CustomerPage />);

    await user.type(screen.getByLabelText('Email address'), 'ada.okafor@example.com');
    await user.type(screen.getByLabelText('Order number'), 'WN-1001');
    await user.click(screen.getByRole('button', { name: /find my order/i }));
    await user.click(await screen.findByRole('checkbox', { name: /problend 600 blender/i }));
    await user.type(screen.getByLabelText('Your message'), 'It is not great.');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => expect(screen.getByLabelText('Your message')).toHaveValue(''));
    expect(screen.queryByTestId('decision-card')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your message')).toBeEnabled();
  });

  it('prefills the form from a demo scenario and offers its sample message', async () => {
    setupApi();
    const user = userEvent.setup();
    renderWithProviders(<CustomerPage />);

    await user.click(screen.getByRole('button', { name: /ada okafor/i }));
    expect(screen.getByLabelText('Email address')).toHaveValue('ada.okafor@example.com');
    expect(screen.getByLabelText('Order number')).toHaveValue('WN-1001');

    await user.click(screen.getByRole('button', { name: /find my order/i }));
    await user.click(await screen.findByRole('button', { name: /use sample message/i }));

    expect(screen.getByLabelText('Your message')).toHaveValue(
      'My blender arrived with a cracked jug. It leaks everywhere when I use it.',
    );
    expect(screen.getByRole('checkbox', { name: /problend 600 blender/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /^send$/i })).toBeEnabled();
  });

  it('shows a friendly message when the previous turn is still running', async () => {
    mockFetch([
      { method: 'POST', path: '/customers/verify', respond: () => jsonResponse(verifyResponse, 201) },
      {
        method: 'POST',
        path: /\/messages$/,
        respond: () =>
          jsonResponse(
            {
              error: {
                code: 'CONVERSATION_BUSY',
                message: "We're still working on your previous message.",
              },
            },
            409,
          ),
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CustomerPage />);

    await verifyAndDraft(user, 'My blender arrived with a cracked jug.');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(
      await screen.findByText('Still working on your previous message — give it a moment.'),
    ).toBeInTheDocument();
    // The draft is kept so the customer can resend once the turn finishes.
    expect(screen.getByLabelText('Your message')).toHaveValue(
      'My blender arrived with a cracked jug.',
    );
  });

  it('does not submit again while a message is being sent', async () => {
    let release: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { calls } = mockFetch([
      { method: 'POST', path: '/customers/verify', respond: () => jsonResponse(verifyResponse, 201) },
      // The fetch stub awaits whatever `respond` returns, so a pending promise holds the request open.
      { method: 'POST', path: /\/messages$/, respond: () => pending as unknown as Response },
      {
        method: 'GET',
        path: `/conversations/${IDS.conversation}`,
        respond: () => jsonResponse(conversationAfterDecision),
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CustomerPage />);

    await verifyAndDraft(user, 'My blender arrived with a cracked jug.');
    const send = screen.getByRole('button', { name: /^send$/i });
    await user.click(send);

    await waitFor(() => expect(send).toBeDisabled());
    await user.click(send);
    const textarea = screen.getByLabelText('Your message');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.submit(textarea.closest('form') as HTMLFormElement);

    expect(calls.filter((call) => call.url.endsWith('/messages'))).toHaveLength(1);

    release(jsonResponse(sendResponse));
    expect(await screen.findByTestId('decision-card')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.endsWith('/messages'))).toHaveLength(1);
  });
});

describe('Restoring the conversation after a refresh', () => {
  it('reloads the stored conversation with its order, messages and decision', async () => {
    window.sessionStorage.setItem(STORED_KEY, IDS.conversation);
    const { calls } = mockFetch([
      {
        method: 'GET',
        path: `/conversations/${IDS.conversation}`,
        respond: () => jsonResponse(conversationAfterDecision),
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CustomerPage />);

    expect(await screen.findByText('ProBlend 600 Blender')).toBeInTheDocument();
    const conversation = screen.getByRole('list', { name: 'Conversation' });
    expect(within(conversation).getByText(/I can help with order WN-1001/)).toBeInTheDocument();
    expect(
      within(conversation).getByText('My blender arrived with a cracked jug.'),
    ).toBeInTheDocument();
    const card = screen.getByTestId('decision-card');
    expect(within(card).getByText('Refund approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /find my order/i })).not.toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`/api/laravel/v1/conversations/${IDS.conversation}`);

    await user.click(within(card).getByRole('button', { name: /start over/i }));
    expect(await screen.findByRole('button', { name: /find my order/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(STORED_KEY)).toBeNull();
  });

  it('forgets a conversation the server no longer knows and shows the verify form', async () => {
    window.sessionStorage.setItem(STORED_KEY, IDS.conversation);
    const { calls } = mockFetch([
      {
        method: 'GET',
        path: `/conversations/${IDS.conversation}`,
        respond: () =>
          jsonResponse({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404),
      },
    ]);
    renderWithProviders(<CustomerPage />);

    expect(await screen.findByRole('button', { name: /find my order/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(STORED_KEY)).toBeNull();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET /api/laravel/v1/conversations/${IDS.conversation}`,
    ]);
    expect(
      await screen.findByText('Your previous conversation is no longer available'),
    ).toBeInTheDocument();
  });

  it('ignores a conversation stored for the other backend', () => {
    window.sessionStorage.setItem('worknoon.conversation.nest', IDS.conversation);
    const { fetchMock } = mockFetch([]);
    renderWithProviders(<CustomerPage />);

    expect(screen.getByRole('button', { name: /find my order/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
