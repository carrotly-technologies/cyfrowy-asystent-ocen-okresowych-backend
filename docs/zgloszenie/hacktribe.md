# Zgłoszenie na HackTribe – pakiet do wklejenia

Gotowe teksty do formularza projektu na HackTribe (HackNation 2026, wyzwanie KPRM). Każda sekcja poniżej to jedno
pole formularza: skopiuj tekst spod nagłówka. Źródła: [`docs/prezentacja/opis.md`](../prezentacja/opis.md),
[`README.md`](../../README.md), [`docs/demo/scenariusz.md`](../demo/scenariusz.md). Termin: **22.11.2026, 11:00**
(linki sprawdzić ponownie przed 10:30, patrz [Lista kontrolna](#lista-kontrolna-przed-wysłaniem)).

---

## Tytuł

```text
Cyfrowy Asystent Ocen Okresowych
```

## Krótki opis (jedno zdanie)

```text
Aplikacja w przeglądarce, która prowadzi przełożonego, ocenianego, kadry i dyrektora generalnego przez całą ocenę okresową w służbie cywilnej – od doboru arkusza do sprzeciwu – z kontrolą formalną, terminami liczonymi z przepisów, asystentem AI odpowiadającym ze źródłem i wirtualnym HR partnerem; AI jest wyłącznie doradcze.
```

## Opis rozwiązania

```text
Cyfrowy Asystent Ocen Okresowych to aplikacja w przeglądarce, która prowadzi przełożonego, ocenianego, kadry i dyrektora generalnego przez całą ocenę okresową urzędnika i pracownika służby cywilnej, zgodnie z ustawą z 21 listopada 2008 r. o służbie cywilnej (art. 81–83, 89, 108) i rozporządzeniem Prezesa Rady Ministrów z 4 kwietnia 2016 r. (Dz.U. poz. 470).

Każda ocena to teczka, która przechodzi przez siedem etapów:
1. Arkusz i kryteria – system proponuje arkusz A, B albo C z podstawą prawną (§ 3), wstawia kryteria obowiązkowe z katalogu 14 kryteriów (załącznik nr 1), pozwala wybrać do 3 dodatkowych i liczy termin oceny (24 miesiące, 6 po ocenie negatywnej).
2. Rozmowa rozpoczynająca – oczekiwania do każdego kryterium trafiają do części I arkusza; termin 30 dni (§ 7).
3. Potwierdzenie ocenianego – oceniany potwierdza rozmowę i kryteria na własnym koncie (§ 6).
4. Okres obserwacji – dziennik obserwacji w modelu sytuacja–działanie–rezultat przy kryteriach, przez cały okres, z ostrzeżeniem, gdy kryterium ma za mało dowodów.
5. Rozmowa oceniająca i ocena – oceny cząstkowe 1–9, średnia, poziom i wynik według § 11, uzasadnienie, wnioski do IPRZ, wniosek o kolejny stopień służbowy (część III).
6. Podpis i przekazanie – kontrola formalna z paragrafem przy każdym punkcie blokuje podpis, dopóki arkusz ma braki; arkusz A/B/C pobiera się jako PDF zgodny ze wzorem.
7. Zapoznanie z oceną – potwierdzenie ocenianego otwiera 7-dniowy termin na sprzeciw (art. 83 ust. 1).

Po ocenie system obsługuje fikcję zapoznania, sprzeciw rozpatrywany przez dyrektora generalnego w 14 dni (oddalenie, zmiana oceny z zachowaniem poprzedniej wersji albo polecenie ponownej oceny) oraz zmianę terminu oceny na wniosek ocenianego (art. 81 ust. 8 pkt 4).

Kadry mają panel monitoringu wszystkich ocen w urzędzie (w toku, termin ≤ 14 dni, po terminie, do zapoznania, w okresie sprzeciwu) z przypomnieniami do przełożonych oraz kartotekę: pracownicy, podległość, zastępstwa oceniających, nieobecności dłuższe niż miesiąc wydłużające termin oceny (art. 81 ust. 7), import historii ocen i statystyki z CSV. Administrator poprawia zablokowane pola tylko w trybie korekty, z powodem i audytem.
```

## Identyfikacja problemu

```text
Ocena okresowa w służbie cywilnej to proces prawny z wieloma terminami i warunkami, a w praktyce prowadzi się go na papierowych lub edytowalnych wzorach arkuszy:
- Złożona procedura: siedem kroków, trzy wzory arkuszy, kryteria obowiązkowe zależne od stanowiska, skala 1–9 i reguła wyniku z § 11, terminy z ustawy i rozporządzenia (30 dni, 24 i 6 miesięcy, 7 i 14 dni) liczone według Kodeksu cywilnego. Przełożony nie jest kadrowcem ani prawnikiem.
- Błędy formalne wychodzą za późno: brak uzasadnienia oceny negatywnej, brak wniosków do IPRZ, niewłaściwe kryteria albo przekroczony termin wychodzą zwykle dopiero przy sprzeciwie lub kontroli.
- Ocena z ostatnich tygodni: bez zapisanych przykładów z całego okresu ocena opiera się na ogólnym wrażeniu, a rozmowa oceniająca jest trudna dla obu stron.
- Brak wiedzy pod ręką: odpowiedzi są rozproszone w ustawie, rozporządzeniu i poradnikach KPRM.
- Kadry nie widzą stanu ocen w urzędzie i ręcznie przypominają o terminach; dyrektor generalny nie ma przeglądu sprzeciwów i ich terminów.
- Oceniany nie zawsze zna kryteria i oczekiwania od początku okresu ani swoje prawa po ocenie.
```

## Sposób rozwiązania problemu (problem → rozwiązanie)

```text
- Złożona procedura → teczka prowadzi przez 7 etapów; każda akcja przechodzi przez maszynę stanów, a niedozwolony krok dostaje polskie wyjaśnienie.
- Terminy → liczone automatycznie z przepisów (z przesunięciem z dnia wolnego), z podstawą prawną przy każdym terminie.
- Błędy formalne → kontrola formalna z paragrafem przy każdym punkcie blokuje podpis do czasu uzupełnienia braków.
- Ocena z ostatnich tygodni → dziennik obserwacji S-D-R przez cały okres i ostrzeżenie o kryteriach bez dowodów.
- Trudna rozmowa → asystent rozmowy i HR partner: pytania z kryteriów i obserwacji, sformułowania informacji zwrotnej, formy rozwoju do IPRZ.
- Brak wiedzy pod ręką → asystent formalny odpowiada z ustawy, rozporządzenia i poradnika KPRM, zawsze ze źródłem; mówi „nie wiem”, gdy odpowiedzi nie ma w bazie.
- Kadry nie widzą stanu → panel monitoringu urzędu z licznikami, filtrami i przypomnieniami; lista sprzeciwów dla dyrektora generalnego.
- Prawa ocenianego → własne konto: kryteria od pierwszego dnia, potwierdzenia tylko przez ocenianego, pouczenie i licznik 7 dni na sprzeciw.
- Dobrostan zespołu → dobrowolny puls i sygnały ryzyka (przeciążenie, wypalenie) z ochroną prywatności, poza oceną okresową.
- Dokumentacja → arkusz A/B/C wypełniany z decyzji w teczce i pobierany jako PDF zgodny ze wzorem.
- Wdrożenie w różnych urzędach → Docker, open source, opcjonalny lokalny model AI, działanie bez internetu, integracje przez REST API.
```

## Wykorzystanie AI

```text
AI jest wyłącznie doradcze: ani asystent, ani HR partner nie wystawiają punktów i nie zapisują decyzji. Ocenę cząstkową zawsze wybiera przełożony, co widać w interfejsie i w API.

1. Asystent AI z bazą wiedzy (formalny i do rozmowy). Odpowiada wyłącznie na podstawie dokumentów: ustawy o służbie cywilnej, rozporządzenia PRM z 2016 r., poradnika KPRM, standardów ZZL i wzorów arkuszy A/B/C. Dokumenty są pocięte na fragmenty według art./§/ust. i stron, wyszukiwanie działa lokalnie (BM25 z polskim stemmingiem). Każda odpowiedź podaje źródło z linkiem do strony dokumentu, a gdy w bazie nie ma odpowiedzi, asystent mówi to wprost („Nie znalazłem tego w bazie wiedzy”) zamiast zgadywać. Asystent rozmowy zna etap teczki i podpowiada pytania z kryteriów i obserwacji. Model językowy jest opcjonalny: dowolny endpoint zgodny z OpenAI, także lokalny (Ollama); bez niego asystent odpowiada cytatami z dokumentów (tryb ekstraktywny), więc działa bez internetu. Jakość wyszukiwania mierzymy na 72 pytaniach i odpowiedziach KPRM (hit@5).

2. Wirtualny HR partner. Dobrowolny puls pracownika co 14 dni, sygnały przeciążenia, spadku motywacji, ryzyka wypalenia i momentu do docenienia, podpowiedzi do rozmowy i form rozwoju do IPRZ. Przełożony widzi trendy, komentarz tylko za zgodą pracownika, średnie zespołu dopiero od 3 odpowiedzi; kadry nie mają wglądu.

3. Anonimizacja przed modelem językowym. Zanim tekst trafi do modelu działającego poza infrastrukturą urzędu, imiona i nazwiska (w każdej formie gramatycznej), PESEL, e-maile, telefony i nazwy komórek są zastępowane znacznikami ([OSOBA_1], [JEDNOSTKA_1]…). Mapowanie zostaje na serwerze, który przywraca dane dopiero w odpowiedzi. W logach nie ma danych osobowych.
```

## Architektura i wdrożenie

```text
Architektura: frontend React (serwowany przez nginx) i API NestJS (Node LTS), opcjonalnie PostgreSQL (migracje uruchamiają się same przy starcie; bez bazy działa w pamięci). PDF arkusza A/B/C generuje serwer (pdfmake). Model językowy (dowolne API zgodne z OpenAI, np. lokalna Ollama) i integracje z EZD / systemem kadrowym są opcjonalne i nigdy nie są warunkiem działania.

Reguły wynikające z przepisów (dobór arkusza, kryteria, § 11, terminy, etapy, kontrola formalna, stopnie służbowe) są w osobnych plikach *.rules.ts i data/*.data.ts z testami i komentarzem ze źródłem prawnym, więc zmiana przepisu to edycja jednego pliku. Frontend nie powiela stałych prawnych: skale, progi, terminy i teksty wzorów pobiera z API.

Wdrożenie: dwa obrazy Docker, instalacja w 3 krokach (git clone obu repozytoriów, cp .env.example .env, docker compose up -d --build). Konfiguracja wyłącznie przez zmienne środowiskowe (nazwa urzędu, miejscowość, sekret sesji, opcjonalny LLM). Zależności tylko open source na licencjach permisywnych, bez płatnych licencji i bez usług konkretnej chmury; działa na Linux, Windows i macOS, także bez dostępu do internetu. Wymagania: 2 vCPU, 2 GB RAM, 5 GB dysku (z lokalnym modelem +8 GB RAM). Aktualizacja = nowy obraz. Integracja z EZD i systemami kadrowymi (np. QNT) przez REST API opisane w OpenAPI 3: eksport arkusza w wersjonowanym JSON, PDF z serwera, import historii ocen z CSV.

Ochrona danych: przetwarzamy tylko pola potrzebne do oceny (bez PESEL i adresu). Dostęp wynika z roli: przełożony widzi swój zespół, oceniany tylko własne oceny, kadry monitoring, dyrektor generalny sprawy ze sprzeciwem.

Kierunki rozwoju: konektory do konkretnych systemów EZD i kadrowych na bazie eksportu i OpenAPI, podpis profilem zaufanym lub kwalifikowanym, powiadomienia e-mail według harmonogramu terminów, ścieżka pierwszej oceny na tym samym silniku reguł, lokalny otwarty model językowy z ewaluacją na zestawie pytań KPRM, pilotaż w jednym departamencie.
```

## Linki

| Pole                   | Link                                                                                                                         | Działa bez logowania do GitHuba (22.11, 00:30) |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Prototyp               | https://cyfrowy.rabbithole.carrotly.tech                                                                                     | tak (200; logowanie kontami demo działa)       |
| Repozytorium backendu  | https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend                                            | **nie** (repo prywatne, 404)                   |
| Repozytorium frontendu | https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-frontend                                           | **nie** (repo prywatne, 404)                   |
| Nagranie demo (1:44)   | https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend/releases/download/demo-v1/demo.mp4         | **nie** (release w prywatnym repo, 404)        |
| Prezentacja PDF        | plik do wgrania: `docs/prezentacja/prezentacja.pdf` (15 slajdów, 3,0 MB, < 10 MB)                                             | wgrywany do formularza                         |

Repozytoria i nagranie zaczną działać dla jury dopiero po decyzji o dostępie (repo publiczne albo zaproszenie jury,
nagranie np. jako niepubliczny film na YouTube). Po tej decyzji podmień link do nagrania w polu formularza.
Plik nagrania do ponownego wgrania: `gh release download demo-v1 -R carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend -p demo.mp4` (13,6 MB).

## Instrukcje jak otworzyć projekt

```text
1. Otwórz https://cyfrowy.rabbithole.carrotly.tech (przeglądarka, bez instalacji).
2. Na stronie logowania pod formularzem jest karta każdego konta demo – logowanie jednym kliknięciem. Można też wpisać login i hasło ręcznie. Hasło każdego konta: Ocena2026!
3. Zmiana roli: menu użytkownika → Wyloguj, potem karta innego konta.

Konta demo (wszystkie osoby i dane są fikcyjne):
- j.kaminska – przełożona (Joanna Kamińska): zespół, teczki na różnych etapach (c-004 od wyboru arkusza, c-001, c-007), dziennik obserwacji, asystent AI, dobrostan zespołu (HR partner).
- r.sikora – przełożony (Robert Sikora): teczka przekazana do zapoznania (fikcja zapoznania), c-102, c-301.
- a.pawlak – przełożona (Agnieszka Pawlak): teczki c-103, c-104.
- p.wojcik – oceniany (Piotr Wójcik): potwierdza część I arkusza (c-002).
- a.nowak – oceniana (Anna Nowak): poprzedni cykl (c-000) i bieżąca ocena (c-001).
- e.dabrowska – oceniana (Ewa Dąbrowska): ocena w 7-dniowym okresie na sprzeciw – może złożyć sprzeciw (c-006).
- t.jankowski – oceniany (Tadeusz Jankowski): złożony sprzeciw czeka na dyrektora generalnego (c-301).
- j.mazur – oceniana (Julia Mazur): teczka na etapie wyboru arkusza – cały proces od kroku 1 (c-004).
- b.wisniewska – dyrektor generalny (Barbara Wiśniewska): rozpatruje sprzeciw (c-301).
- a.lis – kadry (Agnieszka Lis): monitoring wszystkich ocen w urzędzie, przypomnienia, kartoteka, import CSV.
- admin – administrator (Marek Zając): konta i role, tryb korekty z audytem.

Proponowana ścieżka (ok. 5 min): j.kaminska → teczka c-004 (arkusz, kryteria, termin) i asystent AI (np. „Ile dni ma oceniany na sprzeciw?” – odpowiedź ze źródłem) → p.wojcik (potwierdzenie części I) → a.lis (monitoring urzędu) → b.wisniewska (decyzja w sprawie sprzeciwu c-301).

Środowisko demo jest wspólne: zmiany innych osób są widoczne. Przycisk „Przywróć dane demonstracyjne” w menu bocznym (POST /api/demo/reset) przywraca stan początkowy wszystkich teczek. „Dziś” w aplikacji to 21.11.2026 – od tej daty liczone są terminy.

Uruchomienie lokalne (opcjonalnie): w repozytorium backendu `cp .env.example .env` i `docker compose up -d --build` (oba repozytoria obok siebie); aplikacja pod http://localhost:8080. Szczegóły w README backendu, sekcja „Wdrożenie w urzędzie”.
```

## Lista kontrolna przed wysłaniem

- [ ] Tytuł, opis, problem, rozwiązanie, AI, architektura i instrukcje wklejone z tego pliku.
- [ ] `docs/prezentacja/prezentacja.pdf` wgrany (15 slajdów, 3,0 MB).
- [ ] Decyzja o dostępie jury: oba repozytoria publiczne albo zaproszenia dla kont jury.
- [ ] Nagranie demo w miejscu dostępnym bez logowania; link wklejony do formularza.
- [ ] Przed 10:30: każdy link z tabeli [Linki](#linki) otwarty w oknie prywatnym (bez logowania do GitHuba)
      albo `curl -sIL <link>` zwraca 200.
- [ ] Prototyp: logowanie `j.kaminska` / `Ocena2026!` działa; dane demo zresetowane tuż przed terminem.
- [ ] Formularz wysłany przed 22.11.2026, 11:00.
