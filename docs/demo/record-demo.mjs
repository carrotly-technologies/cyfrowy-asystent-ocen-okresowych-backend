// Records the ≤ 2 min demo of docs/demo/scenariusz.md (scenes 1–9) with on-screen captions.
// Run against a LOCAL instance only: it resets the demo data and signs/confirms cases.
// Usage: see "Nagrywanie od nowa" in scenariusz.md (needs `playwright` installed next to this file).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3000';
const W = 1600,
  H = 900;
const t0 = Date.now();
const log = (m) =>
  console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), m);
// fresh demo data (local, in-memory backend)
const tok = (
  await (
    await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'admin', password: 'Ocena2026!' }),
    })
  ).json()
).accessToken;
await fetch(API + '/api/demo/reset', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + tok },
});

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: 'video', size: { width: W, height: H } },
  locale: 'pl-PL',
});
const p = await ctx.newPage();
const wait = (ms) => p.waitForTimeout(ms);
async function cap(title, text = '') {
  await p.evaluate(
    ([title, text]) => {
      let d = document.getElementById('__cap');
      if (!d) {
        d = document.createElement('div');
        d.id = '__cap';
        document.body.appendChild(d);
        Object.assign(d.style, {
          position: 'fixed',
          left: '50%',
          bottom: '28px',
          transform: 'translateX(-50%)',
          zIndex: 2147483647,
          maxWidth: '1100px',
          background: 'rgba(16,24,40,.92)',
          color: '#fff',
          padding: '14px 24px',
          borderRadius: '10px',
          font: '500 22px/1.35 system-ui, sans-serif',
          boxShadow: '0 8px 30px rgba(0,0,0,.35)',
          textAlign: 'center',
          pointerEvents: 'none',
        });
      }
      d.innerHTML =
        `<div style="font-weight:700">${title}</div>` +
        (text
          ? `<div style="font-weight:400;font-size:18px;opacity:.9;margin-top:4px">${text}</div>`
          : '');
    },
    [title, text],
  );
}
async function go(path) {
  await p.goto(BASE + path);
  await p.waitForLoadState('networkidle');
}
async function scroll(dy, steps = 12) {
  await p.mouse.move(500, 500);
  for (let i = 0; i < steps; i++) {
    await p.mouse.wheel(0, dy / steps);
    await wait(40);
  }
}
async function login(name) {
  await p.evaluate(() => sessionStorage.clear());
  await go('/logowanie');
  await p.getByRole('button', { name: new RegExp(name) }).click();
  await p.waitForLoadState('networkidle');
  await wait(300);
}

// 1. Opening
await go('/logowanie');
await cap(
  'Cyfrowy Asystent Ocen Okresowych',
  'Cała ocena okresowa służby cywilnej (rozp. PRM z 4.04.2016) — przełożony, oceniany, kadry i dyrektor generalny',
);
log('1 open');
await wait(6000);

// 2. Supervisor: team + sheet suggestion
await login('Joanna Kamińska');
await cap(
  'Przełożona: mój zespół',
  'Każda ocena na jednym z 7 etapów, terminy liczone z przepisów',
);
log('2 team');
await wait(6000);
await go('/teczka/c-004/arkusz-i-kryteria');
await cap(
  'Krok 1: arkusz i kryteria',
  'System proponuje arkusz z podstawą prawną (§3 rozp.) — decyzję podejmuje przełożony',
);
log('2 sheet');
await wait(3500);
await scroll(450);
await wait(3500);

// 3. Observations, assessment, assistant
await go('/teczka/c-001/obserwacje');
await cap(
  'Krok 4: dziennik obserwacji',
  'Obserwacje S-D-R przez cały okres i pokrycie kryteriów dowodami',
);
log('3 obs');
await wait(2500);
await scroll(500);
await wait(3500);
await go('/teczka/c-001/ocena');
await cap(
  'Krok 5: formularz oceny',
  'Oceny cząstkowe, uzasadnienie i IPRZ; wynik liczony z §11 rozporządzenia',
);
log('3 form');
await scroll(1100, 20);
await wait(4500);
await p.getByRole('button', { name: 'Asystent', exact: true }).click();
await wait(800);
await cap(
  'Asystent AI oparty na przepisach',
  'Odpowiada z bazy wiedzy (rozporządzenie, poradniki KPRM) i zawsze podaje źródło',
);
await p
  .getByRole('button', { name: /Co jeśli średnia wynosi dokładnie 4,00/ })
  .click();
log('3 assistant');
await wait(2500);
await p.evaluate(() => {
  const el = [...document.querySelectorAll('p,div')].find(
    (e) =>
      e.childElementCount < 3 &&
      /^Negatywna\./.test((e.innerText || '').trim()),
  );
  if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
});
await wait(5500);

// 4. Signature
await go('/teczka/c-007/podpis');
await cap(
  'Krok 6: kontrola formalna i podpis',
  'Kompletność arkusza sprawdzana przed podpisem, z odwołaniem do przepisów',
);
log('4 sign');
await wait(3500);
await p.getByRole('button', { name: 'Podpisz ocenę' }).click();
await wait(2500);
await p
  .getByRole('dialog')
  .getByRole('button', { name: 'Podpisz ocenę' })
  .click();
await p.waitForLoadState('networkidle');
await wait(1000);
await cap(
  'Ocena podpisana',
  'Pola zablokowane, ocenę przekazuje się ocenianemu do zapoznania',
);
await wait(3500);

// 5. HR partner (wellbeing)
await go('/dobrostan');
await cap(
  'Wirtualny HR partner',
  'Sygnały przeciążenia, spadku motywacji i ryzyka wypalenia — tylko podpowiedzi, nie część oceny',
);
log('5 hr partner');
await wait(4000);
await scroll(450);
await wait(3500);

// 6. Employee confirms part I
await login('Piotr Wójcik');
await go('/moje-oceny/c-002');
await cap(
  'Oceniany: moje oceny',
  'Widzi swoje kryteria i terminy; potwierdzenia składa tylko on',
);
log('6 employee');
await wait(4000);
await p.getByRole('button', { name: 'Potwierdzam' }).scrollIntoViewIfNeeded();
await wait(1200);
await p.getByRole('button', { name: 'Potwierdzam' }).click();
await p.waitForLoadState('networkidle');
await wait(600);
await scroll(-2500, 15);
await cap('Część I potwierdzona', 'Ocena przechodzi do okresu obserwacji');
await wait(3500);

// 7. HR monitoring
await login('Agnieszka Lis');
await cap(
  'Kadry: monitoring ocen w całym urzędzie',
  'Terminy, oceny po terminie, okres sprzeciwu i przypomnienia dla oceniających',
);
log('7 hr');
await wait(5000);
await p.getByRole('button', { name: 'Wyślij przypomnienie' }).first().click();
await wait(1500);
await scroll(400);
await wait(2500);

// 8. Director general: objection
await login('Barbara Wiśniewska');
await go('/sprzeciwy/c-301');
await cap(
  'Dyrektor generalny: sprzeciw od oceny',
  'Treść sprzeciwu, arkusz i termin 14 dni (art. 83 ust. 3) w jednym miejscu',
);
log('8 dg');
await wait(5000);
await scroll(350);
await wait(3500);

// 9. Close
await cap(
  'Open source · jeden obraz Docker · działa bez internetu i bez LLM',
  'Reguły z przepisów w jednym miejscu · AI tylko doradza, ocenę ustala przełożony',
);
log('9 close');
await wait(6500);

const v = p.video();
await ctx.close();
await b.close();
console.log('VIDEO', await v.path());
log('end');
