// VIPOS — EmptyState forwardRef regression test (Sentry event 2bc20292).
// Lucide icons are forwardRef objects ({$$typeof, render, displayName}).
// Rendering them directly as `{icon}` was crashing with
// "Objects are not valid as a React child" on /vipos/help and other pages.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { forwardRef } from 'react';
import { EmptyState } from '../components/ui';

const FakeIcon = forwardRef(function FakeIcon(props, ref) {
  return (
    <svg ref={ref} data-testid="fake-icon" className={props.className}>
      <title>fake</title>
    </svg>
  );
});

describe('EmptyState', () => {
  it('renders default illustration when no icon given', () => {
    const { container } = render(<EmptyState title="x" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('accepts a forwardRef component reference (lucide-style)', () => {
    const { getByTestId } = render(<EmptyState icon={FakeIcon} title="x" />);
    expect(getByTestId('fake-icon')).toBeInTheDocument();
  });

  it('accepts a plain function component reference', () => {
    function PlainIcon() {
      return <svg data-testid="plain-icon" />;
    }
    const { getByTestId } = render(<EmptyState icon={PlainIcon} title="x" />);
    expect(getByTestId('plain-icon')).toBeInTheDocument();
  });

  it('accepts a pre-rendered JSX element (legacy callers)', () => {
    const { getByTestId } = render(
      <EmptyState icon={<svg data-testid="jsx-icon" className="custom" />} title="x" />
    );
    expect(getByTestId('jsx-icon')).toBeInTheDocument();
    expect(getByTestId('jsx-icon')).toHaveClass('custom');
  });

  it('renders title and description', () => {
    const { getByText } = render(<EmptyState title="No data" description="Nothing here yet" />);
    expect(getByText('No data')).toBeInTheDocument();
    expect(getByText('Nothing here yet')).toBeInTheDocument();
  });
});
