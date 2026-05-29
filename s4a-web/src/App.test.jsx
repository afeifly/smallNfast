import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import App from './App';

describe('App', () => {
    it('renders GraphicView component', async () => {
        const { container } = render(<App />);
        await waitFor(() => {
            expect(container.getElementsByClassName('graphic-view').length).toBeGreaterThan(0);
        });
    });
});
