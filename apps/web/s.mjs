import { chromium } from 'playwright';
const SLUG='torneo-de-prueba-completo-26-2';
const b = await chromium.launch();
const log=(...a)=>console.log(...a);

// --- Admin: open entries ---
const admin = await b.newPage({ viewport:{width:1200,height:1000}, deviceScaleFactor:2 });
await admin.goto('http://localhost:3000/admin/login', { waitUntil:'networkidle' });
await admin.fill('input[name=email]','lmbdv50@gmail.com');
await admin.fill('input[name=password]','court-deuce-smash-eeca');
await admin.click('button[type=submit]');
await admin.waitForURL(u=>u.pathname==='/admin',{timeout:15000});
await admin.goto(`http://localhost:3000/admin/${SLUG}`, { waitUntil:'networkidle' });
await admin.click('button:has-text("Open entries")');
await admin.waitForTimeout(1500);
log('entries open:', (await admin.content()).includes('Entries are open'));

// --- Player: register, in a clean context (no admin session) ---
const ctx = await b.newContext({ viewport:{width:430,height:900}, deviceScaleFactor:2 });
const player = await ctx.newPage();
await player.goto(`http://localhost:3000/t/${SLUG}/enter`, { waitUntil:'networkidle' });
log('enter page:', (await player.textContent('h1'))?.trim());

const opts = await player.$$eval('select[name=eventId] option', os => os.map(o=>o.textContent?.trim()));
log('draws offered:', opts.filter(Boolean).slice(1).join(', '));

await player.selectOption('select[name=eventId]', { index: 1 });
await player.fill('input[name=fullName]', 'Valentina Rojas');
await player.fill('input[name=email]', 'valentina.rojas@example.test');
await player.fill('input[name=phone]', '555-0199');
await player.fill('input[name=club]', 'Open Tennis');
await player.waitForTimeout(2200); // beat the min time-to-submit guard
await player.click('button[type=submit]');
await player.waitForTimeout(2500);
log('confirmation:', (await player.textContent('[role=status]'))?.trim().replace(/\s+/g,' '));
await player.screenshot({ path: `${process.env.SP}/reg-done.png`, fullPage:true });

// Duplicate email must be refused.
await player.goto(`http://localhost:3000/t/${SLUG}/enter`, { waitUntil:'networkidle' });
await player.selectOption('select[name=eventId]', { index: 1 });
await player.fill('input[name=fullName]', 'Valentina Rojas');
await player.fill('input[name=email]', 'valentina.rojas@example.test');
await player.fill('input[name=phone]', '555-0199');
await player.waitForTimeout(2200);
await player.click('button[type=submit]');
await player.waitForTimeout(2000);
log('duplicate:', (await player.textContent('[role=alert]'))?.trim());

// --- Admin: see them, tick paid ---
await admin.reload({ waitUntil:'networkidle' });
await admin.click('button:has-text("Entrants")');
await admin.waitForTimeout(1200);
log('shows up:', (await admin.content()).includes('Valentina Rojas'));
log('unpaid shown:', /\d+ unpaid/.test(await admin.content()));
await admin.click('button[aria-label^="Mark Valentina"]');
await admin.waitForTimeout(1800);
await admin.click('button:has-text("Entrants")');
await admin.waitForTimeout(900);
log('after tick, unpaid text present:', /1 unpaid/.test(await admin.content()));
await admin.screenshot({ path: `${process.env.SP}/adm-paid.png`, fullPage:true });
await b.close();
