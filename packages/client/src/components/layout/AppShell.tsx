/**
 * Application shell: sidebar on desktop, bottom navigation on mobile.
 *
 * Also owns the permanent AI-mode banner and the floating assistant trigger,
 * because both must appear on every page per the spec.
 */

import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BookOpen,
  Briefcase,
  FileText,
  Hammer,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Network,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AssistantPanel } from '@/components/layout/AssistantPanel';

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const STUDENT_NAV: NavItem[] = [
  { to: '/app', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/app/skills', labelKey: 'nav.skills', icon: BarChart3 },
  { to: '/app/cv', labelKey: 'nav.cv', icon: FileText },
  { to: '/app/careers', labelKey: 'nav.careers', icon: Briefcase },
  { to: '/app/gap', labelKey: 'nav.gap', icon: Target },
  { to: '/app/skill-map', labelKey: 'nav.skillMap', icon: Network },
  { to: '/app/roadmap', labelKey: 'nav.roadmap', icon: Map },
  { to: '/app/resources', labelKey: 'nav.resources', icon: BookOpen },
  { to: '/app/projects', labelKey: 'nav.projects', icon: Hammer },
  { to: '/app/progress', labelKey: 'nav.progress', icon: TrendingUp },
  { to: '/app/profile', labelKey: 'nav.profile', icon: User },
  { to: '/app/settings', labelKey: 'nav.settings', icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/app', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/admin', labelKey: 'nav.admin', icon: Sparkles },
  { to: '/app/settings', labelKey: 'nav.settings', icon: Settings },
];

export function AppShell() {
  const { t } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const { aiMode, aiNotice } = useSettings();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const location = useLocation();

  const nav = isAdmin ? ADMIN_NAV : STUDENT_NAV;

  return (
    <div className="min-h-screen">
      {/* The AI-mode banner is permanent and must be visible on every page. */}
      {aiMode !== 'openai' || aiNotice ? (
        <div
          role="status"
          className="border-b border-developing/30 bg-developing/10 px-4 py-2 text-center text-xs text-developing"
        >
          {aiNotice ??
            'Demo Mode is active. AI results here are produced by rules, not by a trained model.'}
        </div>
      ) : null}

      <a
        href="#main-content"
        className="sr-only-focusable absolute left-4 top-4 z-50 rounded bg-brand px-4 py-2 text-white"
      >
        Skip to main content
      </a>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))] lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-6 py-5">
              <Map className="h-6 w-6 text-brand" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">{t('app.name')}</p>
                <p className="text-xs text-muted">v3</p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-subtle text-brand dark:bg-brand/20'
                        : 'text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-raised))]',
                    )
                  }
                >
                  <item.icon
                    className="h-4.5 w-4.5 shrink-0"
                    style={{ width: 18, height: 18 }}
                    aria-hidden="true"
                  />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-[rgb(var(--border))] p-3">
              <div className="mb-2 px-3">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => void logout()}
                icon={<LogOut className="h-4 w-4" />}
              >
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3 lg:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <Map className="h-5 w-5 text-brand" aria-hidden="true" />
            <span className="text-sm font-bold">{t('app.name')}</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {mobileNavOpen ? (
          <nav
            className="fixed inset-x-0 top-[57px] z-40 max-h-[70vh] overflow-y-auto border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 lg:hidden"
            aria-label="Mobile navigation"
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/app'}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium',
                    isActive
                      ? 'bg-brand-subtle text-brand'
                      : 'hover:bg-[rgb(var(--surface-raised))]',
                  )
                }
              >
                <item.icon style={{ width: 18, height: 18 }} aria-hidden="true" />
                {t(item.labelKey)}
              </NavLink>
            ))}
            <Button
              variant="ghost"
              fullWidth
              onClick={() => void logout()}
              className="mt-2"
              icon={<LogOut className="h-4 w-4" />}
            >
              Sign out
            </Button>
          </nav>
        ) : null}

        <main id="main-content" className="min-w-0 flex-1 pb-20 lg:pb-8" key={location.pathname}>
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation: the five most-used destinations. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] lg:hidden"
        aria-label="Primary"
      >
        {STUDENT_NAV.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium',
                isActive ? 'text-brand' : 'text-muted',
              )
            }
          >
            <item.icon style={{ width: 20, height: 20 }} aria-hidden="true" />
            <span className="truncate px-1">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Assistant is available on every page. */}
      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 lg:bottom-6"
        aria-label="Open the AI career assistant"
      >
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </button>

      {assistantOpen ? (
        <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
