import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Profile {
  name: string;
  about: string;
  heightCm?: string;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  bmi?: number;
  build?: string;
  goals: string[];
  baselines: Record<string, string>;
  equipment: string[];
  schedule: string;
  constraints: string[];
  notes: string[];
}

const FALLBACK: Profile = {
  name: 'there',
  about: '',
  goals: [],
  baselines: {},
  equipment: [],
  schedule: '',
  constraints: [],
  notes: []
};

function read(file: string): Profile | null {
  try {
    const p = resolve(process.cwd(), 'data', file);
    return JSON.parse(readFileSync(p, 'utf8')) as Profile;
  } catch {
    return null;
  }
}

let cached: Profile | null = null;

/** Loads your private profile if present, otherwise the committed template. */
export function getProfile(): Profile {
  if (cached) return cached;
  cached = read('profile.local.json') ?? read('profile.example.json') ?? FALLBACK;
  return cached;
}

/** Human-readable block for injecting into the coach's context. */
export function profileSummary(p: Profile): string {
  const lines: string[] = [];
  lines.push(`Name: ${p.name}.${p.about ? ' ' + p.about : ''}`);
  const stats: string[] = [];
  if (p.heightCm) stats.push(`height ${p.heightCm}`);
  if (p.weightKg) stats.push(`weight ${p.weightKg}kg`);
  if (p.bodyFatPct) stats.push(`body fat ${p.bodyFatPct}%`);
  if (p.muscleMassKg) stats.push(`muscle ${p.muscleMassKg}kg`);
  if (p.bmi) stats.push(`BMI ${p.bmi}`);
  if (p.build) stats.push(`${p.build} build`);
  if (stats.length) lines.push(`Stats: ${stats.join(', ')}.`);
  if (p.goals.length) lines.push(`Goals: ${p.goals.join('; ')}.`);
  const base = Object.entries(p.baselines).map(([k, v]) => `${k} ${v}`);
  if (base.length) lines.push(`Baselines: ${base.join(', ')}.`);
  if (p.equipment.length) lines.push(`Equipment: ${p.equipment.join(', ')}.`);
  if (p.schedule) lines.push(`Schedule: ${p.schedule}.`);
  if (p.constraints.length) lines.push(`Constraints: ${p.constraints.join('; ')}.`);
  if (p.notes.length) lines.push(`Notes: ${p.notes.join('; ')}.`);
  return lines.join('\n');
}
