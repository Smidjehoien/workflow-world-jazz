import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';
import InstallCommandTabs from '@/components/install-command-tabs';
import * as CalloutComponents from '@/components/ui/callout';
import * as CardComponents from '@/components/ui/card';
import { CodeBlock } from '@/components/ui/code-block';
import * as TabsComponents from '@/components/ui/tabs';
import { TypeTable } from '@/components/ui/type-table';

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
    p: ({ ref: _ref, ...props }) => (
      <p
        {...props}
        className={`text-muted-foreground ${props.className || ''}`}
      >
        {props.children}
      </p>
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
