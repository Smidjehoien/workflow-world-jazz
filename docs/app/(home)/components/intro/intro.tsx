'use client';

import { track } from '@vercel/analytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NonWorkflowExample } from './non-workflow-example';
import { WorkflowExample } from './workflow-example';

const tabs = [
  {
    id: 'without',
    smallLabel: 'Without WDK',
    label: 'Without Workflow SDK',
    children: <NonWorkflowExample />,
  },
  {
    id: 'with',
    smallLabel: 'With WDK',
    label: 'With Workflow SDK',
    children: <WorkflowExample />,
  },
];

export const Intro = () => (
  <div className="grid gap-8 p-8 sm:p-12">
    <div className="text-balance flex flex-col gap-2">
      <h2 className="font-semibold text-xl tracking-tight sm:text-2xl md:text-3xl lg:text-4xl">
        Reliability as code
      </h2>
      <p className="text-balance text-lg max-w-sm text-muted-foreground">
        Move from fragile queues and custom retries to durable, resumable code
        with simple directives.
      </p>
    </div>
    <div className="flex items-center justify-center">
      <Tabs
        defaultValue={tabs[1].id}
        className="w-full gap-8"
        onValueChange={(value) => track('Intro tab changed', { tab: value })}
      >
        <TabsList className="w-fit bg-background mx-auto border p-1 rounded-full h-auto">
          {tabs.map((tab) => (
            <TabsTrigger
              className="flex-auto data-[state=active]:bg-secondary data-[state=active]:shadow-none rounded-full py-2.5 px-4 h-auto"
              value={tab.id}
              key={tab.id}
            >
              <span className="hidden md:block">{tab.label}</span>
              <span className="block md:hidden">{tab.smallLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent
            value={tab.id}
            key={tab.id}
            className="[&_figure]:rounded-lg [&_figure]:shadow-none"
          >
            {tab.children}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  </div>
);
