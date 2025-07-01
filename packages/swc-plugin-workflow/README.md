# SWC Plugin for Workflow Directives

This is an SWC transform plugin that handles the `"use step"` directive for Vercel Workflow.

## Development

[Install rust](https://www.rust-lang.org/tools/install)

Add build target using rustup
```bash
rustup target add wasm32-unknown-unknown
```

Ensure you can test/build

```bash
cargo test
cargo check
cargo build
```

Release builds are done using `pnpm build`