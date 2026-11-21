export type ScalePoints = 1 | 3 | 5 | 7 | 9;

export interface ScaleLevel {
  points: ScalePoints;
  label: string;
}

export interface Indicator {
  id: string;
  name: string;
  levels: Record<ScalePoints, string>;
}

export interface Competency {
  id: string;
  name: string;
  indicators: Indicator[];
}

export interface CompetencyModel {
  title: string;
  instructions: string[];
  scale: ScaleLevel[];
  competencies: Competency[];
}

export interface PeriodicSheetMapping {
  appliesTo: string;
  mandatoryCriteria: string[];
  legalBasis: string;
}

export interface SheetMapping {
  A: PeriodicSheetMapping;
  B: PeriodicSheetMapping;
  C: PeriodicSheetMapping;
  additionalCriteriaNote: string;
  first: {
    elements: string[];
    legalBasis: string;
    scale: number[];
  };
}
