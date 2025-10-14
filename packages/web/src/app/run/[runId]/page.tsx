'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RunDetailView } from '@/components/runs/run-detail-view';
import { buildUrlWithConfig, useQueryParamConfig } from '@/lib/config';

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const config = useQueryParamConfig();

  const runId = params.runId as string;
  const sidebar = searchParams.get('sidebar');
  const stepId = searchParams.get('stepId') || searchParams.get('step');
  const eventId = searchParams.get('eventId') || searchParams.get('event');
  const hookId = searchParams.get('hookId') || searchParams.get('hook');

  const selectedStepId = sidebar === 'step' && stepId ? stepId : undefined;
  const selectedEventId = sidebar === 'event' && eventId ? eventId : undefined;
  const selectedHookId = sidebar === 'hook' && hookId ? hookId : undefined;

  const handleStepSelect = (stepId: string | undefined) => {
    if (stepId) {
      router.push(
        buildUrlWithConfig(`/run/${runId}`, config, { sidebar: 'step', stepId })
      );
    } else {
      router.push(buildUrlWithConfig(`/run/${runId}`, config));
    }
  };

  const handleEventSelect = (eventId: string | undefined) => {
    if (eventId) {
      router.push(
        buildUrlWithConfig(`/run/${runId}`, config, {
          sidebar: 'event',
          eventId,
        })
      );
    } else {
      router.push(buildUrlWithConfig(`/run/${runId}`, config));
    }
  };

  const handleHookSelect = (hookId: string | undefined) => {
    if (hookId) {
      router.push(
        buildUrlWithConfig(`/run/${runId}`, config, {
          sidebar: 'hook',
          hookId,
        })
      );
    } else {
      router.push(buildUrlWithConfig(`/run/${runId}`, config));
    }
  };

  const handleStreamClick = (streamId: string) => {
    router.push(
      buildUrlWithConfig(`/run/${runId}/streams/${streamId}`, config)
    );
  };

  return (
    <RunDetailView
      config={config}
      runId={runId}
      selectedStepId={selectedStepId}
      selectedEventId={selectedEventId}
      selectedHookId={selectedHookId}
      onStepSelect={handleStepSelect}
      onEventSelect={handleEventSelect}
      onHookSelect={handleHookSelect}
      onStreamClick={handleStreamClick}
    />
  );
}
