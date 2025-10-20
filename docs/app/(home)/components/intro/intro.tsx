'use client';

import { track } from '@vercel/analytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NonWorkflowExample } from './non-workflow-example';
import { WorkflowExample } from './workflow-example';

const tabs = [
  {
    id: 'with',
    smallLabel: 'With WDK',
    label: 'With Workflow DevKit',
    children: <WorkflowExample />,
  },
  {
    id: 'without',
    smallLabel: 'Without WDK',
    label: 'Without Workflow DevKit',
    children: <NonWorkflowExample />,
  },
];

export const Intro = () => (
  <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-12 p-8 sm:p-12">
    <div className=" flex flex-col gap-2">
      <h2 className="font-semibold text-xl tracking-tight sm:text-2xl md:text-3xl lg:text-[40px]">
        Reliability-as-code
      </h2>
      <p className=" text-lg text-muted-foreground md:mt-4">
        Move from hand-rolled queues and custom retries to durable, resumable
        code with simple directives.
      </p>
    </div>
    <div className="flex items-center justify-center">
      <Tabs
        defaultValue={tabs[0].id}
        className="w-full gap-6"
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
