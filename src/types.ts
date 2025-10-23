import {
  EventTypeSchema,
  HookSchema,
  StepSchema,
  ValidQueueName,
  WorkflowRunSchema,
} from '@workflow/world';
import {
  co,
  Group,
  type RefsToResolve,
  type RefsToResolveStrict,
  type Resolved,
  z,
} from 'jazz-tools';

export const JazzWorkflowRun = co.map({
  ...WorkflowRunSchema.omit({
    runId: true,
    input: true,
    output: true,
    executionContext: true,
  }).shape,
  input: z.array(z.json()),
  output: z.json().optional(),
  outputFile: co.fileStream().optional(),
  executionContext: co.record(z.string(), z.json()).optional(),
});

export type JazzWorkflowRun = co.loaded<typeof JazzWorkflowRun>;

export const JazzStep = co.map({
  ...StepSchema.omit({
    input: true,
    output: true,
  }).shape,
  input: z.array(z.json()),
  output: z.json().optional(),
  outputFile: co.fileStream().optional(),
});

export type JazzStep = co.loaded<typeof JazzStep>;

export const JazzEvent = co.map({
  runId: z.string(),
  eventType: EventTypeSchema,
  eventData: z.json(),
  correlationId: z.string().optional(),
  createdAt: z.date(),
});

export type JazzEvent = co.loaded<typeof JazzEvent>;

export const JazzHook = co.map({
  ...HookSchema.shape,
  metadata: z.json().optional(),
});

export type JazzHook = co.loaded<typeof JazzHook>;

export const JazzQueueMessage = co.map({
  message: z.json(),
  deploymentId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  queueName: ValidQueueName,
  processedAt: z.date().optional(),
});

export type JazzQueueMessage = co.loaded<typeof JazzQueueMessage>;

export const JazzQueueMessages = co.list(JazzQueueMessage);

export type JazzQueueMessages = co.loaded<typeof JazzQueueMessages>;

export const JazzQueue = co.map({
  name: ValidQueueName,
  messages: JazzQueueMessages,
});

export type JazzQueue = co.loaded<typeof JazzQueue>;

export const JazzStream = co.map({
  name: z.string(),
  stream: co.fileStream(),
});

export type JazzStream = co.loaded<typeof JazzStream>;

export const JazzStorageRoot = co.map({
  runs: co.list(JazzWorkflowRun),
  steps: co.record(z.string(), co.record(z.string(), JazzStep)),
  events: co.record(z.string(), co.list(JazzEvent)),
  hooks: co.record(z.string(), JazzHook),
});

export type JazzStorageRoot = co.loaded<typeof JazzStorageRoot>;

export const JazzStorageAccount = co
  .account({
    profile: co.profile(),
    root: JazzStorageRoot,
  })
  .withMigration(async (account) => {
    if (!account.$jazz.has('root')) {
      const defaultGroup = Group.create();
      const runs = co.list(JazzWorkflowRun).create([], { owner: defaultGroup });
      const steps = co
        .record(z.string(), co.record(z.string(), JazzStep))
        .create({}, { owner: defaultGroup });
      const events = co
        .record(z.string(), co.list(JazzEvent))
        .create({}, { owner: defaultGroup });
      const hooks = co
        .record(z.string(), JazzHook)
        .create({}, { owner: defaultGroup });
      account.$jazz.set('root', {
        runs,
        events,
        steps,
        hooks,
      });
    }

    const { root } = await account.$jazz.ensureLoaded({
      resolve: { root: true },
    });

    if (root.runs === undefined) {
      root.$jazz.set(
        'runs',
        co.list(JazzWorkflowRun).create([], Group.create())
      );
    }
    if (root.steps === undefined) {
      root.$jazz.set(
        'steps',
        co
          .record(z.string(), co.record(z.string(), JazzStep))
          .create({}, Group.create())
      );
    }
    if (root.events === undefined) {
      root.$jazz.set(
        'events',
        co.record(z.string(), co.list(JazzEvent)).create({}, Group.create())
      );
    }
    if (root.hooks === undefined) {
      root.$jazz.set(
        'hooks',
        co.record(z.string(), JazzHook).create({}, Group.create())
      );
    }
  });

export type JazzStorageAccount = co.loaded<typeof JazzStorageAccount>;

export type JazzStorageAccountResolver = <
  const R extends RefsToResolve<JazzStorageAccount>,
>(
  resolve: RefsToResolveStrict<JazzStorageAccount, R>
) => Promise<Resolved<JazzStorageAccount, R>>;
