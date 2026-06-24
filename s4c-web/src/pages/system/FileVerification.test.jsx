import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FileVerification from './FileVerification';
import { parseVerificationFile, calculateSHA512 } from '../../util/verificationUtils';
import { LanguageProvider } from '../../context/LanguageContext';

describe('parseVerificationFile', () => {
  it('parses expected hash and algorithm from verification file content', () => {
    const txtContent = `
Hash Algorithm: SHA-512
File Hash: a1b2c3d4e5
    `;
    const result = parseVerificationFile(txtContent);
    expect(result).toEqual({
      algorithm: 'SHA-512',
      expectedHash: 'a1b2c3d4e5',
    });
  });

  it('handles lowercase keys and whitespace trimming', () => {
    const txtContent = `
hash algorithm: sha-512
file hash:   f5e4d3c2b1   
    `;
    const result = parseVerificationFile(txtContent);
    expect(result).toEqual({
      algorithm: 'sha-512',
      expectedHash: 'f5e4d3c2b1',
    });
  });

  it('returns empty strings if lines are missing', () => {
    const txtContent = `Some random text file content without signature fields`;
    const result = parseVerificationFile(txtContent);
    expect(result).toEqual({
      algorithm: '',
      expectedHash: '',
    });
  });
});

describe('calculateSHA512', () => {
  it('computes SHA-512 hash correctly', async () => {
    // Mock File object
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const file = new File([blob], 'test.txt');

    const expectedHash = '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f';
    const hash = await calculateSHA512(file);
    expect(hash).toBe(expectedHash);
  });
});

describe('FileVerification Page Component', () => {
  it('renders initial state with empty fields', () => {
    render(
      <LanguageProvider>
        <FileVerification />
      </LanguageProvider>
    );
    expect(screen.getByText('Import File & Verification')).toBeInTheDocument();
    expect(screen.getByText('Pending upload of CSV/Excel and verification files...')).toBeInTheDocument();
  });
});
