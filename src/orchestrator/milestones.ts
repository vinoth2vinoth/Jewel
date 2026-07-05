import * as fs from 'fs';
import * as path from 'path';
import { AgentAdapter } from '../agents/adapter';
import { getBlueprint } from '../scaffold/blueprints';

export interface Milestone {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  sessionId?: string;
  error?: string;
}

export interface MilestoneValidationResult {
  valid: boolean;
  errors: string[];
  milestones: Milestone[];
}

const MAX_MILESTONES = 12;
const MAX_TITLE_LENGTH = 300;

/**
 * Validate an untrusted milestone list (e.g. LLM output or a state file)
 * into a well-formed, bounded set of milestones.
 */
export function validateMilestones(parsed: unknown, maxMilestones = MAX_MILESTONES): MilestoneValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(parsed)) {
    return { valid: false, errors: ['Milestones must be an array.'], milestones: [] };
  }
  if (parsed.length === 0) {
    return { valid: false, errors: ['Milestone list is empty.'], milestones: [] };
  }
  if (parsed.length > maxMilestones) {
    errors.push(`Milestone count ${parsed.length} exceeds limit ${maxMilestones}; extra entries dropped.`);
  }

  const milestones: Milestone[] = [];
  const seen = new Set<string>();

  for (const entry of parsed.slice(0, maxMilestones)) {
    let title: string | null = null;
    if (typeof entry === 'string') {
      title = entry;
    } else if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).title === 'string') {
      title = (entry as Record<string, unknown>).title as string;
    }

    if (!title || title.trim().length < 5) {
      errors.push(`Skipped invalid milestone entry: ${JSON.stringify(entry).slice(0, 80)}`);
      continue;
    }

    const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    milestones.push({
      id: milestones.length + 1,
      title: trimmed,
      status: 'pending'
    });
  }

  if (milestones.length === 0) {
    return { valid: false, errors: [...errors, 'No valid milestones after validation.'], milestones: [] };
  }

  return { valid: true, errors, milestones };
}

/**
 * Deterministic decomposition: split a plain-language goal on feature
 * connectors into ordered milestones. Always available (no LLM required).
 */
export function decomposeGoalHeuristic(goal: string): Milestone[] {
  const cleaned = goal.trim().replace(/\s+/g, ' ');

  const parts = cleaned
    .split(/(?:,|;| and then | then | plus | also | with the ability to | as well as )/i)
    .map(p => p.trim())
    .filter(p => p.length >= 5);

  const titles: string[] = [];
  if (parts.length <= 1) {
    titles.push(`Implement: ${cleaned}`);
    titles.push(`Add tests covering the main behavior of: ${cleaned}`);
  } else {
    const [first, ...rest] = parts;
    titles.push(`Implement the core feature: ${first}`);
    for (const part of rest) {
      titles.push(`Add feature: ${part}`);
    }
    titles.push('Add or extend tests so all implemented features are covered');
  }

  const { milestones } = validateMilestones(titles);
  return milestones;
}

/** Read the blueprint marker written at scaffold time, if present. */
export function readBlueprintMarker(cwd: string): string | null {
  const markerPath = path.join(cwd, '.jewel', 'blueprint.json');
  if (!fs.existsSync(markerPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    return typeof parsed.blueprintId === 'string' ? parsed.blueprintId : null;
  } catch {
    return null;
  }
}

export interface MilestonePlanResult {
  milestones: Milestone[];
  source: 'blueprint' | 'llm' | 'heuristic';
  warnings: string[];
}

/**
 * Produce the milestone plan for a build:
 * 1. Blueprint starter milestones when no custom goal is given in a scaffolded project.
 * 2. LLM decomposition when the adapter supports it (schema-validated, heuristic fallback).
 * 3. Heuristic decomposition otherwise.
 */
export async function planMilestones(
  cwd: string,
  goal: string | undefined,
  adapter: AgentAdapter | null,
  maxMilestones = MAX_MILESTONES
): Promise<MilestonePlanResult> {
  const warnings: string[] = [];

  if (!goal || goal.trim() === '') {
    const blueprintId = readBlueprintMarker(cwd);
    const blueprint = blueprintId ? getBlueprint(blueprintId) : null;
    if (blueprint) {
      const { milestones } = validateMilestones(blueprint.milestones, maxMilestones);
      return { milestones, source: 'blueprint', warnings };
    }
    throw new Error('No project goal given and no blueprint marker found. Provide a goal: jewel build "your project description"');
  }

  if (adapter && typeof adapter.generateMilestones === 'function') {
    try {
      const raw = await adapter.generateMilestones({ goal, maxMilestones });
      const result = validateMilestones(raw, maxMilestones);
      if (result.valid) {
        warnings.push(...result.errors);
        return { milestones: result.milestones, source: 'llm', warnings };
      }
      warnings.push(`LLM milestone plan failed validation (${result.errors.join('; ')}). Falling back to heuristic decomposition.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`LLM milestone generation failed (${msg}). Falling back to heuristic decomposition.`);
    }
  }

  return { milestones: decomposeGoalHeuristic(goal).slice(0, maxMilestones), source: 'heuristic', warnings };
}
