import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomDialog from './CustomDialog';

describe('CustomDialog', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CustomDialog isOpen={false} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    render(
      <CustomDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Test Title"
        body="Test Body"
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Body')).toBeInTheDocument();
  });

  it('renders default Chinese title when no title provided', () => {
    render(
      <CustomDialog isOpen={true} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(screen.getByText('提示')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={() => {}}
        cancelText="取消"
      />
    );

    await user.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        confirmText="确定"
      />
    );

    await user.click(screen.getByText('确定'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('hides cancel button when showCancel is false', () => {
    render(
      <CustomDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        showCancel={false}
        cancelText="取消"
      />
    );

    expect(screen.queryByText('取消')).not.toBeInTheDocument();
  });

  it('hides confirm button when showConfirm is false', () => {
    render(
      <CustomDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        showConfirm={false}
        confirmText="确定"
      />
    );

    expect(screen.queryByText('确定')).not.toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <CustomDialog isOpen={true} onClose={onClose} onConfirm={() => {}} />
    );

    const overlay = container.querySelector('.custom-dialog-overlay');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders with info type icon', () => {
    const { container } = render(
      <CustomDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        type="info"
      />
    );

    const img = container.querySelector('.custom-dialog-icon');
    expect(img).toBeInTheDocument();
    expect(img.alt).toBe('info');
  });
});
