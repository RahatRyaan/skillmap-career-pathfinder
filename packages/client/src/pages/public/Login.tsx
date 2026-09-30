import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Map } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toUserMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';

export default function Login() {
  const { t } = useTranslation();
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await login({ email: email.trim(), password });
      navigate('/app');
    } catch (err) {
      setError(toUserMessage(err, 'Could not sign you in. Please try again.'));
    }
  };

  const fillDemo = () => {
    setEmail('demo@skillmap.ai');
    setPassword('Demo1234');
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <Map className="h-7 w-7 text-brand" aria-hidden="true" />
            <span className="text-xl font-bold">{t('app.name')}</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Pick up your skill map where you left it.</p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="card space-y-4" noValidate>
          <Field label="Email" htmlFor="login-email" required error={fieldErrors.email}>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            />
          </Field>

          <Field label="Password" htmlFor="login-password" required error={fieldErrors.password}>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            />
          </Field>

          <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
            Sign in
          </Button>
        </form>

        <div className="mt-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-sm">
          <p className="font-medium">Want to look around first?</p>
          <p className="mt-1 text-muted">
            A demo student is seeded with real data: Data Analyst target, five skills, visible gaps.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fillDemo}>
            Use the demo account
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          New here?{' '}
          <Link to="/register" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
