import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from './App';

describe('App', () => {
    it('renders GraphicView component', () => {
        const { container } = render(<App />);
        expect(container.getElementsByClassName('graphic-view').length).toBeGreaterThan(0);
    });
});
