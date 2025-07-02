#!/bin/sh

set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  if [ "${CI:-0}" = "1" ]; then
    curl https://sh.rustup.rs -sSf | sh -s --  -y --profile minimal
    . "$HOME/.cargo/env"
    rustup target add wasm32-unknown-unknown
  else
    echo "Rust is required but not installed."
    echo "Please visit https://rustup.rs and follow the installation instructions."
    echo "After installing, run 'rustup target add wasm32-unknown-unknown'"
    exit 1
  fi
fi

cargo build-wasm32 --release
cp target/wasm32-unknown-unknown/release/swc_plugin_workflow.wasm .