'use client';

import { useParams } from 'next/navigation';
import { StreamDetailView } from '@/components/detail-views';
import { useQueryParamConfig } from '@/lib/config';

export default function StreamDetailPage() {
  const params = useParams();
  const config = useQueryParamConfig();

  const streamId = params.streamId as string;

  return <StreamDetailView config={config} streamId={streamId} />;
}
