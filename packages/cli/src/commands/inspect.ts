import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base.js';
import {
  listEvents,
  listRuns,
  listSteps,
  printStream,
  showRun,
  showStep,
} from '../lib/inspect/output.js';

export default class Inspect extends BaseCommand {
  static description = 'Inspect runs, steps, streams, or events';

  static aliases = ['i'];

  static examples = [
    '$ workflow inspect runs',
    '$ workflow inspect runs <run-id>',
    '$ workflow inspect steps <run-id>',
    '$ workflow inspect steps <run-id> <step-id>',
    '$ workflow inspect streams <run-id>',
    '$ workflow inspect streams <run-id> <stream-id>',
    '$ workflow inspect events <run-id>',
  ];

  static args = {
    target: Args.string({
      description: 'what to inspect: run(s) | step(s) | stream(s) | event(s)',
      required: false,
      options: [
        'run',
        'step',
        'stream',
        'event',
        'runs',
        'steps',
        'streams',
        'events',
      ],
    }),
    id: Args.string({
      description:
        'ID of the run (for runs) or run-id (for steps/streams/events)',
      required: false,
    }),
    subId: Args.string({
      description:
        'optional step-id or stream-id when inspecting a specific item',
      required: false,
    }),
  } as const;

  static flags = {
    // Accept both singular and plural as aliases via flags as well
    run: Flags.boolean({
      description: 'inspect runs',
      required: false,
      char: 'r',
      aliases: ['runs'],
    }),
    step: Flags.boolean({
      description: 'inspect steps',
      required: false,
      char: 's',
      aliases: ['steps'],
    }),
    stream: Flags.boolean({
      description: 'inspect streams',
      required: false,
      char: 't',
      aliases: ['streams'],
    }),
    event: Flags.boolean({
      description: 'inspect events',
      required: false,
      char: 'e',
      aliases: ['events'],
    }),
  } as const;

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Inspect);

    const normalizeTarget = (
      value?: string
    ): 'run' | 'step' | 'stream' | 'event' | undefined => {
      if (!value) return undefined;
      const v = value.toLowerCase();
      if (v.startsWith('run')) return 'run';
      if (v.startsWith('step')) return 'step';
      if (v.startsWith('stream')) return 'stream';
      if (v.startsWith('event')) return 'event';
      return undefined;
    };

    const targetFromFlags = [
      flags.run || flags.runs ? 'run' : undefined,
      flags.step || flags.steps ? 'step' : undefined,
      flags.stream || flags.streams ? 'stream' : undefined,
      flags.event || flags.events ? 'event' : undefined,
    ].filter(Boolean) as Array<'run' | 'step' | 'stream' | 'event'>;

    if (targetFromFlags.length > 1) {
      this.logWarn(
        'Multiple target types provided via flags; using the first one.'
      );
    }

    const normalizedTarget = normalizeTarget(args.target) ?? targetFromFlags[0];
    const id = args.id;
    const subId = (args as any).subId as string | undefined;

    if (!normalizedTarget) {
      this.logInfo(
        'You must specify what to inspect: runs(s), step(s), stream(s), or event(s).\n'
      );
      this.logInfo('Examples:');
      for (const ex of Inspect.examples) this.logInfo(`  ${ex}`);
      this.logInfo('');
      this.logInfo('Aliases:');
      this.logInfo("- Command: 'inspect' can be shortened to 'i'");
      this.logInfo(
        '- Targets: plural forms are accepted: runs, steps, streams'
      );
      return;
    }

    this.logInfo('');

    if (normalizedTarget === 'run') {
      if (id) {
        await showRun(id);
      } else {
        await listRuns();
      }
      return;
    }

    if (normalizedTarget === 'step') {
      if (!id) {
        this.logError(
          'Missing required argument: run-id. Usage: inspect steps <run-id> [<step-id>]'
        );
        return;
      }
      if (subId) {
        await showStep(id, subId);
      } else {
        await listSteps(id);
      }
      return;
    }

    if (normalizedTarget === 'stream') {
      if (!id) {
        this.logError(
          'Missing required argument: run-id. Usage: inspect streams <run-id> [<stream-id>]'
        );
        return;
      }
      await printStream(id);
      return;
    }

    if (normalizedTarget === 'event') {
      if (!id) {
        this.logError(
          'Missing required argument: run-id. Usage: inspect events <run-id>'
        );
        return;
      }
      if (subId) {
        this.logError(
          'Sub-ID is not supported for events. Usage: inspect events <run-id>'
        );
        return;
      }
      await listEvents(id);
      return;
    }
  }
}
