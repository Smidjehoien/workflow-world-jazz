'use client';

import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStep } from '@/hooks/use-api';
import { getResourceName } from '@/lib/resource-name';
import { extractStreamIds } from '@/lib/stream-utils';
import { formatDuration } from '@/lib/utils';
import type { WorldConfig } from '@/lib/world';
import { JsonView } from '../display-utils/json-view';
import { RelativeTime } from '../display-utils/relative-time';
import { SidePanel } from '../display-utils/side-panel';
import { StatusBadge } from '../display-utils/status-badge';

interface StepDetailSidebarProps {
  config: WorldConfig;
  runId: string;
  stepId: string;
  onClose: () => void;
  onStreamClick: (streamId: string) => void;
}

export function StepDetailSidebar({
  config,
  runId,
  stepId,
  onClose,
  onStreamClick,
}: StepDetailSidebarProps) {
  const { data: step, isLoading: loading } = useStep(config, runId, stepId);

  if (loading) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Step Details">
        <div className="text-center py-8">Loading...</div>
      </SidePanel>
    );
  }

  if (!step) {
    return (
      <SidePanel isOpen={true} onClose={onClose} title="Step Details">
        <div className="text-center py-8">Step not found</div>
      </SidePanel>
    );
  }

  // Extract stream IDs from step input and output
  const streamIds = new Set<string>();
  extractStreamIds(step.input).forEach((id) => streamIds.add(id));
  extractStreamIds(step.output).forEach((id) => streamIds.add(id));
  const streamList = Array.from(streamIds);

  // Calculate duration if both started and completed
  const duration = formatDuration(step.startedAt, step.completedAt);

  return (
    <SidePanel isOpen={true} onClose={onClose} title="Step Details">
      <div className="space-y-6">
        {/* Step Overview */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Step ID</div>
                <div className="font-mono text-xs">{step.stepId}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Step Name</div>
                <div>{getResourceName(step.stepName)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div>
                  <StatusBadge status={step.status} context={step} />
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Attempt</div>
                <div>{step.attempt}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Started</div>
                <div>
                  {step.startedAt ? (
                    <RelativeTime date={step.startedAt} />
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Completed</div>
                <div>
                  {step.completedAt ? (
                    <RelativeTime date={step.completedAt} />
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              {duration !== null && (
                <div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div>{duration}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stream IDs List */}
        {streamList.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold mb-3">Streams</h3>
              <div className="space-y-2">
                {streamList.map((streamId) => (
                  <Button
                    key={streamId}
                    variant="outline"
                    size="sm"
                    onClick={() => onStreamClick(streamId)}
                    className="w-full justify-between font-mono text-xs"
                  >
                    <span className="truncate">{streamId}</span>
                    <Radio className="h-3 w-3 ml-2 flex-shrink-0" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* JSON Details */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Full Details (JSON)</h3>
          <JsonView data={step} showCard={false} />
        </div>
      </div>
    </SidePanel>
  );
}
