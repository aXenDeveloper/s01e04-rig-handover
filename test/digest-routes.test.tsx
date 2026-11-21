import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type JsonDigest = { night: string; rows: { job: string }[]; badLines: number };

const normalNight = '2026-10-28';
const emptyNight = '2026-10-29';
const badNight = '2026-10-30';
const missingNight = '2026-01-01';

const normalJobs = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'];

const runLine = (at: string, job: string, status: string, owner: string | null, error: string | null = null) =>
  JSON.stringify({ at, job, status, owner, error });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(path.join(os.tmpdir(), 'rig-runs-'));
  writeFileSync(
    path.join(runsDir, `${normalNight}.jsonl`),
    [
      runLine('2026-10-28T23:00:06+01:00', 'lane/sync', 'ok', 'lane-07'),
      runLine('2026-10-28T23:10:00+01:00', 'fixtures/refresh', 'retry', 'lane-07', 'upstream 503'),
      runLine('2026-10-28T23:20:00+01:00', 'fixtures/refresh', 'retry', 'lane-07', 'upstream 503'),
      runLine('2026-10-28T23:30:00+01:00', 'fixtures/refresh', 'retry', 'lane-07', 'upstream 503'),
      runLine('2026-10-28T23:40:00+01:00', 'fixtures/refresh', 'ok', 'lane-07'),
      runLine('2026-10-28T02:00:00+01:00', 'notes/backup', 'fail', 'lane-07', 'quota exceeded'),
      runLine('2026-10-28T03:00:00+01:00', 'digest/render', 'ok', null),
    ].join('\n'),
  );
  writeFileSync(path.join(runsDir, `${emptyNight}.jsonl`), '');
  writeFileSync(
    path.join(runsDir, `${badNight}.jsonl`),
    [
      runLine('2026-10-30T23:00:06+01:00', 'lane/sync', 'ok', 'lane-07'),
      'this is not json',
      runLine('2026-10-30T03:00:00+01:00', 'digest/render', 'ok', null),
    ].join('\n'),
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const rowFor = (html: string, job: string) => {
  const at = html.indexOf(job);
  return html.slice(html.lastIndexOf('<tr', at), html.indexOf('</tr>', at));
};

describe('GET /digest/:night', () => {
  it('answers 200 for a night with a file', async () => {
    const res = await app.request(`/digest/${normalNight}`);
    expect(res.status).toBe(200);
  });

  it('lists every job name', async () => {
    const html = await (await app.request(`/digest/${normalNight}`)).text();
    for (const job of normalJobs) expect(html).toContain(job);
  });

  it('marks rows with three or more retries, or a failing last status, as warn', async () => {
    const html = await (await app.request(`/digest/${normalNight}`)).text();
    expect(rowFor(html, 'fixtures/refresh')).toContain('class="warn"');
    expect(rowFor(html, 'notes/backup')).toContain('class="warn"');
    expect(rowFor(html, 'lane/sync')).not.toContain('class="warn"');
  });

  it('renders a null owner as an em dash', async () => {
    const html = await (await app.request(`/digest/${normalNight}`)).text();
    expect(rowFor(html, 'digest/render')).toContain('—');
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request(`/digest/${emptyNight}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request(`/digest/${missingNight}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with night, rows and badLines', async () => {
    const res = await app.request(`/api/digest/${normalNight}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonDigest;
    expect(body.night).toBe(normalNight);
    expect(body.rows.map((r) => r.job)).toEqual(normalJobs);
    expect(body.badLines).toBe(0);
  });

  it('sorts rows by job', async () => {
    const body = (await (await app.request(`/api/digest/${normalNight}`)).json()) as JsonDigest;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort((a, b) => a.localeCompare(b)));
  });

  it('answers 200 with no rows and zero bad lines for an empty night', async () => {
    const res = await app.request(`/api/digest/${emptyNight}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await app.request(`/api/digest/${missingNight}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });
});

describe('a night with a bad line', () => {
  it('still answers 200 on the page', async () => {
    const res = await app.request(`/digest/${badNight}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('lane/sync');
  });

  it('still answers 200 on the JSON and counts one bad line', async () => {
    const res = await app.request(`/api/digest/${badNight}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonDigest;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request(`/digest/${normalNight}`)).text();
    const body = (await (await app.request(`/api/digest/${normalNight}`)).json()) as JsonDigest;
    const jsonOrder = body.rows.map((r) => r.job);
    const pageOrder = [...jsonOrder].sort((a, b) => html.indexOf(a) - html.indexOf(b));
    expect(pageOrder).toEqual(jsonOrder);
  });
});
