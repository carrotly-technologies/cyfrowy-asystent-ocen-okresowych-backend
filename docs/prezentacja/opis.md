# Opis projektu – zgłoszenie HackNation 2026 (wyzwanie KPRM)

Materiały: prezentacja [`prezentacja.pdf`](prezentacja.pdf) (15 slajdów, źródło [`slajdy.html`](slajdy.html)),
zrzuty ekranu z prototypu w [`zrzuty/`](zrzuty/).

- Prototyp: https://cyfrowy.rabbithole.carrotly.tech
- Konta demo (hasło każdego: `Ocena2026!`; wszystkie osoby i dane są fikcyjne): `j.kaminska` (przełożona),
  `p.wojcik` i `a.nowak` (oceniani), `a.lis` (kadry), `b.wisniewska` (dyrektor generalny), `admin` (administrator).
- Kod: [backend](https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-backend),
  [frontend](https://github.com/carrotly-technologies/cyfrowy-asystent-ocen-okresowych-frontend).

## Tytuł

**Cyfrowy Asystent Ocen Okresowych**

## Opis rozwiązania

Cyfrowy Asystent Ocen Okresowych to aplikacja w przeglądarce, która prowadzi przełożonego, ocenianego, kadry
i dyrektora generalnego przez całą ocenę okresową urzędnika i pracownika służby cywilnej, zgodnie z ustawą
z 21 listopada 2008 r. o służbie cywilnej (art. 81–83, 89, 108) i rozporządzeniem Prezesa Rady Ministrów
z 4 kwietnia 2016 r. (Dz.U. poz. 470).

Każda ocena to teczka, która przechodzi przez siedem etapów:

1. **Arkusz i kryteria.** System proponuje arkusz A, B albo C z podstawą prawną (§ 3), wstawia kryteria obowiązkowe
   z katalogu 14 kryteriów (załącznik nr 1), pozwala wybrać do 3 dodatkowych i liczy termin oceny (24 miesiące,
   6 po ocenie negatywnej).
2. **Rozmowa rozpoczynająca.** Oczekiwania do każdego kryterium trafiają do części I arkusza; termin 30 dni (§ 7).
3. **Potwierdzenie ocenianego.** Oceniany potwierdza rozmowę i kryteria na własnym koncie (§ 6).
4. **Okres obserwacji.** Dziennik obserwacji w modelu sytuacja–działanie–rezultat przy kryteriach, przez cały okres,
   z ostrzeżeniem, gdy kryterium ma za mało dowodów.
5. **Rozmowa oceniająca i ocena.** Oceny cząstkowe 1–9, średnia, poziom i wynik według § 11, uzasadnienie, wnioski
   do IPRZ, wniosek o kolejny stopień służbowy (część III). Arkusz można wypełniać roboczo przed rozmową.
6. **Podpis i przekazanie.** Kontrola formalna z paragrafem przy każdym punkcie blokuje podpis, dopóki arkusz ma braki.
   Arkusz A/B/C pobiera się jako PDF zgodny ze wzorem.
7. **Zapoznanie z oceną.** Potwierdzenie ocenianego otwiera 7-dniowy termin na sprzeciw (art. 83 ust. 1).

Po ocenie system obsługuje fikcję zapoznania, sprzeciw rozpatrywany przez dyrektora generalnego w 14 dni (oddalenie,
zmiana oceny z zachowaniem poprzedniej wersji albo polecenie ponownej oceny) oraz zmianę terminu oceny na wniosek
ocenianego (art. 81 ust. 8 pkt 4).

Dwa moduły wspierają przełożonego poza samą procedurą:

- **Asystent AI** (formalny i do rozmowy) odpowiada wyłącznie na podstawie dokumentów: ustawy, rozporządzenia,
  poradnika KPRM, standardów ZZL i wzorów arkuszy. Każda odpowiedź podaje źródło z linkiem do strony dokumentu,
  a gdy w bazie nie ma odpowiedzi, asystent mówi to wprost.
- **Wirtualny HR partner**: dobrowolny puls pracownika co 14 dni, sygnały przeciążenia, spadku motywacji, ryzyka
  wypalenia i momentu do docenienia, podpowiedzi do rozmowy i form rozwoju do IPRZ. Przełożony widzi trendy,
  komentarz tylko za zgodą pracownika, średnie zespołu dopiero od 3 odpowiedzi; kadry nie mają wglądu.

Kadry mają panel monitoringu wszystkich ocen w urzędzie (w toku, termin ≤ 14 dni, po terminie, do zapoznania,
w okresie sprzeciwu) z przypomnieniami do przełożonych oraz kartotekę: pracownicy, podległość, zastępstwa oceniających,
nieobecności dłuższe niż miesiąc wydłużające termin oceny (art. 81 ust. 7), import historii ocen i statystyki z CSV.

**AI jest wyłącznie doradcze.** Ani asystent, ani HR partner nie wystawiają punktów i nie zapisują decyzji. Ocenę
cząstkową zawsze wybiera przełożony, co widać w interfejsie i w API.

**Technologia i wdrożenie.** Frontend React, API NestJS (Node LTS), opcjonalnie PostgreSQL (migracje uruchamiają się
same przy starcie). Dwa obrazy Docker, konfiguracja wyłącznie przez zmienne środowiskowe, zależności tylko open source
na licencjach permisywnych. Model językowy jest opcjonalny: dowolny endpoint zgodny z OpenAI, także lokalny (Ollama);
bez niego asystent odpowiada cytatami z dokumentów, więc aplikacja działa bez internetu i bez płatnych usług.
Integracja z EZD i systemami kadrowymi (np. QNT) przez REST API opisane w OpenAPI 3 (eksport arkusza w wersjonowanym
JSON, PDF z serwera, import historii ocen z CSV), nigdy jako warunek działania.
Reguły wynikające z przepisów są w osobnych plikach z testami, więc zmiana przepisu to zmiana jednego pliku.

**Ochrona danych.** Przetwarzamy tylko pola potrzebne do oceny (bez PESEL i adresu). Dostęp wynika z roli:
przełożony widzi swój zespół, oceniany tylko własne oceny, kadry monitoring. Przed wysłaniem do modelu językowego
imiona i nazwiska, PESEL, e-maile, telefony i nazwy komórek są zastępowane znacznikami, a serwer przywraca je dopiero
w odpowiedzi. W logach nie ma danych osobowych. Korekty zablokowanych pól robi tylko administrator, z powodem i audytem.

## Identyfikacja problemu

Ocena okresowa w służbie cywilnej to proces prawny z wieloma terminami i warunkami, a w praktyce prowadzi się go
na papierowych lub edytowalnych wzorach arkuszy:

- **Złożona procedura.** Siedem kroków, trzy wzory arkuszy, kryteria obowiązkowe zależne od stanowiska, skala 1–9
  i reguła wyniku z § 11, terminy z ustawy i rozporządzenia (30 dni, 24 i 6 miesięcy, 7 i 14 dni) liczone według
  Kodeksu cywilnego. Przełożony nie jest kadrowcem ani prawnikiem.
- **Błędy formalne wychodzą za późno.** Brak uzasadnienia oceny negatywnej, brak wniosków do IPRZ, niewłaściwe kryteria
  albo przekroczony termin wychodzą zwykle dopiero przy sprzeciwie lub kontroli.
- **Ocena z ostatnich tygodni.** Bez zapisanych przykładów z całego okresu ocena opiera się na ogólnym wrażeniu,
  a rozmowa oceniająca jest trudna dla obu stron.
- **Brak wiedzy pod ręką.** Odpowiedzi są rozproszone w ustawie, rozporządzeniu i poradnikach KPRM.
- **Kadry nie widzą stanu ocen** w urzędzie i ręcznie przypominają o terminach; dyrektor generalny nie ma
  przeglądu sprzeciwów i ich terminów.
- **Oceniany** nie zawsze zna kryteria i oczekiwania od początku okresu ani swoje prawa po ocenie.

## Sposób rozwiązania problemu

| Problem                         | Jak go rozwiązujemy                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Złożona procedura               | Teczka prowadzi przez 7 etapów; każda akcja przechodzi przez maszynę stanów, niedozwolony krok dostaje polskie wyjaśnienie |
| Terminy                         | Liczone automatycznie z przepisów (z przesunięciem z dnia wolnego), z podstawą prawną przy każdym terminie |
| Błędy formalne                  | Kontrola formalna z paragrafem przy każdym punkcie blokuje podpis do czasu uzupełnienia braków          |
| Ocena z ostatnich tygodni       | Dziennik obserwacji S-D-R przez cały okres i ostrzeżenie o kryteriach bez dowodów                       |
| Trudna rozmowa                  | Asystent rozmowy i HR partner: pytania z kryteriów i obserwacji, sformułowania informacji zwrotnej, formy rozwoju do IPRZ |
| Brak wiedzy pod ręką            | Asystent formalny odpowiada z ustawy, rozporządzenia i poradnika KPRM, zawsze ze źródłem; „nie wiem”, gdy brak w bazie |
| Kadry nie widzą stanu           | Panel monitoringu urzędu z licznikami, filtrami i przypomnieniami; lista sprzeciwów dla dyrektora generalnego |
| Prawa ocenianego                | Własne konto: kryteria od pierwszego dnia, potwierdzenia tylko przez ocenianego, pouczenie i licznik 7 dni na sprzeciw |
| Dobrostan zespołu               | Dobrowolny puls i sygnały ryzyka (przeciążenie, wypalenie) z ochroną prywatności, poza oceną okresową    |
| Dokumentacja                    | Arkusz A/B/C wypełniany z decyzji w teczce i pobierany jako PDF zgodny ze wzorem                        |
| Wdrożenie w różnych urzędach    | Docker, open source, opcjonalny lokalny model AI, działanie bez internetu, integracje przez REST API     |

**Kierunki rozwoju:** gotowe konektory do konkretnych systemów EZD i kadrowych na bazie eksportu i OpenAPI, podpis
profilem zaufanym lub kwalifikowanym, powiadomienia e-mail według harmonogramu terminów, ścieżka pierwszej oceny na tym samym silniku reguł,
lokalny otwarty model językowy z ewaluacją na zestawie pytań i odpowiedzi KPRM, pilotaż w jednym departamencie.
