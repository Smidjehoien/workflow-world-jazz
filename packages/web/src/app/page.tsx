'use client';

import { useRouter } from 'next/navigation';
import { RunsTable } from '@/components/runs/runs-table';
import { buildUrlWithConfig, useQueryParamConfig } from '@/lib/config';

export default function Home() {
  const router = useRouter();
  const config = useQueryParamConfig();

  return (
    <RunsTable
      config={config}
      onRunClick={(runId) =>
        router.push(buildUrlWithConfig(`/run/${runId}`, config))
      }
      onStreamClick={(runId, streamId) =>
        router.push(
          buildUrlWithConfig(`/run/${runId}/streams/${streamId}`, config)
        )
      }
    />
  );
}
