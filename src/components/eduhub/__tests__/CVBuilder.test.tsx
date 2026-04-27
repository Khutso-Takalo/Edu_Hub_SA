import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode, MouseEventHandler, ChangeEventHandler, HTMLAttributes } from 'react';
import { CVBuilder } from '@/components/eduhub/CVBuilder';
import * as useAuthModule from '@/hooks/useAuth';
import * as useCVModule from '@/hooks/useCV';
import type { UserProfile } from '@/hooks/useAuth';
import type { ATSAnalysis, CVProfile } from '@/hooks/useCV';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useCV');

type ChildrenProps = {
  children?: ReactNode;
};

type ButtonMockProps = ChildrenProps & {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type CardMockProps = ChildrenProps & HTMLAttributes<HTMLDivElement>;

type InputMockProps = {
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
};

type TextareaMockProps = {
  value?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
};

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: ButtonMockProps) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: CardMockProps) => <div {...props}>{children}</div>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder }: InputMockProps) => (
    <input value={value} onChange={onChange} placeholder={placeholder} />
  ),
}));
vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, rows }: TextareaMockProps) => (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
  ),
}));
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: ChildrenProps) => <div>{children}</div>,
  TabsContent: ({ children }: ChildrenProps) => <div>{children}</div>,
  TabsList: ({ children }: ChildrenProps) => <div>{children}</div>,
  TabsTrigger: ({ children }: ChildrenProps) => <button>{children}</button>,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: ChildrenProps) => <span>{children}</span>,
}));
vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: ChildrenProps) => <div>{children}</div>,
  AlertDescription: ({ children }: ChildrenProps) => <span>{children}</span>,
}));

describe('CVBuilder', () => {
  const mockProfile: UserProfile = {
    id: 'user-1',
    full_name: 'John Doe',
    email: 'john@example.com',
    province: 'Gauteng',
    grade_level: '12',
    subjects: [],
    career_interests: [],
    saved_bursaries: [],
    saved_institutions: [],
    saved_careers: [],
    aps_score: 40,
    profile_completed: true,
    isPremium: true,
  };

  const mockCVProfile: CVProfile = {
    id: 'cv-1',
    userId: 'user-1',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '0712345678',
    location: 'Johannesburg',
    summary: 'Experienced developer',
    selectedTemplate: 'modern',
    experiences: [],
    education: [],
    skills: [],
    achievements: [],
    certifications: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };

  const mockUseAuth = vi.mocked(useAuthModule.useAuth);
  const mockUseCV = vi.mocked(useCVModule.useCV);

  const setUseAuthReturn = (overrides?: Partial<ReturnType<typeof useAuthModule.useAuth>>) => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' } as unknown as ReturnType<typeof useAuthModule.useAuth>['user'],
      profile: mockProfile,
      loading: false,
      ...overrides,
    } as ReturnType<typeof useAuthModule.useAuth>);
  };

  const setUseCVReturn = (overrides?: Partial<ReturnType<typeof useCVModule.useCV>>) => {
    mockUseCV.mockReturnValue({
      cvProfile: null,
      atsAnalysis: null,
      atsHistory: [],
      loading: false,
      error: null,
      loadCV: vi.fn().mockResolvedValue(null),
      loadATSHistory: vi.fn().mockResolvedValue([]),
      saveCV: vi.fn().mockResolvedValue(mockCVProfile),
      deleteCV: vi.fn(),
      analyzeCV: vi.fn(),
      createFromTemplate: vi.fn((template: string) => ({
        ...mockCVProfile,
        selectedTemplate: template,
      })),
      ...overrides,
    } as ReturnType<typeof useCVModule.useCV>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setUseAuthReturn();
    setUseCVReturn();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the login gate when no user is present', () => {
    setUseAuthReturn({
      user: null,
      profile: null,
    });

    render(<CVBuilder />);

    expect(screen.getByText(/Please log in to use the CV Builder/i)).toBeTruthy();
  });

  it('creates a CV from the selected template', async () => {
    const createFromTemplate = vi.fn().mockReturnValue({
      ...mockCVProfile,
      selectedTemplate: 'modern',
    });

    setUseCVReturn({
      saveCV: vi.fn().mockResolvedValue(mockCVProfile),
      analyzeCV: vi.fn(),
      createFromTemplate,
    });

    render(<CVBuilder />);

    fireEvent.click(screen.getAllByText(/Start Building/i)[0]);

    await waitFor(() => {
      expect(createFromTemplate).toHaveBeenCalledWith('modern');
    });
  });

  it('loads an existing CV and can save and analyze it', async () => {
    const saveCV = vi.fn().mockResolvedValue(mockCVProfile);
    const analyzeCV = vi.fn().mockResolvedValue({
      cvProfileId: mockCVProfile.id || 'cv-1',
      keywordScore: 20,
      formattingScore: 18,
      readabilityScore: 15,
      overallScore: 85,
      missingKeywords: [],
      suggestedKeywords: [],
      formattingIssues: [],
      strengths: ['Good keyword coverage'],
      improvements: [],
      analysisDate: new Date().toISOString(),
    } as ATSAnalysis);

    setUseCVReturn({
      cvProfile: mockCVProfile,
      loadCV: vi.fn().mockResolvedValue(mockCVProfile),
      loadATSHistory: vi.fn().mockResolvedValue([]),
      saveCV,
      analyzeCV,
      createFromTemplate: vi.fn(),
    });

    render(<CVBuilder />);

    await waitFor(() => {
      expect(screen.getAllByText(/Contact Information/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText(/Save CV/i)[0]);
    fireEvent.click(screen.getAllByText(/Analyze CV/i)[0]);

    await waitFor(() => {
      expect(saveCV).toHaveBeenCalled();
      expect(analyzeCV).toHaveBeenCalled();
    });
  });
});
