import { USC } from './deadlines.rules.js';
import {
  COURT_APPEAL_DAYS,
  OBJECTION_DECISION_DAYS,
} from './objection-terms.rules.js';

/** Days to file a sprzeciw from acknowledging the assessment (art. 83 ust. 1). */
export const OBJECTION_FILING_DAYS = 7;

export interface ObjectionStep {
  text: string;
  legalBasis: string;
}

/**
 * "Co dalej?" under the pouczenie on the assessed person's screen: the
 * objection path in plain words. `to` is the addressee in the genitive
 * ("dyrektora generalnego urzędu").
 */
export function objectionNextSteps(
  to = 'dyrektora generalnego urzędu',
): ObjectionStep[] {
  return [
    {
      text: `Jeśli nie zgadzasz się z oceną, w ciągu ${OBJECTION_FILING_DAYS} dni od zapoznania się z nią możesz wnieść sprzeciw do ${to}. Napisz, z czym się nie zgadzasz i dlaczego.`,
      legalBasis: `art. 83 ust. 1 ${USC}`,
    },
    {
      text: `Sprzeciw rozpatruje się w ciągu ${OBJECTION_DECISION_DAYS} dni. Możliwe rozstrzygnięcia: sprzeciw nie zostaje uwzględniony (ocena zostaje), ocena zostaje zmieniona albo ocena zostaje sporządzona ponownie.`,
      legalBasis: `art. 83 ust. 3–4 ${USC}`,
    },
    {
      text: `Jeśli sprzeciw nie zostanie uwzględniony albo nie zostanie rozpatrzony w terminie, możesz odwołać się do sądu pracy w ciągu ${COURT_APPEAL_DAYS} dni od doręczenia rozstrzygnięcia (albo od upływu terminu na rozpatrzenie).`,
      legalBasis: `art. 83 ust. 5 ${USC}`,
    },
  ];
}
