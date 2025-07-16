import { runStep as __private_run_step } from "@vercel/workflow-core/runtime";
export async function destructure({ a, b }) {
    return __private_run_step("destructure", {
        arguments: [
            {
                a,
                b
            }
        ]
    });
}
export async function process_array([first, second]) {
    return __private_run_step("process_array", {
        arguments: [
            [
                first,
                second
            ]
        ]
    });
}
export async function nested_destructure({ user: { name, age } }) {
    return __private_run_step("nested_destructure", {
        arguments: [
            {
                user: {
                    name,
                    age
                }
            }
        ]
    });
}
export async function with_defaults({ x = 10, y = 20 }) {
    return __private_run_step("with_defaults", {
        arguments: [
            {
                x,
                y
            }
        ]
    });
}
export async function with_rest({ a, b, ...rest }) {
    return __private_run_step("with_rest", {
        arguments: [
            {
                a,
                b,
                ...rest
            }
        ]
    });
}
export async function multiple({ a, b }, { c, d }) {
    return __private_run_step("multiple", {
        arguments: [
            {
                a,
                b
            },
            {
                c,
                d
            }
        ]
    });
}
export async function rest_top_level(a, b, ...rest) {
    return __private_run_step("rest_top_level", {
        arguments: [
            a,
            b,
            ...rest
        ]
    });
}
