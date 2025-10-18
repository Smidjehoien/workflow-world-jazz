import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tabs = [
  {
    id: 'without',
    label: 'Without Workflow SDK',
  },
  {
    id: 'with',
    label: 'With Workflow SDK',
  },
];

export const Intro = () => (
  <div className="grid gap-8 p-12">
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
      <Tabs defaultValue={tabs[1].id} className="w-full gap-8">
        <TabsList className="w-fit bg-background mx-auto border p-1 rounded-full h-auto">
          {tabs.map((tab) => (
            <TabsTrigger
              className="basis-0 data-[state=active]:bg-secondary data-[state=active]:shadow-none rounded-full py-2.5 px-4 h-auto"
              value={tab.id}
              key={tab.id}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent
            value={tab.id}
            key={tab.id}
            className="[&_figure]:rounded-lg [&_figure]:shadow-none"
          >
            <div className="aspect-video bg-background rounded-lg border flex items-center justify-center">
              {tab.label} code-based animation
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  </div>
);
