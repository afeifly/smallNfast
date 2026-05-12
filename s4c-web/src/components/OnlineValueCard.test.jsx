import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OnlineValueCard from './OnlineValueCard';

describe('OnlineValueCard', () => {
  it('renders the title', () => {
    render(<OnlineValueCard title="Test Sensor" items={[]} />);
    expect(screen.getByText('Test Sensor')).toBeInTheDocument();
  });

  it('renders default items when no items provided', () => {
    render(<OnlineValueCard />);
    // Multiple default items share the same value, use getAllByText
    const flowValues = screen.getAllByText('34.566.774.8');
    expect(flowValues.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("S401 2# Consumption")).toBeInTheDocument();
  });

  it('renders provided items', () => {
    const items = [
      { label: 'Temperature', value: '25.6', unit: '°C' },
      { label: 'Humidity', value: '60', unit: '%' },
    ];

    render(<OnlineValueCard title="Env Sensor" items={items} />);
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('25.6')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.getByText('Humidity')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders the correct number of item rows', () => {
    const items = [
      { label: 'A', value: '1', unit: 'u1' },
      { label: 'B', value: '2', unit: 'u2' },
      { label: 'C', value: '3', unit: 'u3' },
    ];

    const { container } = render(<OnlineValueCard title="Test" items={items} />);

    // Find all item rows (each has a 48px height div with borderBottom)
    const rows = container.querySelectorAll('[style*="height: 48"]');
    expect(rows.length).toBe(3);
  });

  it('renders with a green header', () => {
    const { container } = render(<OnlineValueCard title="Green" items={[]} />);
    // Check for the green background on the header div
    const headerDivs = container.querySelectorAll('div');
    const greenHeader = Array.from(headerDivs).find(
      (div) => div.style.background === 'rgb(0, 174, 134)'
    );
    expect(greenHeader).toBeTruthy();
  });
});
