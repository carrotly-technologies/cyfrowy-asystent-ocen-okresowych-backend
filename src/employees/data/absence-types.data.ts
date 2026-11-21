/**
 * Kinds of absence HR records. "Nieobecności usprawiedliwione to np.
 * zwolnienie lekarskie, urlop wypoczynkowy, urlopy związane z rodzicielstwem"
 * (liczenie terminów, materiały wyzwania); `justified` is only the default,
 * HR can change it per absence. Edit this list when the HR system uses others.
 */
export const ABSENCE_TYPES = [
  {
    id: 'ZWOLNIENIE_LEKARSKIE',
    label: 'Zwolnienie lekarskie',
    justified: true,
  },
  { id: 'URLOP_WYPOCZYNKOWY', label: 'Urlop wypoczynkowy', justified: true },
  { id: 'URLOP_MACIERZYNSKI', label: 'Urlop macierzyński', justified: true },
  { id: 'URLOP_OJCOWSKI', label: 'Urlop ojcowski', justified: true },
  { id: 'URLOP_RODZICIELSKI', label: 'Urlop rodzicielski', justified: true },
  { id: 'URLOP_WYCHOWAWCZY', label: 'Urlop wychowawczy', justified: true },
  {
    id: 'OPIEKA_NAD_DZIECKIEM',
    label: 'Opieka nad dzieckiem / członkiem rodziny',
    justified: true,
  },
  { id: 'URLOP_BEZPLATNY', label: 'Urlop bezpłatny', justified: true },
  {
    id: 'INNA_USPRAWIEDLIWIONA',
    label: 'Inna nieobecność usprawiedliwiona',
    justified: true,
  },
  {
    id: 'NIEUSPRAWIEDLIWIONA',
    label: 'Nieobecność nieusprawiedliwiona',
    justified: false,
  },
] as const;

export type AbsenceTypeId = (typeof ABSENCE_TYPES)[number]['id'];
export const ABSENCE_TYPE_IDS = ABSENCE_TYPES.map((t) => t.id) as [
  AbsenceTypeId,
  ...AbsenceTypeId[],
];
