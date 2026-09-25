import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { AdminSessionProvider } from '../hooks/useAdminSession';
import { TokenGate } from './TokenGate';

function renderGate() {
  return renderWithProviders(
    <AdminSessionProvider>
      <TokenGate />
    </AdminSessionProvider>,
  );
}

describe('<TokenGate />', () => {
  it('does not hint at the demo token', () => {
    const { container } = renderGate();

    const input = screen.getByLabelText('Admin token');
    expect(input).toHaveAttribute('placeholder', 'Admin token');
    expect(container.innerHTML).not.toMatch(/demo-admin/i);
  });

  it('asks for a token when submitted empty', async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: /open dashboard/i }));
    expect(screen.getByText('Enter the admin token to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Admin token')).toHaveAttribute('aria-invalid', 'true');
  });
});
