import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StepsTimelineLoadingSkeleton() {
  const rowCount = 8; // Run + 7 example steps
  const BAR_HEIGHT_PX = 16;
  const ROW_GAP_PX = 8;

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <Skeleton className="h-4 w-48 mb-2" />
        <div className="bg-muted/20 rounded-lg border overflow-hidden">
          <div className="p-4 space-y-2">
            {/* Run bar - full width */}
            <Skeleton
              className="w-full"
              style={{ height: `${BAR_HEIGHT_PX}px` }}
            />
            {/* Step bars - varying widths */}
            {Array.from({ length: rowCount - 1 }, (_, i) => `step-${i}`).map(
              (key, i) => (
                <Skeleton
                  key={key}
                  style={{
                    height: `${BAR_HEIGHT_PX}px`,
                    width: `${60 + i * 5}%`,
                    marginTop: `${ROW_GAP_PX}px`,
                  }}
                />
              )
            )}
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
