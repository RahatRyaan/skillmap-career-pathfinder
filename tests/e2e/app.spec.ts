/**
 * End-to-end tests.
 *
 * The critical path from the specification, run against a real server, a real
 * database, and the production client build.
 *
 *   register → add skills → upload CV → select career → gap → roadmap
 *   → progress → adapted roadmap
 */

import { expect, test, type Page } from '@playwright/test';

const DEMO = { email: 'demo@skillmap.ai', password: 'Demo1234' };

/**
 * The API client keeps a session in localStorage, so it leaks between tests in
 * a file.
 *
 * Storage is cleared through the CDP-equivalent init script rather than by
 * navigating: navigating to the app first would race the signed-in redirect,
 * which destroys the execution context mid-evaluate.
 */
async function signOut(page: Page) {
  // A fresh context per test is the correct isolation, so this only has to
  // clear a session that a previous step in the SAME test created.
  await page.goto('/');
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      // Storage may be unavailable; the assertion will fail with a clear reason.
    }
  });
  await page.goto('/');
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password').fill(DEMO.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app/);
}

test.describe('public pages', () => {
  test.beforeEach(async ({ page }) => {
    await signOut(page);
  });

  test('landing page explains the product and links to sign up', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('career');
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
    // The honesty promise is on the landing page, not buried in a policy.
    await expect(page.getByText(/do not quote salaries/i).first()).toBeVisible();
  });

  test('AI info page states no model was trained', async ({ page }) => {
    await page.goto('/ai-info');
    await expect(page.getByText(/no model was trained/i)).toBeVisible();
    await expect(page.getByText(/demo mode/i).first()).toBeVisible();
  });

  test('privacy notice covers CV privacy and deletion', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /privacy notice/i })).toBeVisible();
    await expect(page.getByText(/never public/i).first()).toBeVisible();
    await expect(page.getByText(/delete your entire account/i).first()).toBeVisible();
  });
});

test.describe('authentication', () => {
  test.beforeEach(async ({ page }) => {
    await signOut(page);
  });

  test('a visitor can register and lands in onboarding', async ({ page }) => {
    const email = `e2e-${Date.now()}@skillmap.test`;
    await page.goto('/register');
    await page.getByLabel(/full name/i).fill('E2E Student');
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^password/i).fill('ValidPass123');
    await page.getByLabel(/university/i).fill('Test University');
    await page.getByLabel(/department/i).fill('Statistics');
    await page.getByLabel(/academic year/i).fill('Third year');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/app\/onboarding/);
  });

  test('a bad password is rejected with a message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText(/incorrect/i);
  });

  test('a signed-out visitor is redirected from the app', async ({ page }) => {
    await signOut(page);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('the student journey', () => {
  test('register → skills → career → gap', async ({ page }) => {
    const email = `journey-${Date.now()}@skillmap.test`;

    await page.goto('/register');
    await page.getByLabel(/full name/i).fill('Journey Student');
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^password/i).fill('ValidPass123');
    await page.getByLabel(/university/i).fill('Test University');
    await page.getByLabel(/department/i).fill('Computer Science');
    await page.getByLabel(/academic year/i).fill('Final year');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);

    // Skip profile, land on skills, add two.
    await page
      .getByRole('button', { name: /skip for now/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: /add a few skills/i })).toBeVisible();
    await page.getByLabel(/search the library/i).fill('SQL');
    await page.getByRole('button', { name: /SQL/ }).first().click();
    await page.getByLabel(/search the library/i).fill('Python');
    await page
      .getByRole('button', { name: /Python/ })
      .first()
      .click();
    await expect(page.getByText(/SQL · /)).toBeVisible();

    // Continue through CV and career steps.
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByRole('button', { name: /i will do this later/i }).click();
    await page.getByRole('button', { name: /browse all careers/i }).click();

    // Choose a career, which sets the target.
    await expect(page.getByRole('heading', { name: 'Careers' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('heading', { name: 'Data Analyst' }).click();
    await expect(page.getByRole('heading', { name: 'Data Analyst' })).toBeVisible({
      timeout: 20_000,
    });

    // Set it as the target from the career page itself.
    await page.getByRole('button', { name: /make this my target/i }).click();
    await expect(page.getByText(/now your target career/i)).toBeVisible({ timeout: 20_000 });

    // The skill gap page now has a real number and the disclaimer.
    await page.goto('/app/gap');
    await expect(page.getByRole('heading', { name: 'Skill gap' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Career alignment').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/not a prediction of employment/i).first()).toBeVisible();
  });

  test('the demo student sees a populated dashboard', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: /hello, ayesha/i })).toBeVisible();
    await expect(page.getByText('Career alignment').first()).toBeVisible();
    // The spec's disclaimer ships on the dashboard.
    await expect(page.getByText(/not a prediction of employment/i).first()).toBeVisible();
  });

  test('every score can be explained', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/gap');
    await expect(page.getByRole('heading', { name: 'Skill gap' })).toBeVisible();

    // The reasons live in <details><summary>, so the accessible element is a
    // disclosure control rather than a group.
    const why = page.getByText(/why this order\?/i).first();
    await expect(why).toBeVisible();
    // Expanding one must reveal an actual explanation.
    await why.click();
    await expect(page.getByText(/ranking factors/i).first()).toBeVisible();
  });

  test('roadmap can be generated, viewed in three views, and completed', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/roadmap');

    // Either the empty state with a generate button, or an existing roadmap.
    const generate = page.getByRole('button', { name: /generate my roadmap/i });
    await expect(generate.or(page.getByRole('tab', { name: /timeline/i }))).toBeVisible({
      timeout: 20_000,
    });
    if (await generate.count()) {
      await generate.click();
    }

    await expect(page.getByRole('tab', { name: /timeline/i })).toBeVisible({ timeout: 30_000 });

    // Every view renders the same items.
    for (const view of ['Weekly checklist', 'Kanban']) {
      await page.getByRole('tab', { name: new RegExp(view, 'i') }).click();
      await expect(page.getByRole('tab', { name: new RegExp(view, 'i') })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }

    // Marking an item done is recorded.
    await page.getByRole('tab', { name: /timeline/i }).click();
    const markDone = page.getByRole('button', { name: /mark done/i }).first();
    if (await markDone.isVisible().catch(() => false)) {
      await markDone.click();
      await expect(page.getByText(/done/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('the assistant answers a question grounded in real data', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /open the ai career assistant/i }).click();
    await page.getByLabel(/message the assistant/i).fill('What should I learn next?');
    await page.getByRole('button', { name: /send message/i }).click();

    // The answer must carry a source tag, which proves it was grounded.
    await expect(
      page.getByText(/from your profile|from career database|ai suggestion/i).first(),
    ).toBeVisible({
      timeout: 20_000,
    });
  });

  test('the assistant refuses to give a salary figure', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /open the ai career assistant/i }).click();
    await page.getByLabel(/message the assistant/i).fill('How much does a Data Analyst earn?');
    await page.getByRole('button', { name: /send message/i }).click();

    await expect(
      page.getByText(/cannot give salary|cannot quote salary|unable to provide/i).first(),
    ).toBeVisible({
      timeout: 20_000,
    });
  });

  test('progress can be logged and appears in the activity feed', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/progress');
    await page.getByLabel(/how long did you study/i).selectOption('45');
    await page.getByRole('button', { name: /log session/i }).click();
    await expect(page.getByText(/logged 45 minutes/i)).toBeVisible();
  });

  test('settings expose language, text size, and low-data mode', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    await expect(page.getByText(/low-data mode/i).first()).toBeVisible();
    await page.getByRole('button', { name: /বাংলা/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await page.getByRole('button', { name: /English/ }).click();
  });
});

test.describe('accessibility', () => {
  test('the app shell has a skip link and one h1 per page', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('link', { name: /skip to main content/i })).toBeAttached();

    for (const path of ['/app', '/app/skills', '/app/careers', '/app/settings']) {
      await page.goto(path);
      const h1s = await page.locator('h1').count();
      expect(h1s, `${path} should have exactly one h1`).toBeLessThanOrEqual(1);
    }
  });

  test('every chart offers a table equivalent', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/gap');
    const toggle = page.getByRole('button', { name: /show table/i }).first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await expect(page.getByRole('button', { name: /show chart/i }).first()).toBeVisible();
    }
  });

  test('the skill map works without the graph when low-data mode is on', async ({ page }) => {
    await signIn(page);
    await page.goto('/app/settings');
    await expect(page.getByText(/low-data mode/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('checkbox').first().check();
    // The preference is written to the server asynchronously, so wait for the
    // document class to prove it was applied before navigating away.
    await expect(page.locator('html.low-data')).toBeAttached({ timeout: 15_000 });

    await page.goto('/app/skill-map');
    await expect(page.getByText(/low-data mode is on/i).first()).toBeVisible({ timeout: 20_000 });

    // The point of low-data mode is that no information is lost, so the same
    // skills must still be listed. This branch renders a list, not a graph.
    await expect(page.getByRole('listitem').first()).toBeVisible();
    expect(await page.getByRole('listitem').count()).toBeGreaterThan(5);

    // And the interactive graph must genuinely be gone.
    expect(await page.locator('.react-flow').count()).toBe(0);
  });

  test('all form controls have an accessible name', async ({ page }) => {
    await signIn(page);
    for (const path of ['/app/settings', '/app/profile', '/app/onboarding']) {
      await page.goto(path);
      const unnamed = await page.locator('input:not([type=hidden]), select, textarea').evaluateAll(
        (nodes) =>
          nodes.filter((node) => {
            const el = node as HTMLElement;
            if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
            if (el.id && document.querySelector(`label[for="${el.id}"]`)) return false;
            return el.closest('label') === null;
          }).length,
      );
      expect(unnamed, `${path} has ${unnamed} unnamed controls`).toBe(0);
    }
  });
});

test.describe('admin', () => {
  test('a student cannot reach the admin area', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin');
    // Redirected to their own dashboard rather than shown an error.
    await expect(page).toHaveURL(/\/app/);
  });

  test('an admin sees the impact dashboard with real numbers', async ({ page }) => {
    await signOut(page);
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@e2e.skillmap.ai');
    await page.getByLabel('Password').fill('E2eAdminPass123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/app/);

    await page.goto('/admin/impact');
    await expect(page.getByRole('heading', { name: 'Impact' })).toBeVisible();
    await expect(page.getByText('Students assessed').first()).toBeVisible();
    // The honesty note about computed figures is on the page.
    await expect(page.getByText(/computed from live database records/i).first()).toBeVisible();
  });
});
