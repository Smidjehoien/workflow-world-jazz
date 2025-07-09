#![allow(clippy::not_unsafe_ptr_arg_deref)]

use serde::Deserialize;
use swc_core::{
    ecma::{ast::*, visit::*},
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};
use swc_workflow::{StepTransform, TransformMode};

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
