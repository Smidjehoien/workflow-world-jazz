import * as devalue from 'devalue';

export const STREAM_NAME_SYMBOL = Symbol.for('WORKFLOW_STREAM_NAME');

// Types that need specialized handling when serialized/deserialized
// ⚠️ If a type is added here, it MUST also be added to the `Serializable` type in `schemas.ts`
export interface SerializableSpecial {
  Date: string; // ISO string
  Headers: [string, string][];
  Map: [any, any][];
  ReadableStream: { name: string };
  Response: {
    url: string;
    status: number;
    statusText: string;
    headers: SerializableSpecial['Headers'];
    body: SerializableSpecial['ReadableStream'];
  };
  Set: any[];
  WritableStream: { name: string };
  URL: string;
  URLSearchParams: [string, string][];
}

type Reducers = {
  [K in keyof SerializableSpecial]: (
    value: any
  ) => SerializableSpecial[K] | false;
};

type Revivers = {
  [K in keyof SerializableSpecial]: (value: SerializableSpecial[K]) => any;
};

function revive(str: string) {
  // biome-ignore lint/security/noGlobalEval: Eval is safe here - we are only passing value from `devalue.stringify()`
  // biome-ignore lint/complexity/noCommaOperator: This is how you do global scope eval
  return (0, eval)(str);
}

/**
 * Called from the `start()` function to serialize the workflow arguments
 * into a format that can be saved to the database and then hydrated from
 * within the workflow execution environment.
 *
 * @param value
 * @param global
 * @returns The dehydrated value, ready to be inserted into the database
 */
export function dehydrateWorkflowArguments(
  value: unknown,
  global: Record<string, any> = globalThis
) {
  const reducers: Reducers = {
    Date: (value) => {
      if (!(value instanceof global.Date)) return false;
      const valid = !Number.isNaN(value.getDate());
      return valid ? value.toISOString() : '';
    },
    Map: (value) => value instanceof global.Map && Array.from(value),
    Set: (value) => value instanceof global.Set && Array.from(value),
    ReadableStream: (value) => {
      if (!(value instanceof global.ReadableStream)) return false;
      const name = crypto.randomUUID();
      return { name };
    },
    WritableStream: (value) => {
      if (!(value instanceof global.WritableStream)) return false;
      const name = crypto.randomUUID();
      return { name };
    },
    Headers: (value) => value instanceof global.Headers && Array.from(value),
    Response: (value) =>
      value instanceof global.Response && {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: value.headers,
        body: value.body,
      },
    URL: (value) => value instanceof global.URL && value.href,
    URLSearchParams: (value) =>
      value instanceof global.URLSearchParams && Array.from(value),
  };
  const str = devalue.stringify(value, reducers);
  return revive(str);
}

/**
 * Called from workflow execution environment to hydrate the workflow
 * arguments from the database at the start of workflow execution.
 *
 * @param value
 * @param ops
 * @param global
 * @returns The hydrated value
 */
export function hydrateWorkflowArguments(
  value: Parameters<typeof devalue.unflatten>[0],
  ops: Promise<any>[],
  global: Record<string, any>
) {
  const revivers: Revivers = {
    Date: (value) => new global.Date(value),
    Map: (value) => new global.Map(value),
    Set: (value) => new global.Set(value),
    ReadableStream: (value) => {
      const stream = Object.create(global.ReadableStream.prototype);
      stream[STREAM_NAME_SYMBOL] = value.name;
      return stream;
    },
    WritableStream: (value) => {
      const stream = Object.create(global.WritableStream.prototype);
      stream[STREAM_NAME_SYMBOL] = value.name;
      return stream;
    },
    Headers: (value) => new global.Headers(value),
    Response: (value) => {
      Object.setPrototypeOf(value, global.Response.prototype);
      return value;
    },
    URL: (value) => new global.URL(value),
    URLSearchParams: (value) => new global.URLSearchParams(value),
  };
  const obj = devalue.unflatten(value, revivers);
  return obj;
}

/**
 * Called at the end of a completed workflow execution to serialize the
 * return value into a format that can be saved to the database.
 *
 * @param value
 * @param global
 * @returns The dehydrated value, ready to be inserted into the database
 */
export function dehydrateWorkflowReturnValue(
  value: unknown,
  global: Record<string, any>
) {
  const reducers: Reducers = {
    Date: (value) => {
      if (!(value instanceof global.Date)) return false;
      const valid = !Number.isNaN(value.getDate());
      return valid ? value.toISOString() : '';
    },
    Map: (value) => value instanceof global.Map && Array.from(value),
    Set: (value) => value instanceof global.Set && Array.from(value),
    ReadableStream: (value) => {
      if (!(value instanceof global.ReadableStream)) return false;
      const name = value[STREAM_NAME_SYMBOL];
      if (typeof name !== 'string') {
        throw new TypeError(
          'ReadableStream instance does not contain an identifier'
        );
      }
      return { name };
    },
    WritableStream: (value) => {
      if (!(value instanceof global.WritableStream)) return false;
      // Does this make sense to do?
      throw new Error(
        'WritableStream is not allowed as a workflow return value'
      );
    },
    Headers: (value) => value instanceof global.Headers && Array.from(value),
    Response: (value) => {
      if (!(value instanceof global.Response)) return false;
      return {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: value.headers,
        body: value.body,
      };
    },
    URL: (value) => value instanceof global.URL && value.href,
    URLSearchParams: (value) =>
      value instanceof global.URLSearchParams && Array.from(value),
  };
  const str = devalue.stringify(value, reducers);
  return revive(str);
}

/**
 * Called from the client side (i.e. the execution environment where
 * the workflow run was initiated from) to hydrate the workflow
 * return value of a completed workflow run.
 *
 * @param value
 * @param global
 * @returns The hydrated return value, ready to be consumed by the client
 */
export function hydrateWorkflowReturnValue(
  value: Parameters<typeof devalue.unflatten>[0],
  global: Record<string, any> = globalThis
) {
  const revivers: Revivers = {
    Date: (value: string) => new global.Date(value),
    Map: (value: unknown[]) => new global.Map(value),
    Set: (value: unknown[]) => new global.Set(value),
    ReadableStream: (value: { name: string }) => {
      const { readable, writable } =
        new global.TransformStream() as TransformStream<Uint8Array, Uint8Array>;

      // Read the stream based on the UUID name from the server
      (async () => {
        const res = await fetch(`/api/stream/${value.name}`);
        if (!res.ok) {
          const writer = writable.getWriter();
          writer.abort(new Error(`Failed to fetch stream: ${res.status}`));
          return;
        }
        await res.body?.pipeTo(writable);
      })();

      return readable;
    },
    WritableStream: () => {
      // Does this make sense to do?
      throw new Error(
        'WritableStream is not allowed as a workflow return value'
      );
    },
    Headers: (value) => new global.Headers(value),
    Response: (value) => {
      const response = new global.Response(value.body, {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: new global.Headers(value.headers),
      });
      return response;
    },
    URL: (value) => new global.URL(value),
    URLSearchParams: (value) => new global.URLSearchParams(value),
  };
  const obj = devalue.unflatten(value, revivers);
  return obj;
}

/**
 * Called from the workflow handler when a step is being created.
 * Dehydrates values from within the workflow execution environment
 * into a format that can be saved to the database.
 *
 * @param value
 * @param global
 * @returns The dehydrated value, ready to be inserted into the database
 */
export function dehydrateStepArguments(
  value: unknown,
  global: Record<string, any>
) {
  const reducers: Reducers = {
    Date: (value) => {
      if (!(value instanceof global.Date)) return false;
      const valid = !Number.isNaN(value.getDate());
      return valid ? value.toISOString() : '';
    },
    Map: (value) => value instanceof global.Map && Array.from(value),
    Set: (value) => value instanceof global.Set && Array.from(value),
    ReadableStream: (value) => {
      if (!(value instanceof global.ReadableStream)) return false;
      const name = crypto.randomUUID();
      return { name };
    },
    WritableStream: (value) => {
      if (!(value instanceof global.WritableStream)) return false;
      const name = crypto.randomUUID();
      return { name };
    },
    Headers: (value) => value instanceof global.Headers && Array.from(value),
    Response: (value) => {
      if (!(value instanceof global.Response)) return false;
      return {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: value.headers,
        body: value.body,
      };
    },
    URL: (value) => value instanceof global.URL && value.href,
    URLSearchParams: (value) =>
      value instanceof global.URLSearchParams && Array.from(value),
  };
  const str = devalue.stringify(value, reducers);
  return revive(str);
}

/**
 * Called from the step handler to hydrate the arguments of a step
 * from the database at the start of the step execution.
 *
 * @param value
 * @param global
 * @returns The hydrated value, ready to be consumed by the step user-code function
 */
export function hydrateStepArguments(
  value: Parameters<typeof devalue.unflatten>[0],
  ops: Promise<any>[],
  global: Record<string, any> = globalThis
) {
  const revivers: Revivers = {
    Date: (value: string) => new global.Date(value),
    Map: (value: unknown[]) => new global.Map(value),
    Set: (value: unknown[]) => new global.Set(value),
    ReadableStream: (value: { name: string }) => {
      const stream = Object.create(global.ReadableStream.prototype);
      stream[STREAM_NAME_SYMBOL] = value.name;
      return stream;
    },
    WritableStream: (value: { name: string }) => {
      const stream = Object.create(global.WritableStream.prototype);
      stream[STREAM_NAME_SYMBOL] = value.name;
      return stream;
    },
    Headers: (value) => new global.Headers(value),
    Response: (value) => {
      return new global.Response(value.body, {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: new global.Headers(value.headers),
      });
    },
    URL: (value) => new global.URL(value),
    URLSearchParams: (value) => new global.URLSearchParams(value),
  };
  const obj = devalue.unflatten(value, revivers);
  return obj;
}

/**
 * Called from the step handler when a step has completed.
 * Dehydrates values from within the step execution environment
 * into a format that can be saved to the database.
 *
 * @param value
 * @param global
 * @returns The dehydrated value, ready to be inserted into the database
 */
export function dehydrateStepReturnValue(
  value: unknown,
  global: Record<string, any> = globalThis
) {
  const reducers: Reducers = {
    Date: (value) => {
      if (!(value instanceof global.Date)) return false;
      const valid = !Number.isNaN(value.getDate());
      return valid ? value.toISOString() : '';
    },
    Map: (value) => value instanceof global.Map && Array.from(value),
    Set: (value) => value instanceof global.Set && Array.from(value),
    ReadableStream: (value) => {
      if (!(value instanceof global.ReadableStream)) return false;
      const name = crypto.randomUUID();
      return { name };
    },
    WritableStream: (value) => {
      if (!(value instanceof global.WritableStream)) return false;
      const name = crypto.randomUUID();
      return { name };
    },
    Headers: (value) => value instanceof global.Headers && Array.from(value),
    Response: (value) => {
      if (!(value instanceof global.Response)) return false;
      return {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: value.headers,
        body: value.body,
      };
    },
    URL: (value) => value instanceof global.URL && value.href,
    URLSearchParams: (value) =>
      value instanceof global.URLSearchParams && Array.from(value),
  };
  const str = devalue.stringify(value, reducers);
  return revive(str);
}

/**
 * Called from the workflow handler when replaying the event log of a `step_result` event.
 * Hydrates the return value of a step from the database.
 *
 * @param value
 * @param global
 * @returns The hydrated return value of a step, ready to be consumed by the workflow handler
 */
export function hydrateStepReturnValue(
  value: Parameters<typeof devalue.unflatten>[0],
  global: Record<string, any>
) {
  const revivers: Revivers = {
    Date: (value: string) => new global.Date(value),
    Map: (value: unknown[]) => new global.Map(value),
    Set: (value: unknown[]) => new global.Set(value),
    ReadableStream: (value: { name: string }) => {
      const stream = Object.create(global.ReadableStream.prototype);
      stream[STREAM_NAME_SYMBOL] = value.name;
      return stream;
    },
    WritableStream: (value: { name: string }) => {
      const stream = Object.create(global.WritableStream.prototype);
      stream[STREAM_NAME_SYMBOL] = value.name;
      return stream;
    },
    Headers: (value) => new global.Headers(value),
    Response: (value) => {
      return new global.Response(value.body, {
        url: value.url,
        status: value.status,
        statusText: value.statusText,
        headers: new global.Headers(value.headers),
      });
    },
    URL: (value) => new global.URL(value),
    URLSearchParams: (value) => new global.URLSearchParams(value),
  };
  const obj = devalue.unflatten(value, revivers);
  return obj;
}
