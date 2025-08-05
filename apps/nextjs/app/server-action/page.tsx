'use client';
import { callWorkflow } from './actions';

export default function Page() {
  return (
    <>
      <p>server-action calling workflow</p>
      <button
        onClick={async () => {
          callWorkflow().then(console.log);
        }}
        type="button"
      >
        click me
      </button>
    </>
  );
}
