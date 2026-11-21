# Dokumenty źródłowe – Cyfrowy Asystent Ocen Okresowych

Dokumenty prawne i poradniki, na których opiera się aplikacja (HackNation 2026, wyzwanie KPRM).
Porównanie tych wymagań z implementacją, wraz z listą braków: [`audyt-zgodnosci.md`](audyt-zgodnosci.md).
Oryginały leżą w podkatalogach tematycznych, a `tekst/` ma ich wersje tekstowe w tej samej strukturze,
do czytania przez agentów i jako baza wiedzy asystenta AI.
Materiały zgłoszeniowe dla jury (prezentacja PDF, opis projektu, zrzuty ekranu) są w [`prezentacja/`](prezentacja/opis.md);
nie należą do bazy wiedzy asystenta.

## Kryteria oceny

| Plik | Co to jest |
|---|---|
| `model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf` | Załącznik nr 1 do rozporządzenia z 2016 r.: wykaz 14 kryteriów oceny z opisami (dane: `src/criteria/data/criteria.data.ts`) |

## Akty prawne i standardy

| Plik | Co to jest |
|---|---|
| `akty-prawne/ustawa-o-sluzbie-cywilnej.pdf` | Ustawa z 21.11.2008 o służbie cywilnej, tekst jednolity Dz.U. z 2026 r. poz. 590 (Kancelaria Sejmu) |
| `akty-prawne/ustawa-o-sluzbie-cywilnej-wyciag.docx` | Wyciąg przepisów ustawy dotyczących ocen okresowych (w bazie wiedzy z pełnego tekstu) |
| `akty-prawne/standardy-zzl-w-sluzbie-cywilnej.pdf` | Standardy zarządzania zasobami ludzkimi w służbie cywilnej (zarządzenie nr 6 Szefa SC z 2020 r.); skan bez warstwy tekstowej, wersja tekstowa z OCR (tesseract, język polski) |

## Ocena okresowa (co 24 miesiące)

| Plik | Co to jest |
|---|---|
| `ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf` | Rozporządzenie PRM z 4.04.2016 (Dz.U. 2016 poz. 470): kryteria, arkusze A/B/C, skala 1–9, terminy |
| `ocena-okresowa/poradnik-oceny-okresowe.pdf` | Poradnik KPRM do oceny okresowej |
| `ocena-okresowa/arkusz-oceny-b.docx` | Wzór arkusza B: stanowiska kierujące pracownikami |
| `ocena-okresowa/arkusz-oceny-c.docx` | Wzór arkusza C: pozostałe stanowiska |

## Przypadki użycia i materiały dodatkowe (z paczki wyzwania)

| Plik | Co to jest |
|---|---|
| `przypadki-uzycia/przypadki-uzycia-opis.docx` | Przypadki użycia procesu oceny okresowej |
| `przypadki-uzycia/przypadki-uzycia-warunki-brzegowe.docx` | Warunki brzegowe wybranych przypadków użycia |
| `materialy-dodatkowe/zasady-obliczania-terminow.docx` | Zasady obliczania terminów stosowane przy dokonywaniu ocen |

## Wersje tekstowe (`tekst/`)

Wygenerowane z oryginałów (pypdf / pdftotext, python-docx, openpyxl; Standardy ZZL przez OCR):

- PDF: tekst strona po stronie, z nagłówkami `--- page N ---` (przydatne do cytowania źródła).
- DOCX: akapity i tabele (komórki rozdzielone `|`, linie w komórce `/`). **Pola wyboru zapisane jako `[x]` / `[ ]`**, więc w OSP widać np. zaznaczoną liczbę podległych pracowników.

Po zmianie oryginałów wersje tekstowe trzeba wygenerować ponownie.

## Baza wiedzy asystenta

`npm run kb:build` czyta wyłącznie z tego katalogu. Oryginały są dostępne w aplikacji pod
`GET /api/docs/<ścieżka>`, a lista dokumentów (z informacją, czy asystent z nich odpowiada) pod
`GET /api/assistant/documents`. Do odpowiedzi indeksowane są: ustawa (pełny tekst), rozporządzenie z 2016 r., poradnik KPRM, arkusze B i C
(z wersji tekstowych), Standardy ZZL (z wersji tekstowej po OCR), zasady obliczania terminów, przypadki użycia
(opis i warunki brzegowe razem) oraz zestaw Q&A. Wykaz kryteriów i wyciąg z ustawy są tylko na liście dokumentów
(ich treść jest w bazie jako załącznik rozporządzenia i pełny tekst ustawy). Materiały pierwszej oceny i model
kompetencji (z innego wyzwania) zostały usunięte: aplikacja obsługuje wyłącznie ocenę okresową.

## Czego tu brakuje

Zestaw pytań i odpowiedzi (`QA`) nie jest jeszcze w repo. Jego fragmenty są w `src/assistant/data/knowledge.data.ts`
(bez pytań o pierwszą ocenę) i `kb:build` je zachowuje, dopóki brak pliku `materialy-dodatkowe/pytania-i-odpowiedzi.md`.

Opis zadania wymienia też materiały ze strony KPRM poza dwoma poradnikami; nie było ich w paczce.

## Pokaz dla jury

Scenariusz pokazu (≤ 2 min), konta demo i link do nagrania: [`demo/scenariusz.md`](demo/scenariusz.md).
