export const SHEET_IDS = ['A', 'B', 'C', 'FIRST'] as const;
export type SheetId = (typeof SHEET_IDS)[number];

export type SheetKind = 'PERIODIC' | 'FIRST';

export interface Sheet {
  id: SheetId;
  name: string;
  appliesTo: string;
  kind: SheetKind;
  scale: number[];
  mandatoryCriteria: string[];
  maxAdditionalCriteria: number;
  legalBasis: string;
}
