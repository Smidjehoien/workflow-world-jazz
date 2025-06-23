/**
 * This script is a simple CLI "orchestrator" for the workflow which
 * is ran locally and in-memory.
 */
const baseURL = 'https://w-uncurated-tests.vercel.app/api/';

interface WorkflowTriggerEvent {
    arguments: unknown[];
}

interface WorkflowStepResult {
    result: unknown;
}

interface WorkflowStepFatalError {
    error: string;
    stack?: string;
    fatal: true;
}

type WorkflowEvent = { t: number } & (WorkflowTriggerEvent | WorkflowStepResult | WorkflowStepFatalError);

interface WorkflowInvokePayload {
    runId: string;
    state: WorkflowEvent[];
}

async function invokeWorkflow(baseURL: string, payload: WorkflowInvokePayload): Promise<unknown> {
    const res = await fetch(baseURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const body = await res.json();

    if (res.status === 200) {
        // Workflow completed
        console.log('Workflow completed', body);
        return body.result;
    } else if (res.status === 409) {
        const result = await invokeStep(baseURL, body.stepId, body.arguments);
        payload.state.push({ t: Date.now(), ...result });
    } else {
        throw new Error(`Unexpected status: ${res.status}`);
    }

    return invokeWorkflow(baseURL, payload);
}

async function invokeStep(baseURL: string, stepId: string, args: unknown[]): Promise<WorkflowStepResult | WorkflowStepFatalError> {
    const res = await fetch(new URL(stepId, baseURL), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arguments: args }),
    });
    const body = await res.json();
    if (res.status === 200) {
        console.log('Step completed', body);
        return body;
    } else if (res.status === 500) {
        // Step failed - retry by default, unless `fatal: true`
        // in which case we need to bubble up to the workflow
        console.log('Step failed', body);
        if (body.fatal) {
            return body;
        } else {
            return invokeStep(baseURL, stepId, args);
        }
    } else {
        throw new Error(`Unexpected status: ${res.status}`);
    }
}

const input = parseInt(process.argv[2], 10) || 6;

const result = await invokeWorkflow(baseURL, {
    runId: crypto.randomUUID(),
    state: [
        { t: Date.now(), arguments: [input] },
    ]
});
console.log('Result', result);
