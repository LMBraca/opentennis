import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1200,height:1000}, deviceScaleFactor:2 });
const log = (...a) => console.log(...a);

// Sign in.
await p.goto('http://localhost:3000/admin/login', { waitUntil:'networkidle' });
await p.fill('input[name=email]', 'lmbdv50@gmail.com');
await p.fill('input[name=password]', 'court-deuce-smash-eeca');
await p.click('button[type=submit]');
await p.waitForURL('**/admin', { timeout:15000 });

// Create a tournament.
await p.click('a[href="/admin/new"]');
await p.waitForTimeout(800);
await p.fill('input[name=name]', 'Torneo de Prueba Completo');
await p.fill('input[name=startDate]', '2026-12-05');
await p.fill('input[name=endDate]', '2026-12-13');
await p.click('button[type=submit]');
await p.waitForURL('**/admin/**', { timeout:15000 });
const slug = new URL(p.url()).pathname.split('/')[2];
log('created ->', slug);

// Add two cells: first Add in each of the first two rows.
const addButtons = await p.$$('button:has-text("+ Add")');
log('empty cells:', addButtons.length);
await addButtons[0].click(); await p.waitForTimeout(900);
const again = await p.$$('button:has-text("+ Add")');
await again[1].click(); await p.waitForTimeout(900);
log('cells enabled:', (await p.$$('select[name=format]')).length);

// Paste entrants into the first cell.
await p.click('button:has-text("Entrants")');
await p.waitForTimeout(500);
await p.fill('textarea[name=names]',
  ['Priya Raman','Marco Silva','Dana Chen','Sam Okonkwo','Luca Rossi','Noor Hassan','Theo Dubois','Ines Costa'].join('\n'));
await p.click('button:has-text("Add entrants")');
await p.waitForTimeout(1800);
log('entrant result:', (await p.textContent('[role=status]'))?.trim());

// Generate all draws.
await p.click('button:has-text("Generate all draws")');
await p.waitForTimeout(2500);
const status = await p.$('[role=status]');
log('generate:', (await status?.textContent())?.trim());
const err = await p.$('[role=alert]');
if (err) log('note:', (await err.textContent())?.trim());

// Publish it.
await p.click('button:has-text("Published")'); await p.waitForTimeout(1200);
await p.click('button:has-text("Public")'); await p.waitForTimeout(1200);
await p.screenshot({ path: `${process.env.SP}/mg.png`, fullPage:true });

// Confirm it is now live publicly.
await p.goto('http://localhost:3000/', { waitUntil:'networkidle' });
log('home lists it:', (await p.content()).includes('Torneo de Prueba Completo'));
await p.goto(`http://localhost:3000/t/${slug}`, { waitUntil:'networkidle' });
log('public page:', (await p.textContent('h1'))?.trim());
await b.close();
