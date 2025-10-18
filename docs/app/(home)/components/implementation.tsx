import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

const data = [
  {
    code: `import { sleep } from "@vercel/workflow-core";
 
export async function userSignupWorkflow(email: string) {
  "use workflow"; 
 
  const user = await createUser(email);
  await sendWelcomeEmail(user.id);
 
  await sleep("30s"); // Pause for 30s - doesn't consume any resources
  await sendOnboardingEmail(user.id);
 
  return { userId: user.id, status: "onboarded" };
}`,
    caption: 'Creating a workflow',
  },
  {
    code: `async function createUser(email: string) {
  "use step"; 
 
  // Full Node.js access - database calls, APIs, etc.
  console.log(\`Creating user with email: \${email}\`);
  return { id: crypto.randomUUID(), email };
}

async function sendWelcomeEmail(userId: string) {
  "use step"; 
 
  console.log(\`Sending welcome email to user: \${userId}\`);
 
  if (Math.random() < 0.3) {
    // By default, steps will be retried 3 times for unhandled errors
    throw new Error("Retryable!"); // [!code highlight]
  }
}`,
    caption: 'Defining steps',
  },
];

export const Implementation = () => (
  <div className="p-12 grid gap-12">
    <div className="max-w-3xl text-balance grid gap-2">
      <h2 className="font-semibold text-xl tracking-tight sm:text-2xl md:text-3xl lg:text-4xl">
        Effortless setup
      </h2>
      <p className="text-balance text-lg text-muted-foreground">
        With a simple declarative API to define and use your workflows.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-8">
      {data.map((item) => (
        <div
          key={item.caption}
          className="h-full flex flex-col [&_figure]:flex-1 [&_.fd-scroll-container]:h-full gap-4"
        >
          <h3 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">
            {item.caption}
          </h3>
          <DynamicCodeBlock
            code={item.code}
            lang="ts"
            codeblock={{
              className:
                'shadow-none bg-background dark:bg-sidebar rounded-md with-line-numbers',
            }}
          />
        </div>
      ))}
    </div>
  </div>
);
