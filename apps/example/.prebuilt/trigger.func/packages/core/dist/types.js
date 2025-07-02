import { types } from 'node:util';
export function getConstructorName(obj) {
    if (obj === null || obj === undefined) {
        return null;
    }
    const ctor = obj.constructor;
    if (!ctor || ctor.name === 'Object') {
        return null;
    }
    return ctor.name;
}
export function getConstructorNames(obj) {
    const proto = Object.getPrototypeOf(obj);
    const name = getConstructorName(proto);
    if (name === null) {
        return [];
    }
    return [name, ...getConstructorNames(proto)];
}
/**
 * `instanceof` operator that works across different `vm` contexts,
 * based on the `name` property of the constructors of the prototype chain.
 */
export function isInstanceOf(v, ctor) {
    return getConstructorNames(v).includes(ctor.name);
}
export function getErrorName(v) {
    if (types.isNativeError(v)) {
        return v.name;
    }
    return 'Error';
}
//# sourceMappingURL=types.js.map