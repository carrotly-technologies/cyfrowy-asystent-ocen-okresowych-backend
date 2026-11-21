# Scenariusz pokazu (demo ≤ 2 min)

Cel: w 2 minuty jurorzy widzą cały proces oceny okresowej (rozp. PRM z 4.04.2016) od wyboru arkusza do zapoznania
się z oceną oraz moduł kadr (HR) do monitorowania ocen w całym urzędzie.

## Nagranie

- Link do nagrania: **do uzupełnienia** (nagranie po zamrożeniu funkcji, rano 22.11, na finalnej wersji aplikacji).
- Długość: maks. 2:00. Rozdzielczość 1920×1080, przeglądarka w trybie pełnoekranowym, powiększenie 110–125%.
- Lektor po polsku albo napisy; bez muzyki, która zagłusza głos.

## Przygotowanie (przed nagraniem)

1. Finalna wersja frontendu i backendu (main) uruchomiona lokalnie albo na środowisku demo.
2. Świeże dane demo: `POST /api/demo/reset` (dowolne zalogowane konto), żeby każdy etap był w stanie z seeda.
   „Dziś” w aplikacji to `DEMO_TODAY` (domyślnie `2026-11-21`); wszystkie terminy są liczone od tej daty.
3. Asystent AI włączony (`FEATURE_ASSISTANT=true`). Z LLM (`LLM_BASE_URL`, `LLM_MODEL`) odpowiedź jest generowana,
   bez niego ekstraktywna z cytatami; oba tryby nadają się do pokazu, bo zawsze widać źródło.
4. Otwarte karty: `/logowanie`. Wylogowanie między personami: menu użytkownika → Wyloguj.
5. Próba generalna ze stoperem: każda scena ma limit czasu poniżej.

## Konta demo

Wszystkie osoby są fikcyjne. Hasło każdego konta: `Ocena2026!`. Na `/logowanie` pod formularzem jest karta każdego
konta (logowanie jednym kliknięciem).

| Persona w pokazie       | Login        | Rola         | Co pokazujemy                                                       |
| ----------------------- | ------------ | ------------ | ------------------------------------------------------------------- |
| Oceniająca (przełożona) | `j.kaminska` | `SUPERVISOR` | Joanna Kamińska, naczelnik: lista zadań, teczki c-001, c-004, c-007 |
| Oceniany                | `p.wojcik`   | `EMPLOYEE`   | Piotr Wójcik: potwierdza część I (c-002)                            |
| Oceniana (opcjonalnie)  | `a.nowak`    | `EMPLOYEE`   | Anna Nowak: „Moje oceny”, poprzednia (c-000) i bieżąca (c-001)      |
| Kadry (HR)              | `a.lis`      | `HR`         | Agnieszka Lis: monitoring wszystkich 14 ocen, filtry, przypomnienia |
| Dyrektor generalny      | `a.lis`      | `HR`         | Widok urzędu w module HR (patrz niżej)                              |

Dyrektor generalny nie ma osobnego konta w seedzie. W pokazie jego perspektywę przedstawia moduł HR: liczniki
i lista ocen całego urzędu (po terminie, termin ≤ 14 dni, w okresie sprzeciwu) to raport, który kadry przygotowują
dla dyrektora generalnego, odpowiedzialnego za przeprowadzenie ocen w urzędzie. Lektor mówi to wprost w scenie 5.

## Scenariusz (2:00)

### 1. Otwarcie (0:00–0:10)

- Ekran: `/logowanie` z kartami kont demo.
- Lektor: „Cyfrowy Asystent Ocen Okresowych prowadzi przełożonego, ocenianego i kadry przez całą ocenę okresową
  według rozporządzenia z 2016 r. Działa bez płatnych usług i bez internetu.”
- Akcja: klik w kartę **Joanna Kamińska**.

### 2. Oceniająca: zespół i wybór arkusza (0:10–0:30)

- Ekran: `/zespol`. Pokaż listę zadań posortowaną według terminów (najbliższe na górze) i tabelę zespołu.
- Akcja: otwórz teczkę **Julii Mazur (c-004)**, etap „Arkusz i kryteria”. Pokaż sugestię arkusza C z uzasadnieniem
  (§3 rozp.: stanowisko bez kierowania ludźmi) i wybór do 3 kryteriów dodatkowych z opisami z katalogu.
- Lektor: „System podpowiada arkusz i liczy terminy z przepisów, ale decyzja zawsze należy do przełożonej.”

### 3. Oceniająca: obserwacje, ocena i asystent (0:30–1:00)

- Akcja: wróć do zespołu, otwórz teczkę **Anny Nowak (c-001)**, „Dziennik obserwacji”: wpisy S-D-R
  (sytuacja, działanie, rezultat) zebrane w ciągu roku przy kryteriach.
- Akcja: etap „Ocena” → „Formularz oceny kompetencji”: zaznacz ocenę jednego kryterium, pokaż wynik liczony na
  bieżąco (średnia, poziom, wynik pozytywny/negatywny z podstawą prawną §11).
- Akcja: w panelu asystenta zadaj pytanie z podpowiedzi, np. „Kiedy ocena jest negatywna?”. Pokaż odpowiedź
  z linkiem do źródła (rozporządzenie, strona PDF).
- Lektor: „Asystent odpowiada tylko na podstawie przepisów i poradników KPRM i zawsze wskazuje źródło; gdy nie wie,
  mówi to wprost.”

### 4. Oceniająca: podpis i przekazanie (1:00–1:15)

- Akcja: otwórz teczkę **Moniki Zielińskiej (c-007)**, etap „Podpis”: kontrola formalna (lista punktów do
  sprawdzenia), „Podpisz ocenę”, „Przekaż ocenianemu do zapoznania”.
- Opcjonalnie: „Arkusz” → podgląd urzędowego arkusza C (części I–III), gotowego do druku jako PDF.
- Akcja: wyloguj.

### 5. Oceniany: potwierdzenie części I (1:15–1:30)

- Akcja: zaloguj **Piotr Wójcik**. Ekran: „Moje oceny” → ocena c-002 czeka na jego potwierdzenie części I.
- Akcja: potwierdź zapoznanie się z częścią I. Pokaż, że oceniany widzi tylko własne oceny i tylko do odczytu.
- Lektor: „Oceniany widzi swoje kryteria i oczekiwania od pierwszego dnia, a potwierdzenia może złożyć tylko on.”
- Akcja: wyloguj.

### 6. Kadry i dyrektor generalny: monitoring urzędu (1:30–1:50)

- Akcja: zaloguj **Agnieszka Lis**. Ekran: `/hr` „Monitoring ocen”.
- Pokaż liczniki (po terminie, termin ≤ 14 dni, oczekuje na zapoznanie, w okresie sprzeciwu), filtr według
  arkusza A/B/C, komórki i stanu, wyszukiwanie pracownika lub oceniającego.
- Akcja: zaznacz oceny po terminie → „Wyślij przypomnienie” (symulacja; docelowo e-mail lub zadanie w EZD).
- Lektor: „Kadry i dyrektor generalny widzą stan ocen w całym urzędzie i jednym kliknięciem przypominają
  oceniającym o terminach.”

### 7. Zamknięcie (1:50–2:00)

- Ekran: `/zespol` albo strona startowa.
- Lektor: „Open source, jeden obraz Docker, działa bez internetu i bez LLM, a reguły z przepisów są w jednym miejscu,
  więc zmiana rozporządzenia to edycja jednego pliku. AI tylko doradza, ocenę ustala przełożony.”

## Plan awaryjny

- Coś poszło nie tak w trakcie nagrania: `POST /api/demo/reset` i nagranie sceny od nowa (sceny montujemy osobno).
- Asystent nie odpowiada (np. brak LLM): tryb ekstraktywny działa bez konfiguracji, pytanie z podpowiedzi zawsze
  ma odpowiedź z cytatem.
- Za długo: najpierw wypada opcjonalny podgląd arkusza w scenie 4, potem skraca się scena 3 do jednego kryterium.
