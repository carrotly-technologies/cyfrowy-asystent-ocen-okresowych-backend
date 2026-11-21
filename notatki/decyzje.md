# Decyzje

Decyzje dotyczące interpretacji przepisów i dokumentów z `docs/`, podjęte w trakcie prac. Każdy wpis: data, decyzja, źródło, stan poprzedni.

## 2026-11-21: Etapy oceny okresowej i potwierdzenia ocenianego (faza 0 Cyfrowego Asystenta)

- **Decyzja:** proces ma 7 etapów: `SHEET_SELECTION` (arkusz, ≤ 3 kryteria dodatkowe bez powtórzeń, termin oceny), `OPENING_TALK` (rozmowa rozpoczynająca, potwierdzenie oceniającego), `PART_I_ACK` (potwierdzenie ocenianego), `OBSERVATION`, `ASSESSMENT` (rozmowa oceniająca, oceny, uzasadnienie, IPRZ, część III), `SIGNATURE` (podpis i przekazanie), `ACKNOWLEDGEMENT` (zapoznanie). Potwierdzenia `EMPLOYEE_ACK_PART_I` i `EMPLOYEE_ACK_ASSESSMENT` wykonuje tylko oceniany ze swojego konta (rola `EMPLOYEE`). Podpis wymaga odnotowania rozmowy oceniającej (`ASSESSMENT_TALK_HELD`).
- **Źródło:** §3, §5–§6, §10–§12 rozp. PRM z 4.04.2016; art. 81–83 ustawy o służbie cywilnej; „use cases – opis” z materiałów wyzwania.
- **Wcześniej (Kompas Kompetencji):** analiza OSP, „Wstępny formularz”, ścieżka pierwszej oceny, potwierdzenia ocenianego klikane przez przełożonego.
- **Arkusz:** propozycja regułą (kierownik urzędu → A, bezpośrednie kierowanie pracownikami → B, pozostali → C), zatwierdza oceniający.
- **Kryteria:** wykaz z załącznika nr 1 ma 14 pozycji (nie 13); wszystkie są w `src/criteria/data/criteria.data.ts`.

## 2026-11-21: Część II arkusza edytowalna przed rozmową oceniającą (wersja robocza)

- **Decyzja:** część II arkusza oceny okresowej (oceny wskaźników, oceny cząstkowe, notatki, uzasadnienie, IPRZ, poprzednia ocena, wniosek o kolejny stopień służbowy i część III) można zapisywać roboczo od chwili wybrania arkusza (etap „Wstępny formularz”) aż do podpisu oceniającego. Po podpisie (`SIGN_ASSESSMENT`) pola są zablokowane. Podpis nadal jest dostępny dopiero po rozpoczęciu rozmowy oceniającej (`START_ASSESSMENT`).
- **Źródło:**
  - Poradnik „Oceny okresowe w służbie cywilnej”, s. 20, etap II „Ocenianie”: „przygotowanie bezpośrednio przed rozmową oceniającą wypełnionego na roboczo arkusza oceny”.
  - § 10 rozp. PRM z 4.04.2016 (Dz.U. 2016 poz. 470): „Przed sporządzeniem oceny na piśmie oceniający przeprowadza z ocenianym rozmowę oceniającą…”; § 11 ust. 2: „Sporządzając ocenę na piśmie, oceniający bierze pod uwagę wnioski z rozmowy oceniającej.”; § 12 ust. 1: „Oceniający niezwłocznie zapoznaje ocenianego z oceną sporządzoną na piśmie.”
  - Wniosek: przed rozmową arkusz wypełnia się roboczo, a po rozmowie można go poprawić; „sporządzenie oceny na piśmie” to podpis oceniającego po rozmowie.
- **Wcześniej:** edycja części II tylko na etapach `ASSESSMENT` / `JUSTIFICATION` (po akcji „Rozpocznij rozmowę oceniającą”).
- **Pierwsza ocena bez zmian:** wersję roboczą przygotowuje się na podstawie sprawozdania ocenianego (Poradnik „Pierwsza ocena”, 2016, s. 27), a sprawozdanie jest dopiero na etapie `FIRST_ASSESSMENT` (§ 8 ust. 1 rozp. PRM z 23.07.2015).
- **Skutek uboczny:** gdy przed zatwierdzeniem części I zmieni się arkusz albo kryteria dodatkowe, robocze oceny kryteriów, które wypadły z oceny, są usuwane.
- **Kod:** `partIIEditable` w `src/cases/patch.rules.ts`.
- **Status:** do potwierdzenia z ekspertem.
