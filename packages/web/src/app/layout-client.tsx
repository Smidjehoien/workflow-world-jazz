'use client';

import { TooltipProvider } from '@radix-ui/react-tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ConnectionStatus } from '@/components/display-utils/connection-status';
import { DynamicBreadcrumbs } from '@/components/dynamic-breadcrumbs';
import { SettingsSidebar } from '@/components/settings-sidebar';
import { buildUrlWithConfig, useQueryParamConfig } from '@/lib/config';

interface LayoutClientProps {
  children: React.ReactNode;
}

export function LayoutClient({ children }: LayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = useQueryParamConfig();

  const id = searchParams.get('id');
  const runId = searchParams.get('runId');
  const stepId = searchParams.get('stepId');
  const hookId = searchParams.get('hookId');
  const resource = searchParams.get('resource');

  // If initialized with a resource/id or direct ID params, we navigate to the appropriate page
  useEffect(() => {
    // Handle direct ID parameters (runId, stepId, hookId) without resource
    if (!resource) {
      if (runId) {
        // If we have a runId, open that run's detail view
        let targetUrl: string;
        if (stepId) {
          // Open run with step sidebar
          targetUrl = buildUrlWithConfig(`/run/${runId}`, config, {
            sidebar: 'step',
            stepId,
          });
        } else if (hookId) {
          // Open run with hook sidebar
          targetUrl = buildUrlWithConfig(`/run/${runId}`, config, {
            sidebar: 'hook',
            hookId,
          });
        } else {
          // Just open the run
          targetUrl = buildUrlWithConfig(`/run/${runId}`, config);
        }
        router.push(targetUrl);
        return;
      }
      // No resource and no direct params, nothing to do
      return;
    }

    // Handle resource-based navigation
    if (!id) {
      return;
    }

    let targetUrl: string;
    if (resource === 'run') {
      targetUrl = buildUrlWithConfig(`/run/${id}`, config);
    } else if (resource === 'step' && runId) {
      targetUrl = buildUrlWithConfig(`/run/${runId}`, config, {
        sidebar: 'step',
        stepId: id,
      });
    } else if (resource === 'stream' && runId) {
      targetUrl = buildUrlWithConfig(`/run/${runId}`, config, {
        sidebar: 'stream',
        streamId: id,
      });
    } else if (resource === 'event' && runId) {
      targetUrl = buildUrlWithConfig(`/run/${runId}`, config, {
        sidebar: 'event',
        eventId: id,
      });
    } else if (resource === 'hook' && runId) {
      targetUrl = buildUrlWithConfig(`/run/${runId}`, config, {
        sidebar: 'hook',
        hookId: id,
      });
    } else if (resource === 'hook' && !runId) {
      // Hook without runId - go to home page with hook sidebar
      targetUrl = buildUrlWithConfig('/', config, {
        sidebar: 'hook',
        hookId: id,
      });
    } else {
      console.warn(`Can't deep-link to ${resource} ${id}.`);
      return;
    }

    router.push(targetUrl);
  }, [resource, id, runId, stepId, hookId, router, config]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Workflow Observability UI
            </h1>
            <ConnectionStatus config={config} />
          </div>
          <SettingsSidebar />
        </div>

        <DynamicBreadcrumbs />

        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </div>
    </div>
  );
}
