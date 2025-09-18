import type { MDXComponents } from 'mdx/types';
import * as CalloutComponents from '@/components/ui/callout';
import * as CardComponents from '@/components/ui/card';
import { CodeBlock } from '@/components/ui/code-block';
import * as TabsComponents from '@/components/ui/tabs';
import { TypeTable } from '@/components/ui/type-table';
import InstallCommandTabs from '@/components/install-command-tabs';
import Link from 'next/link';

// use this function to get MDX components, you will need it for rendering MDX
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    TypeTable,
    InstallCommandTabs,
    ...TabsComponents,
    ...CardComponents,
    ...CalloutComponents,
    li: ({ ref: _ref, ...props }) => (
      <li {...props} className="prose">
        {props.children}
      </li>
    ),
    pre: CodeBlock,
    ...components,
    ...(components?.a && {
      a: ({ className, ...props }) => (
        <Link
          {...props}
          className={`font-normal no-underline text-primary-foreground ${className || ''}`}
        />
      ),
    }),
  };
}
