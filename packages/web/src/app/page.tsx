'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ErrorBoundary } from '@/components/error-boundary';
import { HooksTableWithData } from '@/components/hooks/hooks-table-with-data';
import { RunsTable } from '@/components/runs/runs-table';
import { buildUrlWithConfig, useQueryParamConfig } from '@/lib/config';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = useQueryParamConfig();

  const sidebar = searchParams.get('sidebar');
  const hookId = searchParams.get('hookId') || searchParams.get('hook');
  const selectedHookId = sidebar === 'hook' && hookId ? hookId : undefined;

  const handleRunClick = (runId: string, streamId?: string) => {
    if (!streamId) {
      router.push(buildUrlWithConfig(`/run/${runId}`, config));
    } else {
      router.push(
        buildUrlWithConfig(`/run/${runId}/streams/${streamId}`, config)
      );
    }
  };

  const handleHookSelect = (hookId: string | undefined) => {
    if (hookId) {
      router.push(
        buildUrlWithConfig('/', config, {
          sidebar: 'hook',
          hookId,
        })
      );
    } else {
      router.push(buildUrlWithConfig('/', config));
    }
  };

  return (
    <div className="space-y-6">
      <ErrorBoundary
        title="Runs Error"
        description="Failed to load workflow runs. Please try refreshing the page."
      >
        <RunsTable
          config={config}
          onRunClick={handleRunClick}
          onStreamClick={handleRunClick}
        />
      </ErrorBoundary>

      <ErrorBoundary
        title="Hooks Error"
        description="Failed to load hooks. Please try refreshing the page."
      >
        <HooksTableWithData
          config={config}
          onHookClick={handleHookSelect}
          selectedHookId={selectedHookId}
          onCloseDetailSidebar={() => handleHookSelect(undefined)}
        />
      </ErrorBoundary>
    </div>
  );
}
