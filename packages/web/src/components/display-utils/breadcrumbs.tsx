'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  items: Breadcrumb[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm mb-6">
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1;
        const isId =
          crumb.label.includes('_') || crumb.label.startsWith('strm_');
        const labelClass = isId ? 'font-mono text-xs' : '';

        return (
          <div
            key={`${crumb.href}-${crumb.label}`}
            className="flex items-center"
          >
            {index > 0 && (
              <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
            {isLast ? (
              <span className={`font-semibold ${labelClass}`}>
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className={`text-muted-foreground hover:text-foreground transition-colors ${labelClass}`}
              >
                {crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
