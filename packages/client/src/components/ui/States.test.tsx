import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { EmptyState, Card } from './Card';
import { ErrorState, Badge, Skeleton } from './States';
import { Field, Input } from './Form';

describe('Button', () => {
  it('calls the handler when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continue</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and announces busy state while loading', () => {
    render(<Button isLoading>Saving</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('does not fire the handler when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('meets the WCAG 2.2 target size at the default height', () => {
    render(<Button>Tap me</Button>);
    // h-11 is 44px, the AA target-size minimum.
    expect(screen.getByRole('button')).toHaveClass('h-11');
  });
});

describe('EmptyState', () => {
  it('is announced as a heading with a description', () => {
    render(<EmptyState title="No skills yet" body="Add one to get started." />);
    expect(screen.getByRole('heading', { name: 'No skills yet' })).toBeInTheDocument();
    expect(screen.getByText('Add one to get started.')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('is announced as an alert and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load." onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load.');

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Badge', () => {
  it('always renders text, so colour is never the only signal', () => {
    render(<Badge color="critical">Critical</Badge>);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
});

describe('Form', () => {
  it('associates the label with the input', () => {
    render(
      <Field label="Email" htmlFor="email">
        <Input id="email" />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('marks a required field and shows the error to the input', () => {
    render(
      <Field label="Email" htmlFor="email" required error="Enter a valid email.">
        <Input id="email" invalid aria-describedby="email-error" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email.');
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not use a placeholder as the only label', () => {
    render(
      <Field label="Search skills" htmlFor="s">
        <Input id="s" placeholder="SQL, Python" />
      </Field>,
    );
    // The accessible name comes from the label, not the placeholder.
    expect(screen.getByRole('textbox', { name: 'Search skills' })).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
