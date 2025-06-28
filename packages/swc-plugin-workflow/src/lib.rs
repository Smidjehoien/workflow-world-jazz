#![allow(clippy::not_unsafe_ptr_arg_deref)]

// use swc_core::plugin::proxies::TransformPluginProgramMetadata;
// use swc_ecma_ast::Program;
// use swc_plugin_macro::plugin_transform;

use swc_core::{
    ecma::{ast::*, transforms::testing::test_inline, visit::*},
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};
// mod transform;
// use transform::ServerActions;

mod step_transform;
use step_transform::StepTransform;

#[plugin_transform]
pub fn process_transform(
    mut program: Program,
    _metadata: TransformPluginProgramMetadata,
) -> Program {
    let mut visitor = StepTransform::new();
    program.visit_mut_with(&mut visitor);
    program
}

// Test cases

test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new()),
    basic_use_step,
    // Input codes
    r#"async function add(a, b) {
    "use step";
    return a + b;
}
add(1, 2);"#,
    // Output codes after transformed with plugin
    r#"import { useStep } from "@vercel/workflow-core/dist/step";
async function add(a, b) {
    "use step";
    return a + b;
}
useStep("add")(1, 2);"#
);

// Exporting a step should work too
test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new()),
    exported_step,
    // Input codes
    r#"export async function add(a, b) {
    "use step";
    return a + b;
}
add(1, 2);"#,
    // Output codes after transformed with plugin
    r#"import { useStep } from "@vercel/workflow-core/dist/step";
export async function add(a, b) {
    "use step";
    return a + b;
}
useStep("add")(1, 2);"#
);

test_inline!(
    Default::default(),
    |_| visit_mut_pass(StepTransform::new()),
    module_level_directive,
    // Input codes
    r#"
    "use step";
    
    export async function processOrder(orderId) {
        return { processed: true };
    }
    
    export async function sendEmail(to, subject) {
        return { sent: true };
    }
    "#,
    // Output codes after transformed with plugin
    r#"import { useStep } from "@vercel/workflow-core/dist/step";
export const processOrder = useStep("processOrder");
export const sendEmail = useStep("sendEmail");"#
);
