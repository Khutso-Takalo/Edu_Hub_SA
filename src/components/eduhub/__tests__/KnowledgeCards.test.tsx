import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import KnowledgeCards from '@/components/eduhub/KnowledgeCards';

describe('KnowledgeCards', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders bursary detail guidance', () => {
    render(<KnowledgeCards context="bursary-detail" />);

    expect(screen.getByText('Hidden curriculum')).toBeTruthy();
    expect(screen.getByText('Never pay to apply')).toBeTruthy();
    expect(screen.getByText('Prepare one clean PDF per document')).toBeTruthy();
  });

  it('renders tracker guidance in compact mode', () => {
    render(<KnowledgeCards context="tracker" compact />);

    expect(screen.getByText('The rules behind a strong application queue')).toBeTruthy();
    expect(screen.getByText('Checklist items matter more than status labels')).toBeTruthy();
  });
});