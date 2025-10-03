'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  title?: string;
  rows?: number;
}

export function TableSkeleton({ title, rows = 10 }: TableSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          {title ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <Skeleton className="h-6 w-48" />
          )}
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" style={{ minHeight: '512px' }}>
          {/* Table header skeleton */}
          <div className="flex gap-4 pb-3 border-b">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6" />
          </div>

          {/* Table rows skeleton */}
          {Array.from({ length: rows }, (_, i) => (
            <div key={`skeleton-row-${i}`} className="flex gap-4 py-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
