export async function destructure({ a, b }) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("destructure")({
        a,
        b
    });
}
export async function process_array([first, second]) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("process_array")([
        first,
        second
    ]);
}
export async function nested_destructure({ user: { name, age } }) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("nested_destructure")({
        user: {
            name,
            age
        }
    });
}
export async function with_defaults({ x = 10, y = 20 }) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("with_defaults")({
        x,
        y
    });
}
export async function with_rest({ a, b, ...rest }) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("with_rest")({
        a,
        b,
        ...rest
    });
}
export async function multiple({ a, b }, { c, d }) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("multiple")({
        a,
        b
    }, {
        c,
        d
    });
}
export async function rest_top_level(a, b, ...rest) {
    return globalThis[Symbol.for("WORKFLOW_USE_STEP")]("rest_top_level")(
        a,
        b,
        ...rest
    );
}
