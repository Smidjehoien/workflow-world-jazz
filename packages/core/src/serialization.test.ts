import { runInContext } from 'node:vm';
import { createContext } from '@vercel/workflow-vm';
import { describe, expect, it } from 'vitest';
import {
  dehydrateWorkflowArguments,
  hydrateWorkflowArguments,
  STREAM_NAME_SYMBOL,
} from './serialization.js';

describe('workflow arguments', () => {
  const { context, globalThis: vmGlobalThis } = createContext({
    seed: 'test',
    fixedTimestamp: 1714857600000,
  });

  it('should work with Date', () => {
    const date = new Date('2025-07-17T04:30:34.824Z');
    const serialized = dehydrateWorkflowArguments(date, []);
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "Date",
          1,
        ],
        "2025-07-17T04:30:34.824Z",
      ]
    `);

    const hydrated = hydrateWorkflowArguments(serialized, [], vmGlobalThis);
    vmGlobalThis.val = hydrated;

    expect(runInContext('val instanceof Date', context)).toBe(true);
    expect(hydrated.getTime()).toEqual(date.getTime());
  });

  it('should work with invalid Date', () => {
    const date = new Date('asdf');
    const serialized = dehydrateWorkflowArguments(date, []);
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "Date",
          "",
        ],
      ]
    `);

    const hydrated = hydrateWorkflowArguments(serialized, [], vmGlobalThis);
    vmGlobalThis.val = hydrated;

    expect(runInContext('val instanceof Date', context)).toBe(true);
    expect(hydrated.getTime()).toEqual(NaN);
  });

  it('should work with Map', () => {
    const map = new Map([
      [2, 'foo'],
      [6, 'bar'],
    ]);
    const serialized = dehydrateWorkflowArguments(map, []);
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "Map",
          1,
        ],
        [
          2,
          5,
        ],
        [
          3,
          4,
        ],
        2,
        "foo",
        [
          6,
          7,
        ],
        6,
        "bar",
      ]
    `);

    const hydrated = hydrateWorkflowArguments(serialized, [], vmGlobalThis);
    vmGlobalThis.val = hydrated;

    expect(runInContext('val instanceof Map', context)).toBe(true);
  });

  it('should work with Set', () => {
    const set = new Set([1, '2', true]);
    const serialized = dehydrateWorkflowArguments(set, []);
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "Set",
          1,
        ],
        [
          2,
          3,
          4,
        ],
        1,
        "2",
        true,
      ]
    `);

    const hydrated = hydrateWorkflowArguments(serialized, [], vmGlobalThis);
    vmGlobalThis.val = hydrated;

    expect(runInContext('val instanceof Set', context)).toBe(true);
  });

  it('should work with WritableStream', () => {
    const stream = new WritableStream();
    const serialized = dehydrateWorkflowArguments(stream, []);
    const uuid = serialized[2];
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "WritableStream",
          1,
        ],
        {
          "name": 2,
        },
        "${uuid}",
      ]
    `);

    const ops = [];
    class OurWritableStream {}
    class TransformStream {
      public writable;

      constructor() {
        this.writable = new OurWritableStream();
      }
    }
    const hydrated = hydrateWorkflowArguments(serialized, ops, {
      TransformStream,
      WritableStream: OurWritableStream,
    });
    expect(hydrated).toBeInstanceOf(OurWritableStream);
    expect(hydrated[STREAM_NAME_SYMBOL]).toEqual(uuid);
    expect(ops).toHaveLength(0);
  });

  it('should work with ReadableStream', () => {
    const stream = new ReadableStream();
    const serialized = dehydrateWorkflowArguments(stream, []);
    const uuid = serialized[2];
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "ReadableStream",
          1,
        ],
        {
          "name": 2,
        },
        "${uuid}",
      ]
    `);

    const ops = [];
    class OurReadableStream {}
    class TransformStream {
      public readable;

      constructor() {
        this.readable = new OurReadableStream();
      }
    }
    const hydrated = hydrateWorkflowArguments(serialized, ops, {
      TransformStream,
      ReadableStream: OurReadableStream,
    });
    expect(hydrated).toBeInstanceOf(OurReadableStream);
    expect(hydrated[STREAM_NAME_SYMBOL]).toEqual(uuid);
    expect(ops).toHaveLength(1);
  });

  it('should work with Headers', () => {
    const headers = new Headers();
    headers.set('foo', 'bar');
    headers.append('set-cookie', 'a');
    headers.append('set-cookie', 'b');
    const serialized = dehydrateWorkflowArguments(headers, []);
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "Headers",
          1,
        ],
        [
          2,
          5,
          8,
        ],
        [
          3,
          4,
        ],
        "foo",
        "bar",
        [
          6,
          7,
        ],
        "set-cookie",
        "a",
        [
          6,
          9,
        ],
        "b",
      ]
    `);

    const hydrated = hydrateWorkflowArguments(serialized, [], vmGlobalThis);
    expect(hydrated).toBeInstanceOf(Headers);
    expect(hydrated.get('foo')).toEqual('bar');
    expect(hydrated.get('set-cookie')).toEqual('a, b');
  });

  it('should work with Response', () => {
    const response = new Response('Hello, world!', {
      status: 202,
      statusText: 'Custom',
      headers: new Headers([
        ['foo', 'bar'],
        ['set-cookie', 'a'],
        ['set-cookie', 'b'],
      ]),
    });
    const serialized = dehydrateWorkflowArguments(response, []);
    const bodyUuid = serialized[serialized.length - 1];
    expect(serialized).toMatchInlineSnapshot(`
      [
        [
          "Response",
          1,
        ],
        {
          "body": 18,
          "headers": 5,
          "status": 3,
          "statusText": 4,
          "url": 2,
        },
        "",
        202,
        "Custom",
        [
          "Headers",
          6,
        ],
        [
          7,
          10,
          13,
          16,
        ],
        [
          8,
          9,
        ],
        "content-type",
        "text/plain;charset=UTF-8",
        [
          11,
          12,
        ],
        "foo",
        "bar",
        [
          14,
          15,
        ],
        "set-cookie",
        "a",
        [
          14,
          17,
        ],
        "b",
        [
          "ReadableStream",
          19,
        ],
        {
          "name": 20,
        },
        "${bodyUuid}",
      ]
    `);

    class OurResponse {
      public headers;
      public body;
      constructor(body, init) {
        this.body = body || init.body;
        this.headers = init.headers;
      }
    }
    class OurReadableStream {}
    class OurHeaders {}
    class TransformStream {
      public readable;
      constructor() {
        this.readable = new OurReadableStream();
      }
    }
    const hydrated = hydrateWorkflowArguments(serialized, [], {
      Headers: OurHeaders,
      Response: OurResponse,
      ReadableStream: OurReadableStream,
      TransformStream,
    });
    expect(hydrated).toBeInstanceOf(OurResponse);
    expect(hydrated.headers).toBeInstanceOf(OurHeaders);
    expect(hydrated.body).toBeInstanceOf(OurReadableStream);
  });

  it('should throw error for an unsupported type', () => {
    class Foo {}
    let err: Error | undefined;
    try {
      dehydrateWorkflowArguments(new Foo(), []);
    } catch (err_) {
      err = err_ as Error;
    }
    expect(err).toBeDefined();
    expect(err?.message).toEqual(`Cannot stringify arbitrary non-POJOs`);
  });
});
