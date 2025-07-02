import { types } from 'node:util';
import { assert, describe, expect, it } from 'vitest';
import { runWorkflow } from './workflow.js';

describe('runWorkflow', () => {
  describe('successful workflow execution', () => {
    it('should execute a simple workflow successfully', async () => {
      const workflowCode = 'function workflow() { return "success"; }';
      const workflowName = 'workflow';

      const result = await runWorkflow(workflowCode, workflowName, {
        workflowId: 'test-workflow',
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/api/callback',
        state: [
          {
            t: 1234567890,
            arguments: [],
          },
        ],
      });
      expect(result).toEqual('success');
    });

    it('should execute workflow with arguments', async () => {
      const workflowCode = 'function workflow(a, b) { return a + b; }';
      const workflowName = 'workflow';

      const result = await runWorkflow(workflowCode, workflowName, {
        workflowId: 'test-workflow',
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/api/callback',
        state: [
          {
            t: 1234567890,
            arguments: [1, 2],
          },
        ],
      });
      expect(result).toEqual(3);
    });

    it('allow user code to handle user-defined errors', async () => {
      const workflowCode = `function workflow() {
        try {
          throw new TypeError("my workflow error");
        } catch (err) {
          return err;
        }
      }`;
      const workflowName = 'workflow';

      const result = await runWorkflow(workflowCode, workflowName, {
        workflowId: 'test-workflow',
        runId: 'test-run-123',
        callbackUrl: 'https://example.com/api/callback',
        state: [
          {
            t: 1234567890,
            arguments: [1, 2],
          },
        ],
      });
      assert(types.isNativeError(result));
      expect(result.name).toEqual('TypeError');
      expect(result.message).toEqual('my workflow error');
    });
  });

  describe('error handling', () => {
    it('should throw ReferenceError when workflow code does not return a function', async () => {
      let error: Error | undefined;
      try {
        await runWorkflow('const value = "test"', 'value', {
          workflowId: 'test-workflow',
          runId: 'test-run-123',
          callbackUrl: 'https://example.com/api/callback',
          state: [
            {
              t: 1234567890,
              arguments: [],
            },
          ],
        });
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('ReferenceError');
      expect(error.message).toEqual(
        'Workflow "value" must be a function, but got "string" instead'
      );
    });

    it('should throw user-defined error when workflow code throws an error', async () => {
      let error: Error | undefined;
      try {
        await runWorkflow(
          'function workflow() { throw new Error("test"); }',
          'workflow',
          {
            workflowId: 'test-workflow',
            runId: 'test-run-123',
            callbackUrl: 'https://example.com/api/callback',
            state: [
              {
                t: 1234567890,
                arguments: [],
              },
            ],
          }
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('Error');
      expect(error.message).toEqual('test');
    });

    it('should throw `StepNotRunError` when a step does not have an event result entry', async () => {
      let error: Error | undefined;
      try {
        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            // 'add()' will throw a 'StepNotRunError' because it has not been run yet
            const a = await add(1, 2);
            return a;
          }`,
          'workflow',
          {
            workflowId: 'test-workflow',
            runId: 'test-run-123',
            callbackUrl: 'https://example.com/api/callback',
            state: [
              {
                t: 1234567890,
                arguments: [],
              },
            ],
          }
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('StepNotRunError');
      expect(error.message).toEqual(
        'Step add has not been run yet. Arguments: [1,2]'
      );
    });

    it('`StepNotRunError` should not be catchable by user code', async () => {
      let error: Error | undefined;
      try {
        await runWorkflow(
          `const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
          async function workflow() {
            try {
              // 'add()' will throw a 'StepNotRunError' because it has not been run yet
              const a = await add(1, 2);
              return a;
            } catch (err) {
              return err;
            }
          }`,
          'workflow',
          {
            workflowId: 'test-workflow',
            runId: 'test-run-123',
            callbackUrl: 'https://example.com/api/callback',
            state: [
              {
                t: 1234567890,
                arguments: [],
              },
            ],
          }
        );
      } catch (err) {
        error = err;
      }
      assert(error);
      expect(error.name).toEqual('StepNotRunError');
      expect(error.message).toEqual(
        'Step add has not been run yet. Arguments: [1,2]'
      );
    });
  });
});
