'use client';

import { useParams, usePathname } from 'next/navigation';
import { buildUrlWithConfig, useQueryParamConfig } from '@/lib/config';
import { Breadcrumbs } from './display-utils/breadcrumbs';

export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  const params = useParams();
  const config = useQueryParamConfig();

  const breadcrumbs = [];

  // Always add home
  breadcrumbs.push({ label: 'Runs', href: buildUrlWithConfig('/', config) });

  // Parse pathname to build breadcrumbs
  if (pathname.startsWith('/run/')) {
    const runId = params.runId as string;
    if (runId) {
      breadcrumbs.push({
        label: runId,
        href: buildUrlWithConfig(`/run/${runId}`, config),
      });

      // Check if we're in streams view
      if (pathname.includes('/streams/')) {
        const streamId = params.streamId as string;
        breadcrumbs.push({
          label: 'Streams',
          href: buildUrlWithConfig(`/run/${runId}`, config),
        });
        if (streamId) {
          breadcrumbs.push({
            label: streamId,
            href: buildUrlWithConfig(
              `/run/${runId}/streams/${streamId}`,
              config
            ),
          });
        }
      }
    }
  }

  return <Breadcrumbs items={breadcrumbs} />;
}
