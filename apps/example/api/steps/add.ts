import { handleStep } from '@vercel/workflow-core';

import { add } from '../../workflows/steps';

export const POST = handleStep(add);
