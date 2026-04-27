export interface Bursary {
  id: string;
  name: string;
  provider: string;
  field: string;
  description?: string;
  amount: string;
  deadline: string;
  eligibility: string;
  minAPS?: number;
  applicationUrl?: string;
}

export interface Application {
  id?: string;
  userId: string;
  bursaryId: string;
  status: 'planning' | 'in_progress' | 'submitted' | 'accepted' | 'rejected';
  deadlineDate: string;
  appliedDate?: string;
}