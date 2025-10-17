'use client';
import { DeviceAlternate, Moon, Sun } from '@vercel/geist/icons';
import { cva } from 'class-variance-authority';
import { useTheme } from 'next-themes';
import { type HTMLAttributes, useLayoutEffect, useState } from 'react';
import { cn } from '../lib/cn';

const itemVariants = cva('', {
  variants: {
    active: {
      true: 'bg-background text-foreground ring-1 ring-border',
      false: 'text-muted-foreground',
    },
  },
});

const full = [
  ['system', DeviceAlternate] as const,
  ['light', Sun] as const,
  ['dark', Moon] as const,
];

export function ThemeToggle({
  className,
  mode = 'light-dark',
  ...props
}: HTMLAttributes<HTMLElement> & {
  mode?: 'light-dark' | 'light-dark-system';
}) {
  const { theme, setTheme } = useTheme();

  const container = cn(
    'inline-flex items-center rounded-full border',
    className
  );

  return (
    <div className={container} data-theme-toggle="" {...props}>
      {full.map(([key, Icon]) => (
        <button
          className={cn(
            'size-8 rounded-full p-2 text-muted-foreground',
            itemVariants({ active: (theme ?? 'system') === key })
          )}
          key={key}
          onClick={() => setTheme(key)}
          type="button"
        >
          <Icon className="size-full" />
        </button>
      ))}
    </div>
  );
}
