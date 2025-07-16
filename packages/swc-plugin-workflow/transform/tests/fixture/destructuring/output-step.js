import { registerStepFunction } from "@vercel/workflow-core/private";
export async function destructure({ a, b }) {
    return a + b;
}
export async function process_array([first, second]) {
    return first + second;
}
export async function nested_destructure({ user: { name, age } }) {
    return `${name} is ${age} years old`;
}
export async function with_defaults({ x = 10, y = 20 }) {
    return x + y;
}
export async function with_rest({ a, b, ...rest }) {
    return {
        a,
        b,
        rest
    };
}
export async function multiple({ a, b }, { c, d }) {
    return {
        a,
        b,
        c,
        d
    };
}
export async function rest_top_level(a, b, ...rest) {
    return {
        a,
        b,
        rest
    };
}
registerStepFunction(destructure);
registerStepFunction(process_array);
registerStepFunction(nested_destructure);
registerStepFunction(with_defaults);
registerStepFunction(with_rest);
registerStepFunction(multiple);
registerStepFunction(rest_top_level);
