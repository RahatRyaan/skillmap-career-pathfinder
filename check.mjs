import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0,100)));

await p.goto('http://localhost:5173/');
console.log('LANDING h1:', (await p.locator('h1').textContent())?.slice(0,60));

await p.getByRole('link', { name: /get started/i }).click();
await p.waitForURL('**/register');
console.log('REGISTER loaded:', await p.locator('h1').textContent());

await p.goto('http://localhost:5173/login');
await p.getByRole('button', { name: /use the demo account/i }).click();
await p.getByRole('button', { name: /^sign in$/i }).click();
await p.waitForURL('**/app', { timeout: 20000 });
console.log('SIGNED IN ->', p.url());

await p.waitForTimeout(3000);
console.log('dashboard greeting:', await p.locator('h1').first().textContent());
const cards = await p.locator('.card').count();
console.log('cards rendered:', cards);
console.log('console errors:', errs.length ? errs.slice(0,3) : 'none');
await p.screenshot({ path: 'check-dashboard.png', fullPage: false });
await b.close();
