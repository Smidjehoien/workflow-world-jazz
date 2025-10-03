'use client';

import { TooltipProvider } from '@radix-ui/react-tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConnectionStatus } from '@/components/display-utils/connection-status';
import { DynamicBreadcrumbs } from '@/components/dynamic-breadcrumbs';
import { SettingsSidebar } from '@/components/settings-sidebar';
import { ConfigProvider } from '@/hooks/use-config';
import type { WorldConfig } from '@/lib/world';

interface LayoutClientProps {
  children: React.ReactNode;
  initialConfig: WorldConfig;
}

export function LayoutClient({ children, initialConfig }: LayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const runId = searchParams.get('runId');
  const resource = searchParams.get('resource');
  const [config, setConfig] = useState<WorldConfig>(() => {
    // Override initial config with query parameters from CLI
    const configFromParams: WorldConfig = { ...initialConfig };

    const backend = searchParams.get('backend');
    const env = searchParams.get('env');
    const authToken = searchParams.get('authToken');
    const project = searchParams.get('project');
    const team = searchParams.get('team');
    const port = searchParams.get('port');
    const dataDir = searchParams.get('dataDir');

    if (backend) configFromParams.backend = backend;
    if (env) configFromParams.env = env;
    if (authToken) configFromParams.authToken = authToken;
    if (project) configFromParams.project = project;
    if (team) configFromParams.team = team;
    if (port) configFromParams.port = port;
    if (dataDir) configFromParams.dataDir = dataDir;

    return configFromParams;
  });

  // If initialized with a resource/id, we navigate to the appropriate page
  useEffect(() => {
    if (!resource || !id) {
      return;
    }

    if (resource === 'run') {
      router.push(`/run/${id}`);
    } else if (resource === 'step' && runId) {
      router.push(`/run/${runId}?sidebar=step&stepId=${id}`);
    } else if (resource === 'stream' && runId) {
      router.push(`/run/${runId}?sidebar=stream&streamId=${id}`);
    } else if (resource === 'event' && runId) {
      router.push(`/run/${runId}?sidebar=event&eventId=${id}`);
    } else {
      console.warn(`Can't deep-link to ${resource} ${id}.`);
    }
  }, [resource, id, runId, router?.push]);

  return (
    <ConfigProvider config={config}>
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">
                Workflow Observability UI
              </h1>
              <ConnectionStatus config={config} />
            </div>
            <SettingsSidebar config={config} onConfigChange={setConfig} />
          </div>

          <DynamicBreadcrumbs />

          <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
        </div>
      </div>
    </ConfigProvider>
  );
}
