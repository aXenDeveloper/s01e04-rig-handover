import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

function isWarn(row: DigestRow) {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function DigestRowView(props: { row: DigestRow }) {
  const { row } = props;
  return (
    <tr class={isWarn(row) ? 'warn' : undefined}>
      <td>{row.job}</td>
      <td>{row.owner ?? dash}</td>
      <td>{row.runs}</td>
      <td>{row.retries}</td>
      <td>{row.lastStatus}</td>
      <td>{row.lastError ?? dash}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage(props: { night: Night }) {
  const { night } = props;
  return (
    <>
      <h1>{night.night}</h1>
      {night.badLines > 0 && <p class="mute">bad lines: {night.badLines}</p>}
      {night.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <DigestRowView row={row} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoRunLog(props: { night: string }) {
  return (
    <>
      <h1>{props.night}</h1>
      <p>no run log for that night</p>
    </>
  );
}
