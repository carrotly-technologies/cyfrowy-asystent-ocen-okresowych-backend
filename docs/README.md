# Dokumenty źródłowe – Cyfrowy Asystent Ocen Okresowych

Dokumenty prawne i poradniki, na których opiera się aplikacja (HackNation 2026, wyzwanie KPRM).
Porównanie tych wymagań z implementacją, wraz z listą braków: [`audyt-zgodnosci.md`](audyt-zgodnosci.md).
Oryginały leżą w podkatalogach tematycznych, a `tekst/` ma ich wersje tekstowe w tej samej strukturze,
do czytania przez agentów i jako baza wiedzy asystenta AI.

## Kryteria oceny

| Plik | Co to jest |
|---|---|
| `model-kompetencji/model-kompetencji.xlsx` | Materiał pomocniczy z wcześniejszego wyzwania (wskaźniki behawioralne); tylko w bazie wiedzy asystenta, aplikacja z niego nie korzysta |
| `model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf` | Załącznik nr 1 do rozporządzenia z 2016 r.: wykaz 14 kryteriów oceny z opisami (dane: `src/criteria/data/criteria.data.ts`) |

## Ocena okresowa (co 24 miesiące)

| Plik | Co to jest |
|---|---|
| `ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf` | Rozporządzenie PRM z 4.04.2016 (Dz.U. 2016 poz. 470): kryteria, arkusze A/B/C, skala 1–9, terminy |
| `ocena-okresowa/poradnik-oceny-okresowe.pdf` | Poradnik KPRM do oceny okresowej |
| `ocena-okresowa/arkusz-oceny-b.docx` | Wzór arkusza B: stanowiska kierujące pracownikami |
| `ocena-okresowa/arkusz-oceny-c.docx` | Wzór arkusza C: pozostałe stanowiska |

## Pierwsza ocena (poza zakresem aplikacji, tylko kontekst dla asystenta)

| Plik | Co to jest |
|---|---|
| `pierwsza-ocena/rozporzadzenie-pierwsza-ocena-2015.pdf` | Rozporządzenie PRM z 23.07.2015 (Dz.U. 2015 poz. 1144): 5 elementów oceny, skala 3/5/7, sprawozdanie, terminy |
| `pierwsza-ocena/poradnik-pierwsza-ocena-2016.pdf` | Poradnik KPRM do pierwszej oceny |
| `pierwsza-ocena/arkusz-pierwszej-oceny.docx` | Wzór arkusza pierwszej oceny |

## Wersje tekstowe (`tekst/`)

Wygenerowane z oryginałów (pypdf, python-docx, openpyxl):

- PDF: tekst strona po stronie, z nagłówkami `--- page N ---` (przydatne do cytowania źródła).
- DOCX: akapity i tabele (komórki rozdzielone `|`, linie w komórce `/`). **Pola wyboru zapisane jako `[x]` / `[ ]`**, więc w OSP widać np. zaznaczoną liczbę podległych pracowników.
- XLSX: każdy arkusz jako `### SHEET: …`, wiersze rozdzielone `|`.

Po zmianie oryginałów wersje tekstowe trzeba wygenerować ponownie.

## Baza wiedzy asystenta

`npm run kb:build` czyta wyłącznie z tego katalogu. Oryginały są dostępne w aplikacji pod
`GET /api/docs/<ścieżka>`, a lista dokumentów (z informacją, czy asystent z nich odpowiada) pod
`GET /api/assistant/documents`. Do odpowiedzi indeksowane są: oba rozporządzenia, oba poradniki, arkusze B, C
i pierwszej oceny (z wersji tekstowych) oraz model kompetencji (z wersji tekstowej `model-kompetencji.xlsx`).
Wykaz kryteriów jest tylko na liście dokumentów (jego treść jest w bazie jako załącznik rozporządzenia).

## Czego tu brakuje

Trzy dokumenty bazy wiedzy nie są jeszcze w repo. Ich fragmenty są w `src/assistant/data/knowledge.data.ts`
(wygenerowane wcześniej z plików autora asystenta) i `kb:build` je zachowuje, dopóki pliku brak. Po dodaniu pliku
pod wskazaną ścieżką `kb:build` przetworzy go od nowa:

| Dokument | Oczekiwana ścieżka | Do tego czasu |
|---|---|---|
| Ustawa o służbie cywilnej (`U`), tekst jednolity | `akty-prawne/ustawa-o-sluzbie-cywilnej.pdf` | link do oficjalnego tekstu w [ISAP](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20082271505) |
| Zasady obliczania terminów (`LT`) | `materialy-dodatkowe/zasady-obliczania-terminow.docx` | bez linku, „brak pliku źródłowego” |
| Zestaw pytań i odpowiedzi (`QA`) | `materialy-dodatkowe/pytania-i-odpowiedzi.md` | bez linku, „brak pliku źródłowego” |

Opis zadania wymienia też materiały ze strony KPRM poza dwoma poradnikami; nie było ich w paczce.
