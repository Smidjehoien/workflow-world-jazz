import { handleWorkflow } from '@vercel/workflow-core';

export const POST = handleWorkflow(
  `
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../packages/core/dist/global.js
var require_global = __commonJS({
  "../../packages/core/dist/global.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StepNotRunError = exports.FatalError = exports.STEP_INDEX = exports.STATE = void 0;
    exports.STATE = Symbol.for("STATE");
    exports.STEP_INDEX = Symbol.for("STEP_INDEX");
    var FatalError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "FatalError";
      }
    };
    exports.FatalError = FatalError;
    var StepNotRunError = class extends Error {
      stepId;
      args;
      constructor(stepId, args) {
        super(\`Step \${stepId} has not been run yet. Arguments: \${JSON.stringify(args)}\`);
        this.name = "StepNotRunError";
        this.stepId = stepId;
        this.args = args;
      }
    };
    exports.StepNotRunError = StepNotRunError;
  }
});

// ../../packages/core/dist/step.js
var require_step = __commonJS({
  "../../packages/core/dist/step.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.useStep = useStep2;
    var global_1 = require_global();
    function useStep2(stepId, context = globalThis) {
      return async (...args) => {
        const stepIndex = context[global_1.STEP_INDEX]++;
        const event = context[global_1.STATE][stepIndex];
        if (event) {
          if (event.error) {
            if (event.fatal) {
              throw new global_1.FatalError(event.error);
            }
            throw new Error(event.error);
          } else {
            return event.result;
          }
        } else {
          throw new global_1.StepNotRunError(stepId, args);
        }
      };
    }
  }
});

// workflows/workflows.ts
var import_step = __toESM(require_step());
var add = (0, import_step.useStep)("add");
async function workflow(i) {
  "use workflow";
  const a = await add(i, 7);
  const b = await add(a, 8);
  return b;
}
  `,
  'workflow'
);
