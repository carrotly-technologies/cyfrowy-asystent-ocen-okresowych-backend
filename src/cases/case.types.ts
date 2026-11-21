import type { OfficeConfig } from '../config/office.js';
import type { Correction } from './correction.rules.js';
import type { EvaluateResult } from '../assessments/evaluate.rules.js';
import type { SheetSuggestion } from '../sheets/sheet-suggestion.rules.js';
import type { SheetId } from '../sheets/sheet.types.js';

/** Types of contract v2 (notatki/api-kontrakt-v2.md). */

/**
 * Stages of a periodic assessment (rozp. PRM z 4.04.2016, ustawa o SC art.
 * 81–83), in order:
 * 1. SHEET_SELECTION – the evaluator picks sheet A/B/C, up to 3 additional
 *    criteria and the assessment due date (§3, §5 ust. 2–3);
 * 2. OPENING_TALK – the opening talk and its confirmation by the evaluator (§5–§6);
 * 3. PART_I_ACK – the assessed person confirms part I (§6 ust. 2);
 * 4. OBSERVATION – the assessment period;
 * 5. ASSESSMENT – assessment talk (§10), partial scores, justification, IPRZ,
 *    part III (§11);
 * 6. SIGNATURE – the evaluator signs the assessment and hands it over (§12 ust. 1);
 * 7. ACKNOWLEDGEMENT – the assessed person acknowledges it (§12; art. 83).
 */
export const STAGES = [
  'SHEET_SELECTION',
  'OPENING_TALK',
  'PART_I_ACK',
  'OBSERVATION',
  'ASSESSMENT',
  'SIGNATURE',
  'ACKNOWLEDGEMENT',
] as const;
export type StageId = (typeof STAGES)[number];

export type StageStatus = 'DONE' | 'CURRENT' | 'UPCOMING' | 'LOCKED';
export type DeadlineState = 'OK' | 'SOON' | 'OVERDUE' | 'NONE';
export type CaseStatus =
  | 'W_TOKU'
  | 'DO_ZAPOZNANIA'
  | 'OKRES_SPRZECIWU'
  /** A sprzeciw (art. 83) waits for the decision of the dyrektor generalny. */
  | 'SPRZECIW_W_ROZPATRZENIU'
  | 'ZAKONCZONA';

export type Employment = 'URZEDNIK' | 'PRACOWNIK';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  unit: string;
  employment: Employment;
  hiredOn: string;
  /** The position is "kierownik urzędu" (sheet A, §3 ust. 2). */
  officeHead: boolean;
  /** The work consists in directly managing employees (sheet B, §3 ust. 3). */
  managesPeople: boolean;
}

export interface Evaluator {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  unit: string;
}

export interface Deadline {
  date: string | null;
  daysLeft: number | null;
  state: DeadlineState;
  label: string;
  legalBasis: string;
}

export interface StageInfo {
  id: StageId;
  name: string;
  status: StageStatus;
  deadline: Deadline | null;
  completedOn: string | null;
  legalBasis: string;
}

export interface CaseSummary {
  id: string;
  person: Person;
  sheetId: SheetId | null;
  cycleLabel: string;
  currentStage: StageId;
  stages: StageInfo[];
  nextDeadline: Deadline | null;
  status: CaseStatus;
}

export type ObservationKind = 'STRENGTH' | 'DEVELOPMENT';

export interface Observation {
  id: string;
  date: string;
  criterionId: string;
  kind: ObservationKind;
  situation: string;
  action: string;
  result: string;
}

export interface PartITopics {
  duties: string;
  criteria: string;
  expectations: string;
  goals: string;
}

export interface PartI {
  additionalCriteria: string[];
  assessmentDue: string | null;
  topics: PartITopics;
  expectations: Record<string, string>;
  confirmedByEvaluatorOn: string | null;
  acknowledgedByEmployeeOn: string | null;
}

/**
 * "Dane dotyczące poprzedniej oceny okresowej urzędnika służby cywilnej"
 * (part II of sheets A, B, C). `level` is the overall level as written on the
 * sheet, e.g. "na poziomie oczekiwań" (footnote 14/15 of the template).
 */
export interface PreviousAssessment {
  result: 'POSITIVE' | 'NEGATIVE' | null;
  level: string | null;
  date: string | null;
}

/** Answer to "Czy do oceny okresowej dołączono wniosek o przyznanie kolejnego stopnia służbowego?". */
export type PromotionAttached = 'YES' | 'NO' | 'NOT_APPLICABLE';

/**
 * The answer above and part III of the sheet (the request of art. 89 ust. 1
 * ustawy). Part III fields are kept only while `attached` is YES.
 */
export interface PromotionRequest {
  attached: PromotionAttached | null;
  appointedYear: number | null;
  currentGrade: string | null;
  gradeGrantedOn: string | null;
  requestedGrade: string | null;
  motivation: string;
}

export interface FormalCheckItem {
  id: string;
  ok: boolean;
  message: string;
  legalBasis: string | null;
}

export interface HistoryEntry {
  date: string;
  text: string;
  /**
   * Domain event behind the entry, for notifications: whom to tell what
   * happened. Only set on entries that someone should be notified about.
   */
  event?: CaseEvent;
}

export const CASE_EVENT_TYPES = [
  'ACK_FICTION_RECORDED',
  'OBJECTION_FILED',
  'OBJECTION_DISMISSED',
  'OBJECTION_ASSESSMENT_CHANGE',
  'OBJECTION_ASSESSMENT_REDO',
  'DUE_DATE_CHANGE_REQUESTED',
  'DUE_DATE_CHANGE_APPROVED',
  'DUE_DATE_CHANGE_REJECTED',
  'DUE_DATE_CHANGED',
] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];

/** Who should hear about an event (roles within the case). */
export type CaseParty = 'EVALUATOR' | 'EMPLOYEE' | 'HR' | 'DIRECTOR';

export interface CaseEvent {
  type: CaseEventType;
  notify: CaseParty[];
}

/** Who did something in the post-assessment paths (name and role, for the record). */
export interface ActorRef {
  name: string;
  role: string;
}

/**
 * "Fikcja zapoznania": the assessed person received the assessment but could
 * not or would not confirm it. Closes the acknowledgement like a confirmation.
 */
export interface AckFiction {
  /** Day the assessment reached the assessed person (acknowledgement date). */
  date: string;
  reason: string;
  recordedOn: string;
  recordedBy: ActorRef;
}

export type ObjectionOutcome = 'DISMISS' | 'CHANGE' | 'REDO';

export interface ObjectionDecision {
  outcome: ObjectionOutcome;
  decidedOn: string;
  reason: string;
  decidedBy: ActorRef;
}

/** Sprzeciw od oceny okresowej (art. 83 ustawy). */
export interface Objection {
  id: string;
  /** Which assessment (1 = first, 2 = made again / changed) it is against. */
  round: number;
  filedOn: string;
  text: string;
  decision: ObjectionDecision | null;
}

/** An earlier version of the assessment, replaced after an objection. */
export interface AssessmentVersion {
  round: number;
  /** CANCELLED: ponowne sporządzenie; CHANGED: zmiana oceny. */
  status: 'CANCELLED' | 'CHANGED';
  closedOn: string;
  reason: string;
  decisions: Record<string, number>;
  justification: string;
  iprz: string;
  result: 'POSITIVE' | 'NEGATIVE' | null;
  average: number | null;
  signedByEvaluatorOn: string | null;
  acknowledgedOn: string | null;
  ackFiction: AckFiction | null;
}

/** Wniosek ocenianego o zmianę terminu oceny (art. 81 ust. 8 pkt 4 ustawy). */
export interface DueDateRequest {
  id: string;
  filedOn: string;
  reason: string;
  proposedDate: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedOn: string | null;
  decisionNote: string | null;
  newDate: string | null;
  decidedBy: ActorRef | null;
}

/** A change of the assessment due date written in part I. */
export interface DueDateChange {
  changedOn: string;
  from: string | null;
  to: string;
  reason: string;
  by: ActorRef;
}

export interface CaseDetail extends CaseSummary {
  evaluator: Omit<Evaluator, 'id'>;
  officeName: string;
  /** Name, city (signatures), logo, sheet A objection addressee (env OFFICE_*). */
  office: OfficeConfig;
  sheetSuggestion: SheetSuggestion;
  partI: PartI;
  observations: Observation[];
  decisions: Record<string, number>;
  deviationNotes: Record<string, string>;
  justification: string;
  iprz: string;
  previousAssessment: PreviousAssessment | null;
  promotionRequest: PromotionRequest;
  evaluation: EvaluateResult | null;
  formalCheck: FormalCheckItem[];
  assessmentTalkOn: string | null;
  signedByEvaluatorOn: string | null;
  sentForAckOn: string | null;
  acknowledgedOn: string | null;
  objectionDeadline: Deadline | null;
  history: HistoryEntry[];
  /** Administrator corrections of locked fields (audit: who, when, old → new, why). */
  corrections: Correction[];
  /** Why part I / parts II–III are locked now (null = editable). */
  locks: { partI: string | null; partII: string | null };
  ackFiction: AckFiction | null;
  objections: ObjectionView[];
  assessmentVersions: AssessmentVersion[];
  dueDateRequests: DueDateRequest[];
  dueDateChanges: DueDateChange[];
  dueDateRequestRule: { eligible: boolean; reason: string; legalBasis: string };
  /** Post-assessment actions the caller may take now (appeals.rules.ts). */
  legalActions?: string[];
}

export interface ObjectionView extends Objection {
  /** 14 days from filing (art. 83 ust. 3). */
  decisionDeadline: Deadline;
  /** 14 days to the labour court (art. 83 ust. 5), after a dismissal or a missed decision term. */
  courtAppealDeadline: Deadline | null;
}

/**
 * How the current cycle started; the anchor of the opening-talk deadline (§7
 * rozp. 2016) and, after a negative assessment, of the re-assessment date
 * (art. 81 ust. 9 ustawy).
 */
export type CycleStart =
  | { kind: 'HIRED'; date: string }
  | { kind: 'PREVIOUS_POSITIVE'; assessedOn: string }
  | { kind: 'PREVIOUS_NEGATIVE'; assessedOn: string; acknowledgedOn: string };

/** What the in-memory store keeps; everything else is derived on read. */
export interface CaseRecord {
  id: string;
  person: Person;
  evaluatorId: string;
  sheetId: SheetId | null;
  cycleStart: CycleStart;
  stage: StageId;
  completedOn: Partial<Record<StageId, string>>;
  partI: PartI;
  observations: Observation[];
  decisions: Record<string, number>;
  deviationNotes: Record<string, string>;
  justification: string;
  iprz: string;
  previousAssessment: PreviousAssessment | null;
  promotionRequest: PromotionRequest;
  assessmentTalkOn: string | null;
  signedByEvaluatorOn: string | null;
  sentForAckOn: string | null;
  acknowledgedOn: string | null;
  history: HistoryEntry[];
  /** Audit of the administrator's „tryb korekty” (src/cases/correction.rules.ts). */
  corrections?: Correction[];
  lastReminderOn: string | null;
  /** Set when a later cycle of the same person exists (this one is archived). */
  nextCaseId: string | null;
  // Post-assessment paths (optional, so older records and seeds stay valid).
  ackFiction?: AckFiction | null;
  objections?: Objection[];
  assessmentVersions?: AssessmentVersion[];
  dueDateRequests?: DueDateRequest[];
  dueDateChanges?: DueDateChange[];
  /**
   * Absences of the assessed person recorded by HR (src/employees), synced
   * into the case; they extend the assessment due date (art. 81 ust. 7).
   */
  absences?: { from: string; to: string; justified: boolean }[];
}

export const CASE_ACTIONS = [
  'ACCEPT_SHEET',
  'CONFIRM_PART_I',
  'EMPLOYEE_ACK_PART_I',
  'START_ASSESSMENT',
  'COMPLETE_ASSESSMENT_TALK',
  'SIGN_ASSESSMENT',
  'SEND_FOR_ACK',
  'EMPLOYEE_ACK_ASSESSMENT',
] as const;
export type CaseAction = (typeof CASE_ACTIONS)[number];

/** Who performs an action: the case's evaluator or the assessed person. */
export type Actor = 'EVALUATOR' | 'EMPLOYEE';
