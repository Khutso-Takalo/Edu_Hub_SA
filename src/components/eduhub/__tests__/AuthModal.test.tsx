import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AuthModal from '@/components/eduhub/AuthModal';

const baseAuthHandlers = () => ({
  signUp: vi.fn().mockResolvedValue({}),
  signIn: vi.fn().mockResolvedValue({}),
  verifyMfa: vi.fn().mockResolvedValue({}),
  resetPassword: vi.fn().mockResolvedValue(undefined),
});

describe('AuthModal MFA flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('switches to MFA step when sign-in requires aal2', async () => {
    const handlers = baseAuthHandlers();
    handlers.signIn.mockRejectedValueOnce(new Error('MFA_REQUIRED'));

    render(
      <AuthModal
        isOpen
        onClose={vi.fn()}
        onAuth={handlers}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email Address'), {
      target: { value: 'LEARNER@EXAMPLE.COM ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Sign In' })[1]);

    await waitFor(() => {
      expect(screen.getByText('Multi-Factor Check')).toBeTruthy();
    });

    expect(handlers.signIn).toHaveBeenCalledWith('learner@example.com', 'password123');
    expect(screen.getByText('Enter your authenticator app code to finish signing in.')).toBeTruthy();
  });

  it('shows retryable error on invalid MFA code and allows another attempt', async () => {
    const handlers = baseAuthHandlers();
    handlers.signIn.mockRejectedValueOnce(new Error('MFA_REQUIRED'));
    handlers.verifyMfa
      .mockRejectedValueOnce(new Error('Invalid code'))
      .mockResolvedValueOnce({});

    render(
      <AuthModal
        isOpen
        onClose={vi.fn()}
        onAuth={handlers}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email Address'), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign In' })[1]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('6-digit authenticator code')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('6-digit authenticator code'), {
      target: { value: '111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired MFA code. Please try again.')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('6-digit authenticator code'), {
      target: { value: '222222' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    await waitFor(() => {
      expect(handlers.verifyMfa).toHaveBeenCalledTimes(2);
    });

    expect(handlers.verifyMfa).toHaveBeenNthCalledWith(1, '111111');
    expect(handlers.verifyMfa).toHaveBeenNthCalledWith(2, '222222');
      expect(screen.getByText('Verification successful.')).toBeTruthy();
  });

  it('locks out login attempts after repeated failures within the window', async () => {
    const handlers = baseAuthHandlers();
    handlers.signIn.mockRejectedValue(new Error('Invalid login credentials'));

    render(
      <AuthModal
        isOpen
        onClose={vi.fn()}
        onAuth={handlers}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Email Address'), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });

    const submitButton = screen.getAllByRole('button', { name: 'Sign In' })[1];

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      fireEvent.click(submitButton);
      await waitFor(() => {
        expect(handlers.signIn).toHaveBeenCalledTimes(attempt);
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Too many sign-in attempts. Please wait 60 seconds and try again.')).toBeTruthy();
    });

    fireEvent.click(submitButton);

    expect(handlers.signIn).toHaveBeenCalledTimes(5);
    expect(screen.getByText(/Too many attempts\. Try again in \d+s\./i)).toBeTruthy();
  });

  it('captures signup persona context for targeted scraping', async () => {
    const handlers = baseAuthHandlers();

    render(
      <AuthModal
        isOpen
        onClose={vi.fn()}
        onAuth={handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'Ayanda Molefe' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email Address'), {
      target: { value: 'ayanda@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Account persona'), {
      target: { value: 'learner' },
    });
    fireEvent.change(screen.getByLabelText('Education stage (optional)'), {
      target: { value: 'Grade 12' },
    });
    fireEvent.change(screen.getByLabelText('Province focus (optional)'), {
      target: { value: 'Gauteng' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Technology & IT' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. medicine, nursing, Gauteng bursary'), {
      target: { value: 'cybersecurity, coding' },
    });

    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(handlers.signUp).toHaveBeenCalledTimes(1);
    });

    expect(handlers.signUp).toHaveBeenCalledWith(
      'ayanda@example.com',
      'password123',
      'Ayanda Molefe',
      {
        personaType: 'learner',
        educationStage: 'Grade 12',
        province: 'Gauteng',
        careerInterests: ['Technology & IT'],
        scrapeFocusKeywords: ['cybersecurity', 'coding'],
      }
    );
  });
});
