import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function RunTraceViewLoadingSkeleton() {
  // Layout constants matching run-trace-view.tsx
  const BAR_HEIGHT_PX = 16;
  const ROW_GAP_PX = 8;
  const LEFT_PANE_WIDTH_PX = 180;
  const HEADER_HEIGHT_PX = 32;
  const MAX_CHART_HEIGHT_PX = 512;
  const rowCount = 8; // Run + 7 example steps

  const totalHeight = rowCount * (BAR_HEIGHT_PX + ROW_GAP_PX) + 40;
  const totalWidth = LEFT_PANE_WIDTH_PX + 800; // Default chart width

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="text-sm text-muted-foreground mb-2">Timeline</div>
        <div
          className="bg-muted/20 rounded-lg border overflow-hidden"
          style={{
            maxHeight: `${MAX_CHART_HEIGHT_PX}px`,
            minHeight: `${totalHeight + HEADER_HEIGHT_PX + 4}px`,
          }}
        >
          <div
            className="relative"
            style={{
              width: `${totalWidth}px`,
              height: `${totalHeight}px`,
            }}
          >
            {/* Header skeleton */}
            <div className="sticky top-0 h-8 border-b border-border/50 bg-muted/20 flex items-center px-4 gap-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-8" />
            </div>

            {/* Bar skeletons with varying widths to simulate timeline */}
            <div className="p-4 space-y-2">
              {Array.from({ length: rowCount }).map((_, idx) => {
                const barId = `bar-row-${String(idx)}`;
                return (
                  <div key={barId} className="flex items-center">
                    {/* Left name section skeleton */}
                    <Skeleton
                      className="rounded flex-shrink-0"
                      style={{
                        width: `${LEFT_PANE_WIDTH_PX}px`,
                        height: `${BAR_HEIGHT_PX}px`,
                        marginRight: '8px',
                      }}
                    />
                    {/* Timeline bar skeleton */}
                    <Skeleton
                      style={{
                        height: `${BAR_HEIGHT_PX}px`,
                        width: `${60 + idx * 5}%`,
                        marginTop: `${ROW_GAP_PX / 2}px`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
