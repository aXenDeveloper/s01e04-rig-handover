import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type RunLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

const isNight = (night: string) => /^\d{4}-\d{2}-\d{2}$/.test(night);

function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'string' || typeof v.job !== 'string' || typeof v.status !== 'string') return null;
  if (!STATUSES.includes(v.status)) return null;
  if (v.owner !== null && v.owner !== undefined && typeof v.owner !== 'string') return null;
  if (v.error !== undefined && v.error !== null && typeof v.error !== 'string') return null;
  return {
    at: v.at,
    job: v.job,
    status: v.status as RunStatus,
    owner: typeof v.owner === 'string' ? v.owner : null,
    error: typeof v.error === 'string' ? v.error : null,
  };
}

function readText(runsDir: string, night: string): string | null {
  try {
    return readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
}

function addRun(row: DigestRow | undefined, run: RunLine): DigestRow {
  if (!row) {
    return {
      job: run.job,
      owner: run.owner,
      runs: 1,
      retries: run.status === 'retry' ? 1 : 0,
      lastStatus: run.status,
      lastError: run.error,
      firstAt: run.at,
      lastAt: run.at,
    };
  }
  return {
    ...row,
    owner: run.owner ?? row.owner,
    runs: row.runs + 1,
    retries: row.retries + (run.status === 'retry' ? 1 : 0),
    lastStatus: run.status,
    lastError: run.error ?? row.lastError,
    lastAt: run.at,
  };
}

export function parseNight(night: string, text: string): Night {
  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const run = parseLine(line);
    if (!run) {
      badLines++;
      continue;
    }
    rows.set(run.job, addRun(rows.get(run.job), run));
  }
  return {
    night,
    rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)),
    badLines,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isNight(night)) return null;
  const text = readText(runsDir, night);
  return text === null ? null : parseNight(night, text);
};
