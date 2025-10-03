'use client';

import { useRouter } from 'next/navigation';
import { RunsTable } from '@/components/runs/runs-table';
import { useConfig } from '@/hooks/use-config';

export default function Home() {
  const router = useRouter();
  const config = useConfig();

  return (
    <RunsTable
      config={config}
      onRunClick={(runId) => router.push(`/run/${runId}`)}
      onStreamClick={(runId, streamId) =>
        router.push(`/run/${runId}/streams/${streamId}`)
      }
    />
  );
}
