import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNight } from './reader.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number> & { badLines: number };

export function countLines(text: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, badLines: 0 };
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const row = parseNight('', line).rows[0];
    if (row) counts[row.lastStatus]++;
    else counts.badLines++;
  }
  return counts;
}

export function countNight(runsDir: string, night: string): NightCounts | null {
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
