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
    workflow_basic_use_step,
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
    workflow_exported_step,
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
    workflow_module_level_directive,
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

// Test server mode - function with "use step" directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Server)),
    server_basic_use_step,
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

// Test server mode - module level directive
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new(TransformMode::Server)),
    server_module_level_directive,
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
    workflow_var_function_expression,
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
