import { describe, expect, it } from 'vitest';
import { parseNight, readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs and counts 1 bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('sums runs and retries and keeps the last status and error', () => {
    const refresh = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(night?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row whose owner is null', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('keeps the offset from the log', () => {
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });
});

describe('readNight edges', () => {
  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('returns null for a name that is not a night', () => {
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('reads an explicit null error as no error', () => {
    const line = JSON.stringify({ at: '2026-10-30T01:00:00+01:00', job: 'a', status: 'ok', owner: null, error: null });
    expect(parseNight('2026-10-30', line)).toMatchObject({ badLines: 0, rows: [{ job: 'a', lastError: null }] });
  });

  it('reads an empty night as no rows', () => {
    expect(parseNight('2026-10-30', '')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });
});
