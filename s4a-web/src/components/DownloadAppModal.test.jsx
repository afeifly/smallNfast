import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DownloadAppModal from './DownloadAppModal';
import * as platformUtil from '../util/platform';
import intl from 'react-intl-universal';
import localesEn from '../locales/en-US';

describe('DownloadAppModal (About S4A & Download Modal)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await intl.init({
      currentLocale: 'en-US',
      locales: { 'en-US': localesEn }
    });
  });

  it('renders download buttons when in web mode', () => {
    vi.spyOn(platformUtil, 'checkIsWeb').mockReturnValue(true);

    render(
      <DownloadAppModal
        isOpen={true}
        onClose={vi.fn()}
        version="0.1.5"
      />
    );

    expect(screen.getAllByText(/v0.1.5/).length).toBeGreaterThan(0);
    // Download links should be present
    const winLink = screen.getByTitle('Download s4a_window.zip');
    expect(winLink).toBeDefined();
    expect(winLink.getAttribute('href')).toBe('/s4a_window.zip');
  });

  it('does not render real download buttons when not in web mode (desktop mode)', () => {
    vi.spyOn(platformUtil, 'checkIsWeb').mockReturnValue(false);

    render(
      <DownloadAppModal
        isOpen={true}
        onClose={vi.fn()}
        version="0.1.5"
      />
    );

    // Download links should NOT be rendered
    expect(screen.queryByTitle('Download s4a_window.zip')).toBeNull();
    expect(screen.queryByTitle('Download s4a_mac.zip')).toBeNull();

    // Version number and specs are rendered
    expect(screen.getAllByText(/v0.1.5/).length).toBeGreaterThan(0);
    expect(screen.getByText('Communication & Hardware Compatibility')).toBeDefined();
    // Footer has only close button
    expect(screen.queryByRole('button', { name: /System Diagnostic Logs/i })).toBeNull();
  });
});
