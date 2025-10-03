'use client';

import { formatDistanceToNow, formatRelative } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RelativeTimeProps {
  date: Date;
  className?: string;
  type?: 'relative' | 'distance';
}

export function RelativeTime({
  date,
  className = '',
  type = 'relative',
}: RelativeTimeProps) {
  const relativeTime =
    type === 'relative'
      ? formatRelative(new Date(date), new Date())
      : formatDistanceToNow(new Date(date), { addSuffix: true });
  const absoluteTime = new Date(date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${className} cursor-help border-b border-dotted`}>
          {relativeTime}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{absoluteTime}</p>
      </TooltipContent>
    </Tooltip>
  );
}
