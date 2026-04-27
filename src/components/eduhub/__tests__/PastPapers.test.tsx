import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PastPapers from '@/components/eduhub/PastPapers';

describe('PastPapers', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows unavailable download state for placeholder paper links', () => {
    render(<PastPapers />);

    expect(screen.getAllByText('Download unavailable until verified').length).toBeGreaterThan(0);
  });
});