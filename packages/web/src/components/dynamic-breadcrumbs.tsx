'use client';

import { useParams, usePathname } from 'next/navigation';
import { Breadcrumbs } from './display-utils/breadcrumbs';

export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const params = useParams();

  const breadcrumbs = [];

  // Always add home
  breadcrumbs.push({ label: 'Runs', href: '/' });

  // Parse pathname to build breadcrumbs
  if (pathname.startsWith('/run/')) {
    const runId = params.runId as string;
    if (runId) {
      breadcrumbs.push({ label: runId, href: `/run/${runId}` });

      // Check if we're in streams view
      if (pathname.includes('/streams/')) {
        const streamId = params.streamId as string;
        breadcrumbs.push({ label: 'Streams', href: `/run/${runId}` });
        if (streamId) {
          breadcrumbs.push({
            label: streamId,
            href: `/run/${runId}/streams/${streamId}`,
          });
        }
      }
    }
  }

  return <Breadcrumbs items={breadcrumbs} />;
}
