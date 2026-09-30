import { useState } from 'react';
import { Check, Database, Gauge, Languages, Moon, Sun, Zap } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useQuery } from '@tanstack/react-query';
import { appApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, ErrorState } from '@/components/ui/States';
import { cn } from '@/lib/utils';

export default function Settings() {
  const {
    theme,
    fontScale,
    lowDataMode,
    language,
    aiMode,
    setTheme,
    setFontScale,
    setLowDataMode,
    apply,
  } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const mode = useQuery({ queryKey: ['ai-mode'], queryFn: () => appApi.aiMode() });

  const save = async () => {
    setSaving(true);
    try {
      await apply({ theme, fontScale, lowDataMode, language });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="These apply immediately and are saved to your account."
        action={
          <Button onClick={() => void save()} isLoading={saving}>
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        }
      />

      <Card>
        <CardHeader title="Appearance" description="How SkillMap looks on this device." />
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Theme</p>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  aria-pressed={theme === option}
                  className={cn(
                    'inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium',
                    theme === option
                      ? 'border-brand bg-brand-subtle text-brand dark:bg-brand/20'
                      : 'border-[rgb(var(--border))]',
                  )}
                >
                  {option === 'light' ? (
                    <Sun className="h-4 w-4" />
                  ) : option === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Gauge className="h-4 w-4" />
                  )}
                  {option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'Match device'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="font-scale"
              className="mb-2 flex items-center justify-between text-sm font-medium"
            >
              Text size
              <span className="text-brand">{Math.round(fontScale * 100)}%</span>
            </label>
            <input
              id="font-scale"
              type="range"
              min={0.85}
              max={1.5}
              step={0.05}
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgb(var(--border))] accent-brand"
              aria-valuetext={`${Math.round(fontScale * 100)} percent`}
            />
            <p className="mt-1 text-xs text-muted">
              Larger text helps if reading small print is difficult. This is a real accessibility
              setting, not a preference.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Language</p>
            <div className="flex gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => void apply({ language: lang.code })}
                  aria-pressed={language === lang.code}
                  className={cn(
                    'inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium',
                    language === lang.code
                      ? 'border-brand bg-brand-subtle text-brand dark:bg-brand/20'
                      : 'border-[rgb(var(--border))]',
                  )}
                >
                  <Languages className="h-4 w-4" />
                  {lang.nativeLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Low-data mode"
          description="For slow connections or limited mobile data."
        />
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={lowDataMode}
            onChange={(e) => setLowDataMode(e.target.checked)}
            className="mt-1 h-5 w-5 accent-brand"
          />
          <span>
            <span className="block text-sm font-medium">Turn on low-data mode</span>
            <span className="mt-1 block text-sm text-muted">
              Turns off animations, removes the interactive skill map graph and replaces it with a
              simpler list, and reduces what loads on each page. Nothing is hidden — the same
              information, laid out more cheaply.
            </span>
          </span>
        </label>
      </Card>

      <Card>
        <CardHeader title="AI mode" description="What this server is currently configured to do." />
        {mode.isLoading ? <p className="text-sm text-muted">Checking…</p> : null}
        {mode.isError ? (
          <ErrorState
            message="Could not reach the server to check the AI mode."
            onRetry={() => void mode.refetch()}
          />
        ) : null}
        {mode.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                color={mode.data.mode === 'openai' ? 'brand' : 'developing'}
                icon={
                  mode.data.mode === 'openai' ? (
                    <Zap className="h-3.5 w-3.5" />
                  ) : (
                    <Database className="h-3.5 w-3.5" />
                  )
                }
              >
                {mode.data.mode === 'openai'
                  ? 'Real AI mode'
                  : mode.data.mode === 'local'
                    ? 'Local mode'
                    : 'Demo mode'}
              </Badge>
              {mode.data.available ? (
                <Badge color="strong" icon={<Check className="h-3.5 w-3.5" />}>
                  Provider reachable
                </Badge>
              ) : (
                <Badge color="critical">Provider unreachable</Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">{mode.data.description}</p>
            {mode.data.notice ? (
              <p className="mt-3 rounded-lg bg-developing/10 px-3 py-2 text-xs text-developing">
                {mode.data.notice}
              </p>
            ) : null}
            <a
              href="/ai-info"
              className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
            >
              Read the full explanation
            </a>
          </>
        ) : null}
        <p className="mt-4 text-xs text-muted">
          Configured value on the server:{' '}
          <code className="rounded bg-[rgb(var(--surface-raised))] px-1.5 py-0.5">{aiMode}</code>
        </p>
      </Card>
    </div>
  );
}
