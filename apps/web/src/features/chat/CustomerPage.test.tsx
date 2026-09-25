import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conversationAfterDecision, IDS, sendResponse, verifyResponse } from '@/test/fixtures';
import { jsonResponse, mockFetch, renderWithProviders } from '@/test/utils';
import { CustomerPage } from './CustomerPage';

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
});
