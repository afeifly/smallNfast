import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import DownloadAppModal from './DownloadAppModal';
import * as platformUtil from '../util/platform';
import intl from 'react-intl-universal';
import localesEn from '../locales/en-US';
import { setBuildModeForTesting } from '../util/buildMode';

describe('DownloadAppModal (About S4A & Download Modal)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setBuildModeForTesting('full');
    await intl.init({
      currentLocale: 'en-US',
      locales: { 'en-US': localesEn }
    });
  });

  afterEach(() => {
    setBuildModeForTesting(null);
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
    for (const platform of ['window', 'mac', 'android']) {
      const file = `s4a_${platform}.zip`;
      const link = screen.getByTitle(`Download ${file}`);
      expect(link.getAttribute('href')).toBe(`/${file}`);
      expect(link.getAttribute('download')).toBe(file);
    }
  });

  it('links to basic packages in basic mode', () => {
    setBuildModeForTesting('basic');
    vi.spyOn(platformUtil, 'checkIsWeb').mockReturnValue(true);

    render(<DownloadAppModal isOpen={true} onClose={vi.fn()} />);

    for (const platform of ['window', 'mac', 'android']) {
      const file = `s4a_basic_${platform}.zip`;
      const link = screen.getByTitle(`Download ${file}`);
      expect(link.getAttribute('href')).toBe(`/${file}`);
      expect(link.getAttribute('download')).toBe(file);
    }
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
