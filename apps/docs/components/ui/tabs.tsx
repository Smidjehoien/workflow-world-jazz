'use client';

import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

interface TabProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

interface TabsProps {
  items?: string[];
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ items, defaultValue, children, className }: TabsProps) {
  // Extract tab values from children if items not provided
  const tabValues =
    items ||
    React.Children.toArray(children)
      .filter(
        (child): child is React.ReactElement<TabProps> =>
          React.isValidElement<TabProps>(child) &&
          typeof child.props.value === 'string'
      )
      .map((child) => child.props.value);

  const [activeTab, setActiveTab] = useState(
    defaultValue || tabValues[0] || ''
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('tabs-container border rounded-sm', className)}>
        <div className="tabs-list flex border-b border-border">
          {tabValues.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'tab-trigger px-4 py-2 text-sm transition-colors',
                'hover:text-foreground/80',
                activeTab === value
                  ? 'text-foreground border-b-2 border-primary-foreground -mb-px'
                  : 'text-muted-foreground'
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="tabs-content [&_span]:!p-0 [&_div]:!p-0 px-4">
          {children}
        </div>
      </div>
    </TabsContext.Provider>
  );
}

export function Tab({ value, children, className }: TabProps) {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error('Tab must be used within a Tabs component');
  }

  const { activeTab } = context;

  if (activeTab !== value) {
    return null;
  }

  return (
    <div className={cn('tab-content px-4 py-2', className)}>{children}</div>
  );
}
