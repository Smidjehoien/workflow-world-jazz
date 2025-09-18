'use client';
import type { PageTree } from 'fumadocs-core/server';
import { type ComponentProps, type ReactNode, useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { TreeContextProvider, useTreeContext } from 'fumadocs-ui/contexts/tree';
import Link from 'next/link';
import { useSidebar } from 'fumadocs-ui/contexts/sidebar';
import { cva } from 'class-variance-authority';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'fumadocs-ui/components/ui/collapsible';

export interface DocsLayoutProps {
  tree: PageTree.Root;
  children: ReactNode;
}

export function DocsLayout({ tree, children }: DocsLayoutProps) {
  return (
    <TreeContextProvider tree={tree}>
      <main
        id="nd-docs-layout"
        className="flex flex-1 flex-row [--fd-nav-height:56px] mt-8"
      >
        <Sidebar />
        {children}
      </main>
    </TreeContextProvider>
  );
}

export function NavbarSidebarTrigger(props: ComponentProps<'button'>) {
  const { open, setOpen } = useSidebar();

  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center p-2 rounded-md text-fd-muted-foreground hover:opacity-60 transition-opacity',
        props.className
      )}
      onClick={() => setOpen(!open)}
      aria-label="Toggle Sidebar"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

function Sidebar() {
  const { root } = useTreeContext();
  const { open, setOpen } = useSidebar();

  const children = useMemo(() => {
    function renderItems(items: PageTree.Node[]) {
      return items.map((item) => (
        <SidebarItem key={item.$id} item={item}>
          {item.type === 'folder' ? renderItems(item.children) : null}
        </SidebarItem>
      ));
    }

    return renderItems(root.children);
  }, [root]);

  return (
    <>
      {/* backdrop overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed flex flex-col shrink-0 px-4 pb-4 pt-12 top-14 z-20 text-sm overflow-auto md:sticky md:h-[calc(100dvh-56px)] md:w-[300px]',
          'max-md:inset-x-0 max-md:bottom-0 max-md:bg-fd-background',
          !open && 'max-md:invisible'
        )}
      >
        {children}
      </aside>
    </>
  );
}

const linkVariants = cva(
  'flex items-center gap-2 w-full py-1.5 rounded-lg text-fd-foreground/80 [&_svg]:size-4',
  {
    variants: {
      active: {
        true: 'text-primary-foreground',
        false: 'hover:text-fd-accent-foreground',
      },
    },
  }
);

function SidebarItem({
  item,
  children,
}: {
  item: PageTree.Node;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { setOpen: setSidebarOpen } = useSidebar();
  const [isOpen, setIsOpen] = useState(
    item.type === 'folder' && 'defaultOpen' in item && item.defaultOpen === true
  );

  // Close sidebar on mobile when link is clicked
  const handleLinkClick = () => {
    // Only close on mobile (md breakpoint is 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  if (item.type === 'page') {
    return (
      <Link
        href={item.url}
        className={linkVariants({
          active: pathname === item.url,
        })}
        onClick={handleLinkClick}
      >
        {item.icon}
        {item.name}
      </Link>
    );
  }

  if (item.type === 'separator') {
    return (
      <p className="text-fd-muted-foreground my-2 first:mt-0">
        {item.icon}
        {item.name}
      </p>
    );
  }

  // folder type
  const hasChildren = item.children && item.children.length > 0;

  // if folder has no children, just render as a link
  if (!hasChildren && item.index) {
    return (
      <Link
        href={item.index.url}
        className={linkVariants({
          active: pathname === item.index.url,
        })}
        onClick={handleLinkClick}
      >
        {item.index.icon}
        {item.index.name}
      </Link>
    );
  }

  // folder with children - make it collapsible
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div>
        {item.index ? (
          <div className="flex items-center gap-1">
            <Link
              className={cn(
                linkVariants({
                  active: pathname === item.index.url,
                }),
                'flex-1'
              )}
              href={item.index.url}
              onClick={handleLinkClick}
            >
              {item.index.icon}
              {item.index.name}
            </Link>
            <CollapsibleTrigger className="p-0.5">
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform',
                  !isOpen && 'rotate-90'
                )}
              />
            </CollapsibleTrigger>
          </div>
        ) : (
          <CollapsibleTrigger
            className={cn(
              linkVariants(),
              'text-start w-full flex items-center justify-between'
            )}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.name}
            </span>
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform',
                isOpen && 'rotate-90'
              )}
            />
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
          <div className="pl-4 border-l flex flex-col mt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
