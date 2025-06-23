const baseURL = 'https://w-uncurated-tests.vercel.app/api/';

interface WorkflowTriggerEvent {
    t: number;
    arguments: unknown[];
}

interface WorkflowStepEvent {
    t: number;
    result: unknown;
}

type WorkflowEvent = WorkflowTriggerEvent | WorkflowStepEvent;

interface WorkflowInvokePayload {
    runId: string;
    state: WorkflowEvent[];
}

const payload: WorkflowInvokePayload = {
    runId: crypto.randomUUID(),
    state: [
        { t: Date.now(), arguments: [10] },
    ]
};

while (true) {
    const res = await fetch(baseURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const body = await res.json();
    console.log(res.status, body);

    if (res.status === 200) {
        // Workflow completed
        console.log('Workflow completed', body);
        break;
    } else if (res.status === 409) {
        // Need to invoke user step
        console.log('Invoking user step', body);
        const stepRes = await fetch(new URL(body.stepId, baseURL), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ arguments: body.arguments }),
        });
        const stepBody = await stepRes.json();
        if (stepRes.status === 200) {
            payload.state.push({ t: Date.now(), result: stepBody.result });
            console.log(stepRes.status, stepBody);
        } else if (stepRes.status === 500) {
            // Step failed, retry by default, unless `fatal: true`
            // in which case we need to bubble up to the workflow
            console.log('Step failed', stepBody);
            payload.state.push({ t: Date.now(), error: stepBody.error, stack: stepBody.stack, fatal: stepBody.fatal });
            console.log(stepRes.status, stepBody);
        } else {
            throw new Error(`Unexpected status: ${stepRes.status}`);
        }
    } else {
        throw new Error(`Unexpected status: ${res.status}`);
    }
}
