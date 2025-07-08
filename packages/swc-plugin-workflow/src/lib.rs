#![allow(clippy::not_unsafe_ptr_arg_deref)]

use serde::Deserialize;
use swc_core::{
    ecma::{ast::*, transforms::testing::test_inline, visit::*},
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

mod step_transform;
use step_transform::{StepTransform, TransformMode};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WasmConfig {
    mode: TransformMode,
}

#[plugin_transform]
pub fn process_transform(
    mut program: Program,
    metadata: TransformPluginProgramMetadata,
) -> Program {
    let plugin_config: WasmConfig = serde_json::from_str(
        &metadata
            .get_transform_plugin_config()
            .expect("failed to get plugin config for relay"),
    )
    .expect("Should provide plugin config");

    let mut visitor = StepTransform::new(plugin_config.mode);
    program.visit_mut_with(&mut visitor);
    program
}

// Test cases

// Test workflow mode - function with "use step" directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Workflow)),
    workflow_mode_basic_use_step,
    // Input codes
    r#"async function add(a, b) {
    "use step";
    return a + b;
}
"#,
    // Output codes after transformed with plugin
    r#"const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
"#
);

// Test workflow mode - exported step function
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Workflow)),
    workflow_mode_exported_step,
    // Input codes
    r#"export async function add(a, b) {
    "use step";
    return a + b;
}
"#,
    // Output codes after transformed with plugin
    r#"export const add = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("add");
"#
);

// Test workflow mode - module level directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Workflow)),
    workflow_mode_module_level_directive,
    // Input codes
    r#""use step";

export async function processOrder(orderId) {
    return { processed: true };
}

export async function sendEmail(to, subject) {
    return { sent: true };
}
"#,
    // Output codes after transformed with plugin
    r#"export const processOrder = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("processOrder");
export const sendEmail = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("sendEmail");
"#
);

// Test step mode - function with "use step" directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Step)),
    step_mode_basic_use_step,
    // Input codes
    r#"export async function add(a, b) {
    "use step";
    return a + b;
}"#,
    // Output codes after transformed with plugin
    r#"import { registerStepFunction } from "@vercel/workflow-core/private";
export async function add(a, b) {
    return a + b;
}
registerStepFunction(add);"#
);

// Test step mode - module level directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Step)),
    step_mode_module_level_directive,
    // Input codes
    r#""use step";

export async function processOrder(orderId) {
    return { processed: true };
}

export async function sendEmail(to, subject) {
    return { sent: true };
}"#,
    // Output codes after transformed with plugin
    r#"import { registerStepFunction } from "@vercel/workflow-core/private";
export async function processOrder(orderId) {
    return { processed: true };
}
export async function sendEmail(to, subject) {
    return { sent: true };
}
registerStepFunction(processOrder);
registerStepFunction(sendEmail);"#
);

// Test variable declaration with function expression
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Workflow)),
    workflow_mode_var_function_expression,
    // Input codes
    r#"const multiply = async function(a, b) {
    "use step";
    return a * b;
};
"#,
    // Output codes after transformed with plugin
    r#"const multiply = globalThis[Symbol.for("WORKFLOW_USE_STEP")]("multiply");
"#
);

// Test client mode - basic step function transformation
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_step_function_transformation,
    // Input codes
    r#"export async function add(a, b) {
    "use step";
    return a + b;
}
"#,
    // Output codes after transformed with plugin
    r#"import { runStep as __private_run_step } from "@vercel/workflow-core";
export async function add(a, b) {
    return __private_run_step("add", { arguments: [a, b] });
}
"#
);

// Test client mode - basic workflow function transformation
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_workflow_function_transformation,
    // Input codes
    r#"export async function workflow(a, b) {
    "use workflow";
    return add(a, b);
}
"#,
    // Output codes after transformed with plugin
    r#"import { start as __private_workflow_start } from "@vercel/workflow-core";
export async function workflow(a, b) {
    return __private_workflow_start("workflow", { arguments: [a, b] });
}
"#
);

// Test client mode - mixed step and workflow functions
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_mixed_functions,
    // Input codes
    r#"export async function add(a, b) {
    "use step";
    return a + b;
}

export async function workflow(a, b) {
    "use workflow";
    return add(a, b);
}
"#,
    // Output codes after transformed with plugin
    r#"import { start as __private_workflow_start, runStep as __private_run_step } from "@vercel/workflow-core";
export async function add(a, b) {
    return __private_run_step("add", { arguments: [a, b] });
}
export async function workflow(a, b) {
    return __private_workflow_start("workflow", { arguments: [a, b] });
}
"#
);

// Test client mode - module level step directive transformation
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_module_level_step_directive_transformation,
    // Input codes
    r#""use step";

export async function processOrder(orderId) {
    return { processed: true };
}

export async function sendEmail(to, subject) {
    return { sent: true };
}
"#,
    // Output codes after transformed with plugin
    r#"import { runStep as __private_run_step } from "@vercel/workflow-core";
export async function processOrder(orderId) {
    return __private_run_step("processOrder", { arguments: [orderId] });
}
export async function sendEmail(to, subject) {
    return __private_run_step("sendEmail", { arguments: [to, subject] });
}
"#
);

// Test client mode - module level workflow directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_module_level_workflow_directive,
    // Input codes
    r#""use workflow";

export async function processOrder(orderId) {
    return { processed: true };
}

export async function sendEmail(to, subject) {
    return { sent: true };
}
"#,
    // Output codes after transformed with plugin
    r#"import { start as __private_workflow_start } from "@vercel/workflow-core";
export async function processOrder(orderId) {
    return __private_workflow_start("processOrder", { arguments: [orderId] });
}
export async function sendEmail(to, subject) {
    return __private_workflow_start("sendEmail", { arguments: [to, subject] });
}
"#
);

// Test client mode - workflow function with variable declaration
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_workflow_var_function_expression,
    // Input codes
    r#"const processData = async function(data) {
    "use workflow";
    return data.processed;
};
"#,
    // Output codes after transformed with plugin
    r#"import { start as __private_workflow_start } from "@vercel/workflow-core";
const processData = async function(data) {
    return __private_workflow_start("processData", { arguments: [data] });
};
"#
);

// Test client mode - step function with variable declaration transformation
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Client)),
    client_mode_step_var_function_expression_transformation,
    // Input codes
    r#"const multiply = async function(a, b) {
    "use step";
    return a * b;
};
"#,
    // Output codes after transformed with plugin
    r#"import { runStep as __private_run_step } from "@vercel/workflow-core";
const multiply = async function(a, b) {
    return __private_run_step("multiply", { arguments: [a, b] });
};
"#
);
