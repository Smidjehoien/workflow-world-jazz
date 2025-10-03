'use client';

import { useParams } from 'next/navigation';
import { StreamDetailView } from '@/components/detail-views';
import { useConfig } from '@/hooks/use-config';

export default function StreamDetailPage() {
  const params = useParams();
  const config = useConfig();

  const streamId = params.streamId as string;

  return <StreamDetailView config={config} streamId={streamId} />;
}
