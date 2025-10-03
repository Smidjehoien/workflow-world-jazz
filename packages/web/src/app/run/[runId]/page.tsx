'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RunDetailView } from '@/components/runs/run-detail-view';
import { useConfig } from '@/hooks/use-config';

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const config = useConfig();

  const runId = params.runId as string;
  const sidebar = searchParams.get('sidebar');
  const stepId = searchParams.get('stepId') || searchParams.get('step');
  const eventId = searchParams.get('eventId') || searchParams.get('event');

  const selectedStepId = sidebar === 'step' && stepId ? stepId : undefined;
  const selectedEventId = sidebar === 'event' && eventId ? eventId : undefined;

  const handleStepSelect = (stepId: string | undefined) => {
    if (stepId) {
      router.push(`/run/${runId}?sidebar=step&stepId=${stepId}`);
    } else {
      router.push(`/run/${runId}`);
    }
  };

  const handleEventSelect = (eventId: string | undefined) => {
    if (eventId) {
      router.push(`/run/${runId}?sidebar=event&eventId=${eventId}`);
    } else {
      router.push(`/run/${runId}`);
    }
  };

  const handleStreamClick = (streamId: string) => {
    router.push(`/run/${runId}/streams/${streamId}`);
  };

  return (
    <RunDetailView
      config={config}
      runId={runId}
      selectedStepId={selectedStepId}
      selectedEventId={selectedEventId}
      onStepSelect={handleStepSelect}
      onEventSelect={handleEventSelect}
      onStreamClick={handleStreamClick}
    />
  );
}
