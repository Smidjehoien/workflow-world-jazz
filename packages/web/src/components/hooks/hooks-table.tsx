'use client';

import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHooks } from '@/hooks/use-api';
import type { WorldConfig } from '@/lib/config-world';
import { DEFAULT_PAGE_SIZE } from '@/lib/utils';
import { PageSizeDropdown } from '../display-utils/page-size-dropdown';
import { RelativeTime } from '../display-utils/relative-time';
import { TableSkeleton } from '../display-utils/table-skeleton';
import { HookDetailSidebar } from './hook-detail-sidebar';

interface HooksTableProps {
  config: WorldConfig;
  runId?: string;
  onHookClick: (hookId: string) => void;
  selectedHookId?: string;
  onCloseDetailSidebar: () => void;
}

export function HooksTable({
  config,
  runId,
  onHookClick,
  selectedHookId,
  onCloseDetailSidebar,
}: HooksTableProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<number>(DEFAULT_PAGE_SIZE);

  const {
    data,
    error,
    loading,
    paginationDisplay,
    lastRefreshTime,
    handleNextPage,
    handlePrevPage,
    handleRefresh,
    canGoNext,
    canGoPrev,
  } = useHooks(config, runId, sortOrder, limit);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  // Show skeleton for initial load
  if (loading && !data) {
    return <TableSkeleton title="Hooks" />;
  }

  return (
    <Card>
      {selectedHookId && (
        <HookDetailSidebar
          config={config}
          hookId={selectedHookId}
          onClose={onCloseDetailSidebar}
        />
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Hooks</CardTitle>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {lastRefreshTime
                  ? `Last refreshed: ${lastRefreshTime.toLocaleTimeString()}`
                  : 'Refresh'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {!error && data && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hook ID</TableHead>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Owner ID</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSortOrder}
                      className="h-8 px-2 flex items-center gap-1"
                    >
                      Created At
                      {sortOrder === 'desc' ? (
                        <ArrowDownAZ className="h-4 w-4" />
                      ) : (
                        <ArrowUpAZ className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">Has Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((hook) => (
                  <TableRow
                    key={hook.hookId}
                    className={`cursor-pointer ${
                      selectedHookId === hook.hookId
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => onHookClick(hook.hookId)}
                  >
                    <TableCell className="font-mono text-xs">
                      {hook.hookId}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {hook.runId}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {hook.ownerId}
                    </TableCell>
                    <TableCell>
                      {hook.createdAt ? (
                        <RelativeTime date={hook.createdAt} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {(hook as any).response !== undefined ? (
                        <span className="text-green-600 dark:text-green-400">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {paginationDisplay}
              </div>

              <div className="flex items-center gap-2">
                <PageSizeDropdown value={limit} onChange={setLimit} />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={!canGoPrev || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!canGoNext || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
