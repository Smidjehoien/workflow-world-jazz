'use client';

import { useParams } from 'next/navigation';
import { StreamDetailView } from '@/components/detail-views';
import { ErrorBoundary } from '@/components/error-boundary';
import { useQueryParamConfig } from '@/lib/config';

export default function StreamDetailPage() {
  const params = useParams();
  const config = useQueryParamConfig();

  const streamId = params.streamId as string;

  return (
    <ErrorBoundary
      title="Stream Error"
      description="Failed to load stream data. Please try navigating back and selecting the stream again."
    >
      <StreamDetailView config={config} streamId={streamId} />
    </ErrorBoundary>
  );
}
