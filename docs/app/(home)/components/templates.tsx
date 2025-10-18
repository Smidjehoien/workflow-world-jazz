const data = [
  {
    title: 'Story Generator Slackbot',
    description: 'TBD.',
    image: '/images/zero-config.png',
    link: 'https://vercel.com/templates/x/x',
  },
  {
    title: 'Streaming AI Agent',
    description:
      'Common AI agent patterns using the Vercel Workflow SDK to make agents more durable and reliable.',
    image: '/images/observable.png',
    link: 'https://vercel.com/templates/x/x',
  },
  {
    title: 'Vectr',
    description:
      'A free, open-source template for building natural language image search on the AI Cloud.',
    image: '/images/resilient.png',
    link: 'https://vercel.com/templates/x/x',
  },
];

export const Templates = () => (
  <div className="p-12 grid gap-12">
    <div className="max-w-3xl text-balance grid gap-2">
      <h2 className="font-semibold text-xl tracking-tight sm:text-2xl md:text-3xl">
        Get started quickly
      </h2>
      <p className="text-balance text-lg text-muted-foreground">
        See workflows in action with one of our templates.
      </p>
    </div>
    <div className="grid grid-cols-3 gap-8">
      {data.map((item) => (
        <div key={item.title}>
          <div className="aspect-video bg-background rounded-lg border flex items-center justify-center">
            <p>screenshot</p>
          </div>
          <h3 className="mt-4 mb-2 font-semibold text-lg tracking-tight">
            {item.title}
          </h3>
          <p className="text-muted-foreground text-sm">{item.description}</p>
        </div>
      ))}
    </div>
  </div>
);
