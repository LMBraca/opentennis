import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:430,height:900}, deviceScaleFactor:2 });
// Set the locale cookie directly — the toggle is a form, not a named button.
await ctx.addCookies([{ name:'ot_locale', value:'es', url:'http://localhost:3000' }]);
const p = await ctx.newPage();

await p.goto('http://localhost:3000/t/open-tennis-invierno-26/enter', { waitUntil:'networkidle' });
console.log('ES title :', (await p.textContent('h1'))?.trim());
console.log('ES sub   :', (await p.textContent('p[class*="sub"]'))?.trim());
const labels = await p.$$eval('span[class*="label"]', es => es.map(e=>e.textContent?.trim()));
console.log('ES labels:', labels.join(' | '));
console.log('club gone:', !(await p.$('input[name=club]')));
console.log('button   :', (await p.textContent('button[type=submit]'))?.trim());
await p.screenshot({ path: `${process.env.SP}/es-enter.png`, fullPage:true });

// Submit in Spanish and confirm the message is NOT mixed-language.
const draws = await p.$$eval('select[name=eventId] option', os=>os.length);
if (draws > 1) {
  await p.selectOption('select[name=eventId]', { index: 1 });
  await p.fill('input[name=fullName]','Lucía Fernández');
  await p.fill('input[name=email]','lucia.fernandez@example.test');
  await p.fill('input[name=phone]','555-0123');
  await p.waitForTimeout(2300);
  await p.getByRole('button', { name: 'Inscribirme' }).click();
  await p.waitForTimeout(3000);
  console.log('ES confirm:', (await p.textContent('[role=status]'))?.trim().replace(/\s+/g,' '));
} else {
  console.log('(no draws enabled on this tournament yet — skipped submit)');
}
await b.close();
