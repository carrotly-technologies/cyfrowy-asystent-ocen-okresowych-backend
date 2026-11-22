# Scenariusz pokazu (demo ≤ 2 min)

Cel: w 2 minuty jurorzy widzą cały proces oceny okresowej (rozp. PRM z 4.04.2016) od wyboru arkusza do sprzeciwu,
powiadomienia o terminach, wirtualnego HR partnera i puls zespołu, kartotekę kadr (nieobecności, import z CSV)
i monitoring w całym urzędzie.

## Nagranie

- **Nagranie (1:58, MP4 1920×1080, napisy na ekranie, bez dźwięku, 16 MB):**
  [demo.mp4](https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend/releases/download/demo-v2/demo.mp4)
  (release [`demo-v2`](https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend/releases/tag/demo-v2),
  wygląd gov.pl). Poprzednie nagranie sprzed przebudowy wyglądu zostaje w release
  [`demo-v1`](https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend/releases/tag/demo-v1).
- Nagrane automatycznie skryptem [`record-demo.mjs`](record-demo.mjs) (Playwright) na `main` obu repozytoriów
  z 22.11.2026, na lokalnej instancji z danymi demo (`DEMO_TODAY=2026-11-21`, bez LLM: asystent w trybie
  ekstraktywnym). Kroki i napisy w nagraniu odpowiadają scenom poniżej.
- Nowe nagranie po zmianach w aplikacji: patrz [Nagrywanie od nowa](#nagrywanie-od-nowa).

## Przygotowanie

1. Frontend i backend z `main`, uruchomione lokalnie (pokaz na żywo) albo na środowisku demo.
2. Świeże dane demo: `POST /api/demo/reset` (dowolne zalogowane konto), żeby każdy etap był w stanie z seeda.
   „Dziś” w aplikacji to `DEMO_TODAY` (domyślnie `2026-11-21`); wszystkie terminy są liczone od tej daty. Na
   wspólnym środowisku demo reset cofa zmiany innych osób, więc przy pokazie na żywo lepiej użyć instancji lokalnej.
3. Asystent AI włączony (`FEATURE_ASSISTANT=true`). Z LLM (`LLM_BASE_URL`, `LLM_MODEL`) odpowiedź jest generowana,
   bez niego ekstraktywna z cytatami; oba tryby nadają się do pokazu, bo zawsze widać źródło.
4. Start na `/logowanie`. Zmiana persony: menu użytkownika → Wyloguj, potem karta konta demo.

## Konta demo

Wszystkie osoby są fikcyjne. Hasło każdego konta: `Ocena2026!`. Na `/logowanie` pod formularzem jest karta każdego
konta (logowanie jednym kliknięciem). Pełna lista kont: `README.md`, sekcja „Demo accounts”.

| Persona w pokazie       | Login          | Rola         | Co pokazujemy                                                      |
| ----------------------- | -------------- | ------------ | ------------------------------------------------------------------ |
| Oceniająca (przełożona) | `j.kaminska`   | `SUPERVISOR` | Joanna Kamińska: zespół, teczki c-004, c-001, c-007, dobrostan     |
| Oceniany                | `p.wojcik`     | `EMPLOYEE`   | Piotr Wójcik: potwierdza część I (c-002)                           |
| Kadry (HR)              | `a.lis`        | `HR`         | Agnieszka Lis: monitoring wszystkich ocen, liczniki, przypomnienia |
| Dyrektor generalny      | `b.wisniewska` | `DIRECTOR`   | Barbara Wiśniewska: sprzeciw Tadeusza Jankowskiego (c-301)         |

## Scenariusz (1:58)

Czasy odpowiadają nagraniu. Tekst w cudzysłowie to napis na ekranie (przy pokazie na żywo: tekst lektora).

### 1. Otwarcie (0:00–0:07)

- Ekran: `/logowanie` z kartami kont demo.
- „Cyfrowy Asystent Ocen Okresowych: cała ocena okresowa służby cywilnej (rozp. PRM z 4.04.2016): przełożony,
  oceniany, kadry i dyrektor generalny.”

### 2. Przełożona: zespół, powiadomienia i arkusz (0:07–0:24)

- Karta **Joanna Kamińska** → `/zespol`: każda osoba na jednym z 7 etapów, najbliższy termin liczony z przepisów.
- Dzwonek „Powiadomienia”: zbliżające się terminy, wniosek o zmianę terminu, przedłużenie terminu o nieobecność.
  „Zbliżające się terminy, wnioski i przedłużenia terminów; harmonogram przypomina sam.”
- Teczka **Julii Mazur (c-004)**, krok 1 „Arkusz i kryteria”: „Propozycja systemu: arkusz C” z podstawą (§3 ust. 4
  rozp.); kryteria obowiązkowe i do 3 dodatkowych.
- „System proponuje arkusz z podstawą prawną, decyzję podejmuje przełożony.”

### 3. Obserwacje, formularz oceny i asystent (0:24–0:47)

- Teczka **Anny Nowak (c-001)**, krok 4: „Dziennik obserwacji” (S-D-R) i „Pokrycie kryteriów dowodami”.
- Krok 5 „Rozmowa oceniająca i ocena”: część II, oceny cząstkowe w skali arkusza, uzasadnienie, IPRZ.
- Przycisk „Asystent” → podpowiedziane pytanie „Co jeśli średnia wynosi dokładnie 4,00?” → odpowiedź z cytatami
  (Q&A, § 11 rozporządzenia, poradnik KPRM).
- „Asystent odpowiada z bazy wiedzy (rozporządzenie, poradniki KPRM) i zawsze podaje źródło.”

### 4. Kontrola formalna i podpis (0:47–0:58)

- Teczka **Moniki Zielińskiej (c-007)**, krok 6 „Podpis i przekazanie”: „Kontrola formalna” z podstawą prawną
  każdego punktu.
- „Podpisz ocenę” → okno z wynikiem (negatywna, średnia 3,33) → „Podpisz ocenę”. Pola są zablokowane, następny krok
  to „Przekaż ocenianemu do zapoznania”.

### 5. Wirtualny HR partner (0:58–1:08)

- `/dobrostan`: sygnały w zespole (ryzyko wypalenia, przeciążenie, spadek motywacji, do docenienia), puls zespołu
  z okresów 2-tygodniowych i lista pracowników.
- „Podpowiedzi HR partnera są wyłącznie pomocą, nie są częścią oceny okresowej.”

### 6. Oceniany: potwierdzenie części I i puls (1:08–1:24)

- Wyloguj → karta **Piotr Wójcik** → `/moje-oceny/c-002`: „Wymaga Twojego działania: potwierdź rozmowę
  rozpoczynającą” z kryteriami i terminem oceny.
- „Potwierdzam” → ocena przechodzi do kroku 4 „Okres obserwacji”.
- „Oceniany widzi swoje kryteria i terminy; potwierdzenia składa tylko on.”
- `/moj-puls`: „Kto zobaczy Twoje odpowiedzi?” „Pracownik widzi, kto i co zobaczy; przełożony tylko ogólny wskaźnik,
  kadry nic.”

### 7. Kadry: monitoring, nieobecności i import (1:24–1:43)

- Wyloguj → karta **Agnieszka Lis** → `/hr` „Monitoring ocen”: liczniki (w toku, termin ≤ 14 dni, po terminie,
  oczekuje na zapoznanie, w okresie sprzeciwu), filtry, ostrzeżenie o obowiązkowym kolejnym stopniu służbowym.
- „Wyślij przypomnienie” przy ocenie po terminie (powiadomienie w aplikacji; e-mail, gdy ustawiono `SMTP_HOST`).
- `/kartoteka/p-lewandowski`: nieobecność ciągła 33 dni przedłuża termin oceny (art. 81 ust. 7).
- `/kartoteka` → „Importuj pracowników (CSV)” z plikiem wzoru: podgląd (25 do dodania, sugerowany arkusz), bez zapisu.

### 8. Dyrektor generalny: sprzeciw (1:43–1:52)

- Wyloguj → karta **Barbara Wiśniewska** → `/sprzeciwy/c-301`: treść sprzeciwu, termin rozpatrzenia (14 dni,
  art. 83 ust. 3), arkusz oceny i trzy rozstrzygnięcia (oddalenie, zmiana oceny, ocena do ponownego sporządzenia).
  Adresat sprzeciwu wynika z arkusza (art. 83 ust. 1–2): B i C dyrektor generalny, A osoba, która dokonała oceny.

### 9. Zamknięcie (1:52–1:58)

- „Open source (EUPL-1.2), `docker compose up`, działa bez internetu i bez LLM. Reguły z przepisów w jednym miejscu. AI tylko
  doradza, ocenę ustala przełożony.”

## Nagrywanie od nowa

Skrypt wykonuje sceny 1–9 i dorysowuje napisy. Zmienia dane (podpis c-007, potwierdzenie c-002, przypomnienie), a na
starcie robi `POST /api/demo/reset`, więc uruchamiaj go na lokalnej instancji, nie na wspólnym środowisku demo.
Import CSV w scenie 7 kończy się na podglądzie (`dryRun`), niczego nie zapisuje; plik wzoru skrypt pobiera z API.

```bash
# backend (pamięć w RAM) i frontend z main
PORT=3000 npm run start                      # w repo backendu
npm run dev                                  # w repo frontendu, http://localhost:5173

# w osobnym katalogu z Playwright
npm i playwright@1.49.1 && npx playwright install chromium
BASE=http://localhost:5173 API=http://localhost:3000 node record-demo.mjs   # zapisuje WebM w ./video

ffmpeg -i video/<plik>.webm -vf "scale=1920:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -crf 22 -r 30 -movflags +faststart -an demo.mp4
# nowy release (poprzednie zostają), potem podmień linki w tym pliku i w docs/zgloszenie/hacktribe.md
gh release create demo-v3 demo.mp4 --target main -R carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend
```

## Plan awaryjny (pokaz na żywo)

- Coś poszło nie tak: `POST /api/demo/reset` (albo „Reset danych” w menu bocznym) i scena od nowa.
- Asystent nie odpowiada (np. brak LLM): tryb ekstraktywny działa bez konfiguracji, podpowiedziane pytania mają
  odpowiedź z cytatem.
- Za mało czasu: odtwórz nagranie zamiast pokazu na żywo.
