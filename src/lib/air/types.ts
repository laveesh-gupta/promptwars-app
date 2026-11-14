export type Role = 'Ward officer' | 'Housing society' | 'School';
export type Language = 'English' | 'Hindi';
export type Context = {
  locality: string;
  timezone: string;
  role: Role;
  language: Language;
  level: 'Simple' | 'Standard';
};
export type Observation = {
  id: string;
  line: number;
  source: string;
  site: string;
  pollutant: string;
  value: number | null;
  unit: string;
  timestamp: string;
  period: string;
  flags: string[];
  included: boolean;
  reason: string;
  status?: string;
  originalValue?: number | null;
  originalUnit?: string;
  correction?: string;
  outlierApproved?: boolean;
};
export type Dataset = {
  label: string;
  observations: Observation[];
  notes: string[];
  fingerprint?: string;
  unaccounted?: number[];
};
export type Metric = {
  id: string;
  site: string;
  pollutant: string;
  period: string;
  mean: number;
  min: number;
  max: number;
  count: number;
  observationIds: string[];
  delta: number | null;
  previous?: number;
  comparison: string;
};
export type Action = {
  id: string;
  title: string;
  owner: string;
  rationale: string;
  verification: string;
  horizon: string;
  evidence: string[];
  location?: string;
  escalation?: string;
  basis?: 'Observation' | 'Guidance' | 'Data repair';
};
export type Narrative = {
  summary: string;
  findings: {
    title: string;
    detail: string;
    limitation: string;
    evidence: string[];
    assertion?: 'observation' | 'increase' | 'decrease' | 'highest';
  }[];
  actions: Action[];
  internal: string;
  citizen: string;
  translated: string;
  internalTranslated?: string;
};
export type Baseline = { context: Context; dataset: Dataset };
export type FollowUp = {
  id: string;
  title: string;
  owner: string;
  location: string;
  status: string;
  note: string;
};
export type Snapshot = {
  version: 1 | 2;
  id: string;
  created: string;
  context: Context;
  dataset: Dataset;
  metrics: Metric[];
  narrative: Narrative;
  mode: 'sample' | 'live';
  baseline?: Baseline;
  statuses: Record<string, string>;
  notes: Record<string, string>;
  legacyLanguage?: 'Marathi';
  model?: string;
  promptVersion?: string;
  followUp?: FollowUp[];
};
export const DEFAULT_CONTEXT: Context = {
  locality: 'Bhopal · Demo neighbourhood',
  timezone: 'Asia/Kolkata',
  role: 'Ward officer',
  language: 'Hindi',
  level: 'Simple',
};
export const GUIDANCE = {
  title: 'WHO · Personal interventions and risk communication (2024)',
  url: 'https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication',
  reviewed: '2026-11-14',
  advice:
    'Consider less polluted times and places for outdoor activity. Children, older adults and people with heart or lung conditions may need additional exposure precautions. Follow local public-health advice.',
};
