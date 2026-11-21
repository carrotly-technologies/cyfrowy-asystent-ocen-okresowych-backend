import type { OspDoc } from '../cases/case.types.js';

/**
 * The three real job descriptions (OSP) from the HackNation materials
 * (`Kompetencje wspierające analizę OSP + przykładowe OSP/OSP/OSP_word/*.docx`),
 * extracted from word/document.xml. Texts are verbatim (typos included), only
 * whitespace and list bullets were normalised. Soft competencies are mapped to
 * model ids as in `opisy_stanowisk_przyklady` of model-kompetencji.json.
 */
export interface OspSource extends OspDoc {
  /** Verbatim "Kompetencje miękkie" line, quoted by the OSP analysis. */
  softCompetenciesQuote: string;
}

export const OSP_DOCS: readonly OspSource[] = [
  {
    id: 'osp-dc-wzksoic-6',
    title:
      'Starszy specjalista — Departament Cyberbezpieczeństwa, Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa (DC WZKSOiC 6)',
    purpose:
      'Prowadzenie spraw dotyczących zarządzania kryzysowego w cyberprzestrzeni pozostających w zakresie ministra właściwego ds. informatyzacji.',
    subordinates: 'brak podległych pracowników',
    mainTasks: [
      'Bierze udział w opracowaniu i aktualizacji dokumentacji w zakresie zarządzania kryzysowego (np. Krajowego planu reagowania na incydenty i sytuacje kryzysowe w cyberbezpieczeństwie na dużą skalę) w celu zapewnienia obsługi zadań Ministra w zakresie zarządzania kryzysowego w cyberprzestrzeni.',
      'Bierze udział w realizacji zadań z obszaru zarządzania kryzysowego wynikających z członkostwa Polski w Organizacji Paktu Północnoatlantyckiego (NATO), Unii Europejskiej (UE) i Organizacji Narodów Zjednoczonych (ONZ) w celu zapewnienia stałej gotowości do reagowania na zagrożenia płynące z cyberprzestrzeni.',
      'Współpracuje z zespołami CSIRT i organami właściwymi do spraw cyberbezpieczeństwa w celu wzmocnienia krajowego systemu cyberbezpieczeństwa.',
      'Bierze udział w wykonywaniu działań zmierzających do integracji krajowego systemu cyberbezpieczeństwa z krajowym systemem zarządzania kryzysowego poprzez unifikację procedur oraz czynności kontrolnych w celu zwiększenia odporności tych systemów.',
      'Bierze udział w wykonywaniu zadań w ramach Krajowych ram zarządzania kryzysowego w cyberbezpieczeństwie w celu zwiększenia odporności systemu zarządzania kryzysowego, koordynacji działań między organami publicznymi a sektorem prywatnym oraz szybszego reagowania na zagrożenia.',
      'Dokonuje oceny obiektów oraz procesów pod kątem Infrastruktury krytycznej w celu prowadzenia wykazu obiektów IK będących we właściwości Ministra Cyfryzacji oraz zwiększenia odporności Państwa na kryzysy.',
      'Wykonuje zadania organu właściwego ds. podmiotów krytycznych (m.in. prowadzenie kontroli, aktualizacja dokumentacji) w celu zwiększenia odporności Państwa na kryzysy.',
    ],
    softCompetencies: [
      'organizacja_pracy',
      'wspolpraca',
      'myslenie_analityczne',
      'wykorzystywanie_wiedzy',
    ],
    softCompetenciesQuote:
      'Kompetencje miękkie: organizacja pracy i orientacja na osiąganie celów, współpraca, myślenie analityczne, wykorzystywanie wiedzy i doskonalenie zawodowe.',
    otherRequirements: [
      'Szczególne uprawnienia: poświadczenie bezpieczeństwa upoważaniające do dostępu do informacji niejawnych oznaczonych klauzulą „ŚCIŚLE TAJNE”, „UE TOP SECRET”, „NATO COSMIC TOP SECRET” lub zgoda na przeprowadzenie postępowania sprawdzającego.',
      'Język obcy: angielski, poziom B2.',
      'Znajomość: Kodeksu postępowania administracyjnego, ustawy o krajowym systemie cyberbezpieczeństwa (wraz z rozporządzeniami wykonawczymi), ustawy o zarządzaniu kryzysowym (wraz z rozporządzeniami wykonawczymi), ustawy o informatyzacji działalności podmiotów realizujących zadania publiczne, ustawy Prawo przedsiębiorców, Dyrektywy Parlamentu Europejskiego i Rady (UE) w sprawie środków na rzecz wysokiego wspólnego poziomu bezpieczeństwa sieci i systemów informatycznych na terytorium Unii.',
      'Znajomość krajowych i międzynarodowych zagadnień z zakresu cyberbezpieczeństwa i zarządzania kryzysowego oraz polityki krajowej i europejskiej w tym zakresie, e-administracji, zasad funkcjonowania administracji publicznej, w tym służby cywilnej oraz działań i organizacji MC; podstawowa znajomość ustawy o ochronie danych osobowych i ustawy o ochronie informacji niejawnych.',
      'Doświadczenie zawodowe: cyberbezpieczeństwa lub kontroli lub audytu lub zarządzania kryzysowego lub w jednostkach sektora finansów publicznych.',
      'Upoważnienia: upoważnienie do przeprowadzania kontroli; upoważnienie do reprezentowania RP w pracach grup tematycznych UE, w zakresie wynikającym z powierzonych zadań.',
      'Czynniki utrudniające: nietypowe godziny pracy (w tym dyżury), krajowe lub zagraniczne wyjazdy służbowe, częste reprezentowanie urzędu na zewnątrz.',
    ],
    source: 'OSP DC WZKSOiC 6 starszy specjalista.docx',
  },
  {
    id: 'osp-dsi-wwi-5',
    title:
      'Radca — Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji, Wydział Wspierania Innowacyjności (DSI WWI 5)',
    purpose:
      'Zapewnienie wsparcia merytorycznego w zakresie rozwoju innowacyjnych rozwiązań opartych na sztucznej inteligencji poprzez rozwijanie mechanizmów wspierających zgodność z przepisami prawa oraz identyfikowanie barier dla rozwoju innowacyjności.',
    subordinates: 'brak podległych pracowników',
    mainTasks: [
      'Analizuje i dokonuje oceny prawa krajowego, prawa Unii Europejskiej, orzecznictwa krajowego i międzynarodowego, wytycznych organów unijnych oraz praktyki stosowania prawa w obszarze sztucznej inteligencji, a także przygotowuje propozycje zmian systemowych, w celu zapewnienia skutecznego i spójnego stosowania regulacji dotyczących sztucznej inteligencji oraz wspierania rozwoju otoczenia prawnego sprzyjającego innowacjom i bezpieczeństwu.',
      'Prowadzi sprawy dotyczące opinii indywidualnych oraz wyjaśnień dotyczących stosowania przepisów krajowych i unijnych z zakresu sztucznej inteligencji, w celu zapewnienia prawidłowej i jednolitej interpretacji oraz stosowania przepisów w tym obszarze.',
      'Przygotowuje projekty informacji zawierające pogląd Komisji w sprawach sztucznej inteligencji, w celu zapewnienia jednolitego stanowiska Komisji oraz wsparcia prawidłowego stosowania przepisów w obszarze sztucznej inteligencji.',
      'Analizuje bariery prawne i organizacyjne dla rozwoju innowacji w obszarze sztucznej inteligencji w celu opracowywania propozycji działań usprawniających.',
      'Przygotowuje projekty odpowiedzi na pisma i inne wystąpienia kierowane do Komisji Rozwoju i Bezpieczeństwa Sztucznej Inteligencji w ramach właściwości wydziału, w celu zapewnienia sprawnej, rzetelnej i zgodnej z obowiązującymi przepisami realizacji zadań Komisji oraz właściwej komunikacji z podmiotami zewnętrznymi.',
    ],
    softCompetencies: [
      'organizacja_pracy',
      'wykorzystywanie_wiedzy',
      'wspolpraca',
    ],
    softCompetenciesQuote:
      'Kompetencje miękkie: organizacja pracy i orientacja na osiąganie celów, wykorzystywanie wiedzy i doskonalenie zawodowe, współpraca.',
    otherRequirements: [
      'Wykształcenie: na kierunku prawo.',
      'Język obcy: angielski, poziom B2.',
      'Znajomość: rozporządzenia Parlamentu Europejskiego i Rady (UE) 2024/1689 z dnia 13 czerwca 2024 r. w sprawie ustanowienia zharmonizowanych przepisów dotyczących sztucznej inteligencji (akt w sprawie sztucznej inteligencji), ustawy o systemach sztucznej inteligencji, prawa administracyjnego, RODO i ustawy o ochronie danych osobowych.',
      'Doświadczenie zawodowe: opracowywania analiz, opinii, stanowisk lub rekomendacji dotyczących zagadnień regulacyjnych lub technologicznych lub związanych z rozwojem innowacji.',
      'Upoważnienia: brak upoważnień i pełnomocnictw.',
    ],
    source: 'OSP DSI WWI 5 radca.docx',
  },
  {
    id: 'osp-dwm-wkam-1',
    title:
      'Naczelnik wydziału — Departament Współpracy Międzynarodowej, Wydział Koordynacji Aktywności Międzynarodowych (DWM WKAM 1)',
    purpose:
      'Zapewnienie organizacji aktywności członków kierownictwa MC na arenie międzynarodowej, w tym przygotowania i realizacji zagranicznych wizyt członków kierownictwa MC oraz podejmowanych przez nich wizyt gości zagranicznych w Polsce, a także spotkań o charakterze międzynarodowym z podmiotami krajowymi, w zakresie Wydziału Koordynacji Aktywności Międzynarodowych. Koordynacja obsługi spraw budżetowo-finansowych Departamentu, w tym udzielania, obsługi i rozliczania dotacji i wydawanie stosownych decyzji administracyjnych. Zapewnienie prawidłowej realizacji umowy na świadczenia usług zakupu krajowych i zagranicznych biletów lotniczych i kolejowych w MC oraz zarządzanie procesem delegacji zagranicznych pracowników MC.',
    subordinates:
      'bezpośrednio kieruje lub koordynuje pracę od 5 do 9 pracowników',
    mainTasks: [
      'Koordynuje pracę zespołu poprzez planowanie, organizowanie oraz nadzorowanie realizacji zadań zgodnie z wyznaczonymi celami. Zapewnia skuteczne zarządzanie zespołem poprzez monitorowanie postępów, delegowanie obowiązków oraz dostosowywanie działań do zmieniających się warunków organizacyjnych i prawnych. Wspiera pracowników poprzez wyznaczanie priorytetów, rozwiązywanie problemów oraz udzielanie wsparcia merytorycznego. Podejmuje działania motywacyjne i rozwojowe, sprzyjające podnoszeniu kwalifikacji zespołu oraz zwiększaniu zaangażowania pracowników w celu sprawnej i skutecznej realizacji zadań Wydziału.',
      'Nadzoruje oraz bierze udział w przygotowaniu i organizacji zagranicznych wizyt członków kierownictwa MC oraz wizyt gości zagranicznych w Polsce, a także spotkań o charakterze międzynarodowym z podmiotami krajowymi w celu aktywnego kształtowania cyfrowej polityki międzynarodowej.',
      'Koordynuje obsługę spraw finansowo-budżetowych departamentu, w tym udzielanie i rozliczanie dotacji, łącznie z wydawaniem stosownych decyzji administracyjnych oraz przygotowywaniem projektu budżetu i zmian w planie wydatków DWM w celu terminowej i efektywnej realizacji budżetu DWM.',
      'Koordynuje przygotowania materiałów tezowo-informacyjnych (stanowiska, opinie) z zakresu dwustronnej lub wielostronnej współpracy z państwami europejskimi, pozaeuropejskimi lub organizacjami międzynarodowymi w obszarze cyfryzacji na potrzeby kierownictwa MC, Kancelarii Prezesa Rady Ministrów, Kancelarii Prezydenta, Kancelarii Sejmu i Senatu, innych ministerstw oraz urzędów na spotkania z odpowiednimi przedstawicielami tych krajów i organizacji (lub inicjatyw) w celu realizacji spotkań Kierownictwa MC.',
      'Organizuje wydarzenia o charakterze międzynarodowym w obszarze cyfryzacji (m.in. konferencje, kongresy, seminaria, warsztaty, konsultacje), a także przygotowuje rekomendacje w zakresie uczestnictwa członków Kierownictwa MC w wydarzeniach o charakterze międzynarodowym w celu aktywnego kształtowania cyfrowej polityki międzynarodowej.',
      'Bierze udział w pracach dotyczących realizacji umowy na świadczenia usług zakupu krajowych i zagranicznych biletów lotniczych i kolejowych oraz umowy na tłumaczenia ustne i pisemne (przeprowadzanie postępowań o udzielenie zamówień publicznych, ustalanie zapotrzebowania Ministerstwa na świadczenie usług, monitorowanie realizacji umów) w celu zapewnienia usług dla Ministerstwa Cyfryzacji.',
      'Koordynuje przygotowanie wkładów do odpowiedzi na zapytania publiczne, medialne, interpelacje poselskie, kontrole (w tym kontrole KAS i NIK) oraz audytu w celu dostarczenia rzetelnych informacji wnioskującym.',
      'Uczestniczy w przygotowywaniu wkładu do planu zamówień publicznych Ministerstwa, jego aktualizacji oraz koordynowania zamówień publicznych w ramach Departamentu, w celu terminowej i efektywnej realizacji projektów DWM.',
    ],
    softCompetencies: [
      'zarzadzanie_ludzmi',
      'podejmowanie_decyzji',
      'wykorzystywanie_wiedzy',
      'organizacja_pracy',
      'wspolpraca',
    ],
    softCompetenciesQuote:
      'Kompetencje miękkie: zarządzanie ludźmi, podejmowanie decyzji i odpowiedzialność, wykorzystywanie wiedzy i doskonalenie zawodowe, organizacja pracy i orientacja na osiąganie celów, współpraca.',
    otherRequirements: [
      'Wykształcenie: wyższe.',
      'Język obcy: angielski, poziom B2.',
      'Znajomość: zasad funkcjonowania administracji publicznej, w tym służby cywilnej oraz działalności i organizacji MC; współpracy międzynarodowej w wymiarze globalnym; protokołu dyplomatycznego.',
      'Doświadczenie zawodowe: współpracy międzynarodowej.',
      'Upoważnienia: brak upoważnień i pełnomocnictw.',
      'Czynniki utrudniające: krajowe lub zagraniczne wyjazdy służbowe, zagrożenie korupcją.',
    ],
    source: 'OSP DWM WKAM 1 naczelnik wydziału.docx',
  },
];

/** The public shape (contract `OspDoc`), without internal fields. */
export function toOspDoc(source: OspSource): OspDoc {
  const { softCompetenciesQuote: _quote, ...doc } = source;
  return doc;
}

export function findOsp(id: string | null): OspSource | null {
  return OSP_DOCS.find((o) => o.id === id) ?? null;
}
