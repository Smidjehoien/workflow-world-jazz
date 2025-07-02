var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/alea.js"(exports2, module2) {
    (function(global, module3, define2) {
      function Alea(seed) {
        var me = this, mash = Mash();
        me.next = function() {
          var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t - (me.c = t | 0);
        };
        me.c = 1;
        me.s0 = mash(" ");
        me.s1 = mash(" ");
        me.s2 = mash(" ");
        me.s0 -= mash(seed);
        if (me.s0 < 0) {
          me.s0 += 1;
        }
        me.s1 -= mash(seed);
        if (me.s1 < 0) {
          me.s1 += 1;
        }
        me.s2 -= mash(seed);
        if (me.s2 < 0) {
          me.s2 += 1;
        }
        mash = null;
      }
      function copy(f, t) {
        t.c = f.c;
        t.s0 = f.s0;
        t.s1 = f.s1;
        t.s2 = f.s2;
        return t;
      }
      function impl(seed, opts) {
        var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
        prng.int32 = function() {
          return xg.next() * 4294967296 | 0;
        };
        prng.double = function() {
          return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
        };
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      function Mash() {
        var n = 4022871197;
        var mash = function(data) {
          data = String(data);
          for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
          }
          return (n >>> 0) * 23283064365386963e-26;
        };
        return mash;
      }
      if (module3 && module3.exports) {
        module3.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.alea = impl;
      }
    })(
      exports2,
      typeof module2 == "object" && module2,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor128.js
var require_xor128 = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor128.js"(exports2, module2) {
    (function(global, module3, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.next = function() {
          var t = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
        };
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module3 && module3.exports) {
        module3.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor128 = impl;
      }
    })(
      exports2,
      typeof module2 == "object" && module2,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorwow.js
var require_xorwow = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorwow.js"(exports2, module2) {
    (function(global, module3, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var t = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
        };
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.v = 0;
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          if (k == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        t.v = f.v;
        t.d = f.d;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module3 && module3.exports) {
        module3.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorwow = impl;
      }
    })(
      exports2,
      typeof module2 == "object" && module2,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorshift7.js
var require_xorshift7 = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xorshift7.js"(exports2, module2) {
    (function(global, module3, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var X = me.x, i = me.i, t, v, w;
          t = X[i];
          t ^= t >>> 7;
          v = t ^ t << 24;
          t = X[i + 1 & 7];
          v ^= t ^ t >>> 10;
          t = X[i + 3 & 7];
          v ^= t ^ t >>> 3;
          t = X[i + 4 & 7];
          v ^= t ^ t << 7;
          t = X[i + 7 & 7];
          t = t ^ t << 13;
          v ^= t ^ t << 9;
          X[i] = v;
          me.i = i + 1 & 7;
          return v;
        };
        function init(me2, seed2) {
          var j, w, X = [];
          if (seed2 === (seed2 | 0)) {
            w = X[0] = seed2;
          } else {
            seed2 = "" + seed2;
            for (j = 0; j < seed2.length; ++j) {
              X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
            }
          }
          while (X.length < 8) X.push(0);
          for (j = 0; j < 8 && X[j] === 0; ++j) ;
          if (j == 8) w = X[7] = -1;
          else w = X[j];
          me2.x = X;
          me2.i = 0;
          for (j = 256; j > 0; --j) {
            me2.next();
          }
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.x = f.x.slice();
        t.i = f.i;
        return t;
      }
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.x) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module3 && module3.exports) {
        module3.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorshift7 = impl;
      }
    })(
      exports2,
      typeof module2 == "object" && module2,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor4096.js
var require_xor4096 = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/xor4096.js"(exports2, module2) {
    (function(global, module3, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var w = me.w, X = me.X, i = me.i, t, v;
          me.w = w = w + 1640531527 | 0;
          v = X[i + 34 & 127];
          t = X[i = i + 1 & 127];
          v ^= v << 13;
          t ^= t << 17;
          v ^= v >>> 15;
          t ^= t >>> 12;
          v = X[i] = v ^ t;
          me.i = i;
          return v + (w ^ w >>> 16) | 0;
        };
        function init(me2, seed2) {
          var t, v, i, j, w, X = [], limit = 128;
          if (seed2 === (seed2 | 0)) {
            v = seed2;
            seed2 = null;
          } else {
            seed2 = seed2 + "\0";
            v = 0;
            limit = Math.max(limit, seed2.length);
          }
          for (i = 0, j = -32; j < limit; ++j) {
            if (seed2) v ^= seed2.charCodeAt((j + 32) % seed2.length);
            if (j === 0) w = v;
            v ^= v << 10;
            v ^= v >>> 15;
            v ^= v << 4;
            v ^= v >>> 13;
            if (j >= 0) {
              w = w + 1640531527 | 0;
              t = X[j & 127] ^= v + w;
              i = 0 == t ? i + 1 : 0;
            }
          }
          if (i >= 128) {
            X[(seed2 && seed2.length || 0) & 127] = -1;
          }
          i = 127;
          for (j = 4 * 128; j > 0; --j) {
            v = X[i + 34 & 127];
            t = X[i = i + 1 & 127];
            v ^= v << 13;
            t ^= t << 17;
            v ^= v >>> 15;
            t ^= t >>> 12;
            X[i] = v ^ t;
          }
          me2.w = w;
          me2.X = X;
          me2.i = i;
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.i = f.i;
        t.w = f.w;
        t.X = f.X.slice();
        return t;
      }
      ;
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.X) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module3 && module3.exports) {
        module3.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor4096 = impl;
      }
    })(
      exports2,
      // window object or global
      typeof module2 == "object" && module2,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/tychei.js
var require_tychei = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/lib/tychei.js"(exports2, module2) {
    (function(global, module3, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var b = me.b, c = me.c, d = me.d, a = me.a;
          b = b << 25 ^ b >>> 7 ^ c;
          c = c - d | 0;
          d = d << 24 ^ d >>> 8 ^ a;
          a = a - b | 0;
          me.b = b = b << 20 ^ b >>> 12 ^ c;
          me.c = c = c - d | 0;
          me.d = d << 16 ^ c >>> 16 ^ a;
          return me.a = a - b | 0;
        };
        me.a = 0;
        me.b = 0;
        me.c = 2654435769 | 0;
        me.d = 1367130551;
        if (seed === Math.floor(seed)) {
          me.a = seed / 4294967296 | 0;
          me.b = seed | 0;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 20; k++) {
          me.b ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.a = f.a;
        t.b = f.b;
        t.c = f.c;
        t.d = f.d;
        return t;
      }
      ;
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module3 && module3.exports) {
        module3.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.tychei = impl;
      }
    })(
      exports2,
      typeof module2 == "object" && module2,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/seedrandom.js
var require_seedrandom = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/seedrandom.js"(exports2, module2) {
    (function(global, pool, math) {
      var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
      function seedrandom(seed, options, callback) {
        var key = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten(
          options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
          3
        ), key);
        var arc4 = new ARC4(key);
        var prng = function() {
          var n = arc4.g(chunks), d = startdenom, x = 0;
          while (n < significance) {
            n = (n + x) * width;
            d *= width;
            x = arc4.g(1);
          }
          while (n >= overflow) {
            n /= 2;
            d /= 2;
            x >>>= 1;
          }
          return (n + x) / d;
        };
        prng.int32 = function() {
          return arc4.g(4) | 0;
        };
        prng.quick = function() {
          return arc4.g(4) / 4294967296;
        };
        prng.double = prng;
        mixkey(tostring(arc4.S), pool);
        return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
          if (state) {
            if (state.S) {
              copy(state, arc4);
            }
            prng2.state = function() {
              return copy(arc4, {});
            };
          }
          if (is_math_call) {
            math[rngname] = prng2;
            return seed2;
          } else return prng2;
        })(
          prng,
          shortseed,
          "global" in options ? options.global : this == math,
          options.state
        );
      }
      function ARC4(key) {
        var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
        if (!keylen) {
          key = [keylen++];
        }
        while (i < width) {
          s[i] = i++;
        }
        for (i = 0; i < width; i++) {
          s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
          s[j] = t;
        }
        (me.g = function(count) {
          var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
          while (count--) {
            t2 = s2[i2 = mask & i2 + 1];
            r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t2]) + (s2[j2] = t2)];
          }
          me.i = i2;
          me.j = j2;
          return r;
        })(width);
      }
      function copy(f, t) {
        t.i = f.i;
        t.j = f.j;
        t.S = f.S.slice();
        return t;
      }
      ;
      function flatten(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten(obj[prop], depth - 1));
            } catch (e) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed, key) {
        var stringseed = seed + "", smear, j = 0;
        while (j < stringseed.length) {
          key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
        }
        return tostring(key);
      }
      function autoseed() {
        try {
          var out;
          if (nodecrypto && (out = nodecrypto.randomBytes)) {
            out = out(width);
          } else {
            out = new Uint8Array(width);
            (global.crypto || global.msCrypto).getRandomValues(out);
          }
          return tostring(out);
        } catch (e) {
          var browser = global.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
        }
      }
      function tostring(a) {
        return String.fromCharCode.apply(0, a);
      }
      mixkey(math.random(), pool);
      if (typeof module2 == "object" && module2.exports) {
        module2.exports = seedrandom;
        try {
          nodecrypto = require("crypto");
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom;
        });
      } else {
        math["seed" + rngname] = seedrandom;
      }
    })(
      // global: `self` in browsers (including strict mode and web workers),
      // otherwise `this` in Node and other environments
      typeof self !== "undefined" ? self : exports2,
      [],
      // pool: entropy pool starts empty
      Math
      // math: package containing random, pow, and seedrandom
    );
  }
});

// ../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/index.js
var require_seedrandom2 = __commonJS({
  "../../node_modules/.pnpm/seedrandom@3.0.5/node_modules/seedrandom/index.js"(exports2, module2) {
    var alea = require_alea();
    var xor128 = require_xor128();
    var xorwow = require_xorwow();
    var xorshift7 = require_xorshift7();
    var xor4096 = require_xor4096();
    var tychei = require_tychei();
    var sr = require_seedrandom();
    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;
    module2.exports = sr;
  }
});

// ../../packages/vm/dist/index.js
var require_dist = __commonJS({
  "../../packages/vm/dist/index.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createContext = createContext2;
    var node_vm_1 = require("node:vm");
    var seedrandom_1 = __importDefault(require_seedrandom2());
    function createContext2(options) {
      let { fixedTimestamp } = options;
      const { seed } = options;
      const rng = (0, seedrandom_1.default)(seed);
      const context = (0, node_vm_1.createContext)();
      const g = (0, node_vm_1.runInContext)("globalThis", context);
      g.Math.random = rng;
      const Date_ = g.Date;
      g.Date = function Date2(...args) {
        if (args.length === 0) {
          return new Date_(fixedTimestamp);
        }
        return new Date_(...args);
      };
      Object.setPrototypeOf(g.Date, Date_);
      g.Date.now = () => fixedTimestamp;
      const originalCrypto = globalThis.crypto;
      const originalSubtle = originalCrypto.subtle;
      function getRandomValues(array) {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(rng() * 256);
        }
        return array;
      }
      function randomUUID() {
        const chars = "0123456789abcdef";
        let uuid = "";
        for (let i = 0; i < 36; i++) {
          if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += "-";
          } else if (i === 14) {
            uuid += "4";
          } else if (i === 19) {
            uuid += chars[Math.floor(rng() * 4) + 8];
          } else {
            uuid += chars[Math.floor(rng() * 16)];
          }
        }
        return uuid;
      }
      const boundDigest = originalSubtle.digest.bind(originalSubtle);
      g.crypto = new Proxy(originalCrypto, {
        get(target, prop) {
          if (prop === "getRandomValues") {
            return getRandomValues;
          }
          if (prop === "randomUUID") {
            return randomUUID;
          }
          if (prop === "subtle") {
            return new Proxy(originalSubtle, {
              get(target2, prop2) {
                if (prop2 === "generateKey") {
                  return () => {
                    throw new Error("Not implemented");
                  };
                } else if (prop2 === "digest") {
                  return boundDigest;
                }
                return target2[prop2];
              }
            });
          }
          return target[prop];
        }
      });
      g.TextEncoder = globalThis.TextEncoder;
      g.TextDecoder = globalThis.TextDecoder;
      g.exports = {};
      return {
        context,
        updateTimestamp: (timestamp) => {
          fixedTimestamp = timestamp;
        }
      };
    }
  }
});

// api/trigger.ts
var trigger_exports = {};
__export(trigger_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(trigger_exports);

// ../../node_modules/.pnpm/mixpart@0.0.4/node_modules/mixpart/dist/index.mjs
var MultipartParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MultipartParseError";
  }
};
function createSearch(pattern) {
  const needle = new TextEncoder().encode(pattern);
  return (haystack, start2 = 0) => Buffer.prototype.indexOf.call(haystack, needle, start2);
}
function createPartialTailSearch(pattern) {
  const needle = new TextEncoder().encode(pattern);
  const byteIndexes = {};
  for (let i = 0; i < needle.length; ++i) {
    const byte = needle[i];
    if (byteIndexes[byte] === void 0) byteIndexes[byte] = [];
    byteIndexes[byte].push(i);
  }
  return function(haystack) {
    const haystackEnd = haystack.length - 1;
    if (haystack[haystackEnd] in byteIndexes) {
      const indexes = byteIndexes[haystack[haystackEnd]];
      for (let i = indexes.length - 1; i >= 0; --i) {
        for (let j = indexes[i], k = haystackEnd; j >= 0 && haystack[k] === needle[j]; --j, --k) {
          if (j === 0) return k;
        }
      }
    }
    return -1;
  };
}
function parseHeaders(headerBytes) {
  const headerText = new TextDecoder("iso-8859-1").decode(headerBytes);
  const lines = headerText.trim().split(/\r?\n/);
  const headerInit = [];
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const name = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      headerInit.push([name, value]);
    }
  }
  return new Headers(headerInit);
}
function extractBoundary(contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new MultipartParseError("No boundary found in Content-Type header");
  }
  return boundaryMatch[1] ?? boundaryMatch[2];
}
var AsyncMessageQueue = class {
  queue = [];
  waiters = [];
  finished = false;
  cancelled = false;
  error = null;
  /**
   * Producer: Enqueue a message for consumption
   */
  enqueue(message) {
    if (this.finished || this.cancelled) return;
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter.resolve(message);
    } else {
      this.queue.push(message);
    }
  }
  /**
   * Producer: Signal completion (with optional error)
   */
  finish(error) {
    if (this.finished) return;
    this.finished = true;
    this.error = error || null;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (error) {
        waiter.reject(error);
      } else {
        waiter.resolve(null);
      }
    }
  }
  /**
   * Consumer: Cancel the queue (stops accepting new messages and notifies waiters)
   */
  cancel() {
    if (this.cancelled || this.finished) return;
    this.cancelled = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter.resolve(null);
    }
  }
  /**
   * Consumer: Dequeue next message (or null if finished/cancelled)
   */
  async dequeue() {
    if (this.queue.length > 0) {
      return this.queue.shift();
    }
    if (this.finished || this.cancelled) {
      if (this.error) throw this.error;
      return null;
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }
  /**
   * Check if the queue is in a terminal state
   */
  get isTerminal() {
    return this.finished || this.cancelled;
  }
};
async function* parseMultipartStream(response, options) {
  if (!response.body) {
    throw new MultipartParseError("Response body is null");
  }
  const contentType = response.headers.get("content-type");
  if (!contentType) {
    throw new MultipartParseError("Missing Content-Type header");
  }
  const boundary = extractBoundary(contentType);
  const parser = new StreamingMultipartParser(boundary, options);
  yield* parser.parseStream(response.body);
}
var StreamingMultipartParser = class {
  boundary;
  findOpeningBoundary;
  openingBoundaryLength;
  findBoundary;
  findPartialTailBoundary;
  boundaryLength;
  findDoubleNewline;
  // Safety limits
  maxHeaderSize;
  maxBoundaryBuffer;
  state = 0;
  buffer = null;
  currentHeaders = new Headers();
  currentPayloadController = null;
  constructor(boundary, options = {}) {
    this.boundary = boundary;
    this.findOpeningBoundary = createSearch(`--${boundary}`);
    this.openingBoundaryLength = 2 + boundary.length;
    this.findBoundary = createSearch(`\r
--${boundary}`);
    this.findPartialTailBoundary = createPartialTailSearch(`\r
--${boundary}`);
    this.boundaryLength = 4 + boundary.length;
    this.findDoubleNewline = createSearch("\r\n\r\n");
    this.maxHeaderSize = options.maxHeaderSize ?? 65536;
    this.maxBoundaryBuffer = options.maxBoundaryBuffer ?? 8192;
  }
  async *parseStream(stream) {
    const reader = stream.getReader();
    const messageQueue = new AsyncMessageQueue();
    const producer = this.startProducer(reader, messageQueue);
    try {
      yield* this.consumeMessages(messageQueue);
    } finally {
      messageQueue.cancel();
      this.closeCurrentPayload();
      try {
        await reader.cancel();
      } catch (error) {
      }
      await producer;
    }
  }
  /**
   * Producer: Continuously read chunks and parse messages
   */
  async startProducer(reader, messageQueue) {
    try {
      while (!messageQueue.isTerminal) {
        let result;
        try {
          result = await reader.read();
        } catch (readError) {
          if (readError instanceof Error && (readError.name === "AbortError" || readError.constructor.name === "AbortError" || readError.name === "TimeoutError" || readError.constructor.name === "TimeoutError")) {
            break;
          }
          throw readError;
        }
        const { done, value } = result;
        if (done) {
          if (this.buffer !== null && this.buffer.length > 0) {
            const messages2 = this.write(new Uint8Array(0));
            for (const message of messages2) {
              if (messageQueue.isTerminal) break;
              messageQueue.enqueue(message);
            }
          }
          if (this.state !== 4) {
            if (this.state === 0) {
              throw new MultipartParseError(
                "Invalid multipart stream: missing initial boundary"
              );
            }
            throw new MultipartParseError("Unexpected end of stream");
          }
          break;
        }
        if (!(value instanceof Uint8Array)) {
          throw new MultipartParseError(
            `Invalid chunk type: expected Uint8Array, got ${typeof value}`
          );
        }
        const messages = this.write(value);
        for (const message of messages) {
          if (messageQueue.isTerminal) break;
          messageQueue.enqueue(message);
        }
      }
      if (!messageQueue.isTerminal) {
        messageQueue.finish();
      }
    } catch (error) {
      this.closeCurrentPayload(error);
      if (!messageQueue.isTerminal) {
        messageQueue.finish(error);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (error) {
      }
    }
  }
  /**
   * Consumer: Yield messages from the queue
   */
  async *consumeMessages(messageQueue) {
    while (true) {
      const message = await messageQueue.dequeue();
      if (message === null) {
        break;
      }
      yield message;
    }
  }
  /**
   * Process a chunk of data through the state machine and return any complete messages.
   *
   * Returns an array because a single chunk can contain multiple complete messages
   * when small messages with headers + body + boundary all fit in one network chunk.
   * All messages must be captured and queued to maintain proper message ordering.
   */
  write(chunk) {
    const newMessages = [];
    if (this.state === 4) {
      throw new MultipartParseError("Unexpected data after end of stream");
    }
    let index = 0;
    let chunkLength = chunk.length;
    if (this.buffer !== null) {
      const newSize = this.buffer.length + chunkLength;
      const maxAllowedSize = this.state === 2 ? this.maxHeaderSize : this.maxBoundaryBuffer;
      if (newSize > maxAllowedSize) {
        throw new MultipartParseError(
          `Buffer size limit exceeded: ${newSize} bytes > ${maxAllowedSize} bytes. This may indicate malformed multipart data with ${this.state === 2 ? "oversized headers" : "invalid boundaries"}.`
        );
      }
      const newChunk = new Uint8Array(newSize);
      newChunk.set(this.buffer, 0);
      newChunk.set(chunk, this.buffer.length);
      chunk = newChunk;
      chunkLength = chunk.length;
      this.buffer = null;
    }
    if (chunkLength === 0 && this.state === 0) {
      throw new MultipartParseError(
        "Invalid multipart stream: missing initial boundary"
      );
    }
    while (true) {
      if (this.state === 3) {
        if (chunkLength - index < this.boundaryLength) {
          const remainingData = chunk.subarray(index);
          if (remainingData.length > this.maxBoundaryBuffer) {
            throw new MultipartParseError(
              `Boundary buffer limit exceeded: ${remainingData.length} > ${this.maxBoundaryBuffer}`
            );
          }
          this.buffer = remainingData;
          break;
        }
        const boundaryIndex = this.findBoundary(chunk, index);
        if (boundaryIndex === -1) {
          const partialTailIndex = this.findPartialTailBoundary(chunk);
          if (partialTailIndex === -1) {
            this.writeBody(index === 0 ? chunk : chunk.subarray(index));
          } else {
            this.writeBody(chunk.subarray(index, partialTailIndex));
            const partialBoundary = chunk.subarray(partialTailIndex);
            if (partialBoundary.length > this.maxBoundaryBuffer) {
              throw new MultipartParseError(
                `Partial boundary too large: ${partialBoundary.length} > ${this.maxBoundaryBuffer}`
              );
            }
            this.buffer = partialBoundary;
          }
          break;
        }
        this.writeBody(chunk.subarray(index, boundaryIndex));
        this.finishMessage();
        index = boundaryIndex + this.boundaryLength;
        this.state = 1;
      }
      if (this.state === 1) {
        if (chunkLength - index < 2) {
          const remainingData = chunk.subarray(index);
          if (remainingData.length > this.maxBoundaryBuffer) {
            throw new MultipartParseError(
              `After-boundary buffer limit exceeded: ${remainingData.length} > ${this.maxBoundaryBuffer}`
            );
          }
          this.buffer = remainingData;
          break;
        }
        if (chunk[index] === 45 && chunk[index + 1] === 45) {
          this.state = 4;
          break;
        }
        if (chunk[index] === 13 && chunk[index + 1] === 10) {
          index += 2;
        } else if (chunk[index] === 10) {
          index += 1;
        } else {
          throw new MultipartParseError(
            `Invalid character after boundary: expected CRLF or LF, got 0x${chunk[index].toString(16)}`
          );
        }
        this.state = 2;
      }
      if (this.state === 2) {
        if (chunkLength - index < 4) {
          const remainingData = chunk.subarray(index);
          if (remainingData.length > this.maxHeaderSize) {
            throw new MultipartParseError(
              `Header buffer limit exceeded: ${remainingData.length} > ${this.maxHeaderSize}`
            );
          }
          this.buffer = remainingData;
          break;
        }
        let headerEndIndex = this.findDoubleNewline(chunk, index);
        let headerEndOffset = 4;
        if (headerEndIndex === -1) {
          const lfDoubleNewline = createSearch("\n\n");
          headerEndIndex = lfDoubleNewline(chunk, index);
          headerEndOffset = 2;
        }
        if (headerEndIndex === -1) {
          const headerData = chunk.subarray(index);
          if (headerData.length > this.maxHeaderSize) {
            throw new MultipartParseError(
              `Headers too large: ${headerData.length} > ${this.maxHeaderSize} bytes`
            );
          }
          this.buffer = headerData;
          break;
        }
        const headerBytes = chunk.subarray(index, headerEndIndex);
        this.currentHeaders = parseHeaders(headerBytes);
        const message = this.createStreamingMessage();
        newMessages.push(message);
        index = headerEndIndex + headerEndOffset;
        this.state = 3;
        continue;
      }
      if (this.state === 0) {
        if (chunkLength < this.openingBoundaryLength) {
          if (chunk.length > this.maxBoundaryBuffer) {
            throw new MultipartParseError(
              `Initial chunk too large for boundary detection: ${chunk.length} > ${this.maxBoundaryBuffer}`
            );
          }
          this.buffer = chunk;
          break;
        }
        const boundaryIndex = this.findOpeningBoundary(chunk);
        if (boundaryIndex !== 0) {
          throw new MultipartParseError(
            "Invalid multipart stream: missing initial boundary"
          );
        }
        index = this.openingBoundaryLength;
        this.state = 1;
      }
    }
    return newMessages;
  }
  createStreamingMessage() {
    const headers = new Headers(this.currentHeaders);
    const payload = new ReadableStream({
      start: (controller) => {
        this.currentPayloadController = controller;
      }
    });
    this.currentHeaders = new Headers();
    return {
      headers,
      payload
    };
  }
  writeBody(chunk) {
    if (this.currentPayloadController) {
      this.currentPayloadController.enqueue(chunk);
    }
  }
  finishMessage() {
    if (this.currentPayloadController) {
      this.currentPayloadController.close();
      this.currentPayloadController = null;
    }
  }
  /**
   * Close current payload controller if open (used during cleanup)
   * If an error is provided, forwards it to the payload consumer
   */
  closeCurrentPayload(error) {
    if (this.currentPayloadController) {
      try {
        if (error) {
          this.currentPayloadController.error(error);
        } else {
          this.currentPayloadController.close();
        }
      } catch (controllerError) {
      }
      this.currentPayloadController = null;
    }
  }
};

// ../../node_modules/.pnpm/@vercel+queue@0.0.0-alpha.4/node_modules/@vercel/queue/dist/index.mjs
var import_child_process = require("child_process");
function isLocalhostWithPort(url) {
  try {
    const parsedUrl = new URL(url);
    const isLocalhost = parsedUrl.hostname === "localhost";
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 0;
    return { isLocalhost, port };
  } catch {
    return { isLocalhost: false };
  }
}
function isSupportedPlatform() {
  const platform = process.platform;
  return platform === "darwin" || platform === "linux";
}
function processDevelopmentCallbacks(callbacks) {
  const isDevelopment = process.env.NODE_ENV === "development";
  if (!isDevelopment) {
    return [];
  }
  if (!isSupportedPlatform()) {
    const hasLocalhostCallbacks = Object.values(callbacks).some((config) => {
      const { isLocalhost } = isLocalhostWithPort(config.url);
      return isLocalhost;
    });
    if (hasLocalhostCallbacks) {
      console.warn(
        `Queue Development Mode: Localhost callbacks are not supported on ${process.platform}. Localhost callback handling requires bash, nc, and curl which are available on macOS and Linux only. Consider using a production callback URL or developing on a supported platform.`
      );
    }
    return [];
  }
  const localhostCallbacks = [];
  Object.entries(callbacks).forEach(([group, config]) => {
    const { isLocalhost, port } = isLocalhostWithPort(config.url);
    if (isLocalhost && port && port > 0) {
      localhostCallbacks.push({ group, config, port });
    } else {
      console.warn(
        `Queue Development Mode: Skipping non-localhost callback for group "${group}": ${config.url}. Only localhost callbacks with explicit ports are supported in development.`
      );
    }
  });
  return localhostCallbacks;
}
function fireLocalhostCallbacks(localhostCallbacks, queueName, responseData) {
  localhostCallbacks.forEach(({ group, config, port }) => {
    const callbackHeaders = new Headers();
    callbackHeaders.set("Vqs-Message-Id", responseData.messageId);
    callbackHeaders.set("Vqs-Queue-Name", queueName);
    callbackHeaders.set("Vqs-Consumer-Group", group);
    fireAndForgetWaitForHttpReady(
      config.url,
      port,
      config.delay || 0,
      3,
      // Default retry frequency
      callbackHeaders
    );
  });
}
function fireAndForgetWaitForHttpReady(url, port, initialDelaySeconds = 0, retryFrequencySeconds = 3, headers) {
  if (!isSupportedPlatform()) {
    console.warn(
      `Queue: fireAndForgetWaitForHttpReady is not supported on ${process.platform}. This function requires bash, nc, and curl which are available on macOS and Linux only.`
    );
    return;
  }
  let headerArgs = "";
  if (headers) {
    const headerArray = [];
    headers.forEach((value, key) => {
      headerArray.push(`-H '${key}: ${value}'`);
    });
    headerArgs = headerArray.join(" ");
  }
  const bashScript = `
    # Wait for any initial boot time
    sleep ${initialDelaySeconds}

    missed=0
    while true; do
      # 1) Check if TCP port is listening
      if nc -z localhost ${port} 2>/dev/null; then
        missed=0
        # 2) If port is open, try HTTP POST check
        if curl -sSL --fail -o /dev/null -X POST ${headerArgs} "${url}"; then
          # Success: port is up AND HTTP returned 2xx (following redirects)
          exit 0
        fi
      else
        # Port was closed\u2014increment miss counter
        ((missed+=1))
        # If closed twice in a row, give up immediately
        if [ "$missed" -ge 2 ]; then
          exit 1
        fi
      fi
      # Wait before next cycle
      sleep ${retryFrequencySeconds}
    done
  `;
  const childProcess = (0, import_child_process.spawn)("bash", ["-c", bashScript], {
    stdio: "ignore",
    detached: true
  });
  childProcess.unref();
}
var MessageNotFoundError = class extends Error {
  constructor(messageId) {
    super(`Message ${messageId} not found`);
    this.name = "MessageNotFoundError";
  }
};
var MessageNotAvailableError = class extends Error {
  constructor(messageId, reason) {
    super(
      `Message ${messageId} not available for processing${reason ? `: ${reason}` : ""}`
    );
    this.name = "MessageNotAvailableError";
  }
};
var MessageCorruptedError = class extends Error {
  constructor(messageId, reason) {
    super(`Message ${messageId} is corrupted: ${reason}`);
    this.name = "MessageCorruptedError";
  }
};
var QueueEmptyError = class extends Error {
  constructor(queueName, consumerGroup) {
    super(
      `No messages available in queue "${queueName}" for consumer group "${consumerGroup}"`
    );
    this.name = "QueueEmptyError";
  }
};
var MessageLockedError = class extends Error {
  retryAfter;
  constructor(messageId, retryAfter) {
    const retryMessage = retryAfter ? ` Retry after ${retryAfter} seconds.` : " Try again later.";
    super(`Message ${messageId} is temporarily locked.${retryMessage}`);
    this.name = "MessageLockedError";
    this.retryAfter = retryAfter;
  }
};
var UnauthorizedError = class extends Error {
  constructor(message = "Missing or invalid authentication token") {
    super(message);
    this.name = "UnauthorizedError";
  }
};
var ForbiddenError = class extends Error {
  constructor(message = "Queue environment doesn't match token environment") {
    super(message);
    this.name = "ForbiddenError";
  }
};
var BadRequestError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestError";
  }
};
var FailedDependencyError = class extends Error {
  constructor(messageId) {
    super(
      `Failed dependency: FIFO ordering violation for message ${messageId}`
    );
    this.name = "FailedDependencyError";
  }
};
var InternalServerError = class extends Error {
  constructor(message = "Unexpected server error") {
    super(message);
    this.name = "InternalServerError";
  }
};
var InvalidLimitError = class extends Error {
  constructor(limit, min = 1, max = 10) {
    super(`Invalid limit: ${limit}. Limit must be between ${min} and ${max}.`);
    this.name = "InvalidLimitError";
  }
};
async function consumeStream(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
function parseQueueHeaders(headers) {
  const messageId = headers.get("Vqs-Message-Id");
  const deliveryCountStr = headers.get("Vqs-Delivery-Count") || "0";
  const timestamp = headers.get("Vqs-Timestamp");
  const contentType = headers.get("Content-Type") || "application/octet-stream";
  const ticket = headers.get("Vqs-Ticket");
  if (!messageId || !timestamp || !ticket) {
    return null;
  }
  const deliveryCount = parseInt(deliveryCountStr, 10);
  if (isNaN(deliveryCount)) {
    return null;
  }
  return {
    messageId,
    deliveryCount,
    timestamp,
    contentType,
    ticket
  };
}
var QueueClient = class _QueueClient {
  baseUrl;
  token;
  /**
   * Internal default instance for use by createTopic and other convenience functions
   * @internal
   */
  static _defaultInstance = null;
  /**
   * Create a new Vercel Queue Service client
   * @param options Client configuration options (optional - will auto-detect Vercel Function environment)
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "https://vqs.vercel.sh";
    if (options.token) {
      this.token = options.token;
    } else {
      const token = this.getVercelOidcTokenSync();
      if (!token) {
        throw new Error(
          "Failed to get OIDC token from Vercel Functions. Make sure you are running in a Vercel Function environment, or provide a token explicitly.\n\nTo set up your environment:\n1. Link your project: 'vercel link'\n2. Pull environment variables: 'vercel env pull'\n3. Run with environment: 'dotenv -e .env.local -- your-command'"
        );
      }
      this.token = token;
    }
  }
  /**
   * Get the default client instance for internal use by convenience functions
   * @internal
   */
  static _getDefaultInstance() {
    if (!this._defaultInstance) {
      this._defaultInstance = new _QueueClient();
    }
    return this._defaultInstance;
  }
  /**
   * Synchronously get OIDC token from environment
   * Used internally by constructor - mirrors the logic from getVercelOidcToken but synchronously
   */
  getVercelOidcTokenSync() {
    try {
      const SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");
      const fromSymbol = globalThis;
      const context = fromSymbol[SYMBOL_FOR_REQ_CONTEXT]?.get?.() ?? {};
      const token = context.headers?.["x-vercel-oidc-token"] ?? process.env.VERCEL_OIDC_TOKEN;
      return token || null;
    } catch {
      return null;
    }
  }
  /**
   * Send a message to a queue
   * @param options Send message options
   * @param transport Serializer/deserializer for the payload
   * @returns Promise with the message ID
   * @throws {BadRequestError} When request parameters are invalid
   * @throws {UnauthorizedError} When authentication fails
   * @throws {ForbiddenError} When access is denied (environment mismatch)
   * @throws {InternalServerError} When server encounters an error
   */
  async sendMessage(options, transport) {
    const { queueName, payload, idempotencyKey, retentionSeconds, callback } = options;
    const headers = new Headers({
      Authorization: `Bearer ${this.token}`,
      "Vqs-Queue-Name": queueName,
      "Content-Type": transport.contentType
    });
    if (idempotencyKey) {
      headers.set("Vqs-Idempotency-Key", idempotencyKey);
    }
    if (retentionSeconds !== void 0) {
      headers.set("Vqs-Retention-Seconds", retentionSeconds.toString());
    }
    let normalizedCallbacks;
    if (callback) {
      if ("url" in callback && typeof callback.url === "string") {
        normalizedCallbacks = { default: callback };
      } else {
        normalizedCallbacks = callback;
      }
    }
    let localhostCallbacks = [];
    if (normalizedCallbacks) {
      const isDevelopment = process.env.NODE_ENV === "development";
      if (isDevelopment) {
        localhostCallbacks = processDevelopmentCallbacks(normalizedCallbacks);
      } else {
        const endpoints = Object.entries(normalizedCallbacks).map(
          ([group, config]) => `${group}=${Buffer.from(config.url).toString("base64")}`
        ).join(",");
        headers.set("Vqs-Callback-Url", endpoints);
        const delays = Object.entries(normalizedCallbacks).filter(([, config]) => config.delay !== void 0).map(([group, config]) => `${group}=${config.delay}`).join(",");
        if (delays) {
          headers.set("Vqs-Callback-Delay", delays);
        }
        const frequencies = Object.entries(normalizedCallbacks).filter(([, config]) => config.frequency !== void 0).map(([group, config]) => `${group}=${config.frequency}`).join(",");
        if (frequencies) {
          headers.set("Vqs-Callback-Frequency", frequencies);
        }
      }
    }
    const body = transport.serialize(payload);
    const response = await fetch(`${this.baseUrl}/api/v2/messages`, {
      method: "POST",
      headers,
      body
    });
    if (!response.ok) {
      if (response.status === 400) {
        const errorText = await response.text();
        throw new BadRequestError(errorText || "Invalid parameters");
      }
      if (response.status === 401) {
        throw new UnauthorizedError();
      }
      if (response.status === 403) {
        throw new ForbiddenError();
      }
      if (response.status === 409) {
        throw new Error("Duplicate idempotency key detected");
      }
      if (response.status >= 500) {
        throw new InternalServerError(
          `Server error: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        `Failed to send message: ${response.status} ${response.statusText}`
      );
    }
    const responseData = await response.json();
    if (localhostCallbacks.length > 0) {
      fireLocalhostCallbacks(localhostCallbacks, queueName, responseData);
    }
    return responseData;
  }
  /**
   * Receive messages from a queue
   * @param options Receive messages options
   * @param transport Serializer/deserializer for the payload
   * @returns AsyncGenerator that yields messages as they arrive
   * @throws {InvalidLimitError} When limit parameter is not between 1 and 10
   * @throws {QueueEmptyError} When no messages are available (204)
   * @throws {MessageLockedError} When FIFO queue has locked messages (423)
   * @throws {BadRequestError} When request parameters are invalid
   * @throws {UnauthorizedError} When authentication fails
   * @throws {ForbiddenError} When access is denied (environment mismatch)
   * @throws {InternalServerError} When server encounters an error
   */
  async *receiveMessages(options, transport) {
    const { queueName, consumerGroup, visibilityTimeoutSeconds, limit } = options;
    if (limit !== void 0 && (limit < 1 || limit > 10)) {
      throw new InvalidLimitError(limit);
    }
    const headers = new Headers({
      Authorization: `Bearer ${this.token}`,
      "Vqs-Queue-Name": queueName,
      "Vqs-Consumer-Group": consumerGroup,
      Accept: "multipart/mixed"
    });
    if (visibilityTimeoutSeconds !== void 0) {
      headers.set(
        "Vqs-Visibility-Timeout",
        visibilityTimeoutSeconds.toString()
      );
    }
    if (limit !== void 0) {
      headers.set("Vqs-Limit", limit.toString());
    }
    const response = await fetch(`${this.baseUrl}/api/v2/messages`, {
      method: "GET",
      headers
    });
    if (response.status === 204) {
      throw new QueueEmptyError(queueName, consumerGroup);
    }
    if (!response.ok) {
      if (response.status === 400) {
        const errorText = await response.text();
        throw new BadRequestError(errorText || "Invalid parameters");
      }
      if (response.status === 401) {
        throw new UnauthorizedError();
      }
      if (response.status === 403) {
        throw new ForbiddenError();
      }
      if (response.status === 423) {
        const retryAfterHeader = response.headers.get("Retry-After");
        let retryAfter;
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          retryAfter = isNaN(parsed) ? void 0 : parsed;
        }
        throw new MessageLockedError("next message in FIFO queue", retryAfter);
      }
      if (response.status >= 500) {
        throw new InternalServerError(
          `Server error: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        `Failed to receive messages: ${response.status} ${response.statusText}`
      );
    }
    for await (const multipartMessage of parseMultipartStream(response)) {
      try {
        const parsedHeaders = parseQueueHeaders(multipartMessage.headers);
        if (!parsedHeaders) {
          console.warn("Missing required queue headers in multipart part");
          await consumeStream(multipartMessage.payload);
          continue;
        }
        const deserializedPayload = await transport.deserialize(
          multipartMessage.payload
        );
        const message = {
          ...parsedHeaders,
          payload: deserializedPayload
        };
        yield message;
      } catch (error) {
        console.warn("Failed to process multipart message:", error);
        await consumeStream(multipartMessage.payload);
      }
    }
  }
  async receiveMessageById(options, transport) {
    const {
      queueName,
      consumerGroup,
      messageId,
      visibilityTimeoutSeconds,
      skipPayload
    } = options;
    const headers = new Headers({
      Authorization: `Bearer ${this.token}`,
      "Vqs-Queue-Name": queueName,
      "Vqs-Consumer-Group": consumerGroup,
      Accept: "multipart/mixed"
    });
    if (visibilityTimeoutSeconds !== void 0) {
      headers.set(
        "Vqs-Visibility-Timeout",
        visibilityTimeoutSeconds.toString()
      );
    }
    if (skipPayload) {
      headers.set("Vqs-Skip-Payload", "1");
    }
    const response = await fetch(
      `${this.baseUrl}/api/v2/messages/${encodeURIComponent(messageId)}`,
      {
        method: "GET",
        headers
      }
    );
    if (!response.ok) {
      if (response.status === 400) {
        const errorText = await response.text();
        throw new BadRequestError(errorText || "Invalid parameters");
      }
      if (response.status === 401) {
        throw new UnauthorizedError();
      }
      if (response.status === 403) {
        throw new ForbiddenError();
      }
      if (response.status === 404) {
        throw new MessageNotFoundError(messageId);
      }
      if (response.status === 423) {
        const retryAfterHeader = response.headers.get("Retry-After");
        let retryAfter;
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          retryAfter = isNaN(parsed) ? void 0 : parsed;
        }
        throw new MessageLockedError(messageId, retryAfter);
      }
      if (response.status === 424) {
        throw new FailedDependencyError(messageId);
      }
      if (response.status === 409) {
        throw new MessageNotAvailableError(messageId);
      }
      if (response.status >= 500) {
        throw new InternalServerError(
          `Server error: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        `Failed to receive message by ID: ${response.status} ${response.statusText}`
      );
    }
    if (skipPayload && response.status === 204) {
      const parsedHeaders = parseQueueHeaders(response.headers);
      if (!parsedHeaders) {
        throw new MessageCorruptedError(
          messageId,
          "Missing required queue headers in 204 response"
        );
      }
      const message = {
        ...parsedHeaders,
        payload: void 0
      };
      return { message };
    }
    if (!transport) {
      throw new Error("Transport is required when skipPayload is not true");
    }
    try {
      for await (const multipartMessage of parseMultipartStream(response)) {
        try {
          const parsedHeaders = parseQueueHeaders(multipartMessage.headers);
          if (!parsedHeaders) {
            console.warn("Missing required queue headers in multipart part");
            await consumeStream(multipartMessage.payload);
            continue;
          }
          const deserializedPayload = await transport.deserialize(
            multipartMessage.payload
          );
          const message = {
            ...parsedHeaders,
            payload: deserializedPayload
          };
          return { message };
        } catch (error) {
          console.warn("Failed to deserialize message by ID:", error);
          await consumeStream(multipartMessage.payload);
          throw new MessageCorruptedError(
            messageId,
            `Failed to deserialize payload: ${error}`
          );
        }
      }
    } catch (error) {
      if (error instanceof MessageCorruptedError) {
        throw error;
      }
      throw new MessageCorruptedError(
        messageId,
        `Failed to parse multipart response: ${error}`
      );
    }
    throw new MessageNotFoundError(messageId);
  }
  /**
   * Delete a message (acknowledge processing)
   * @param options Delete message options
   * @returns Promise with delete status
   * @throws {MessageNotFoundError} When the message doesn't exist (404)
   * @throws {MessageNotAvailableError} When message can't be deleted (409)
   * @throws {BadRequestError} When ticket is missing or invalid (400)
   * @throws {UnauthorizedError} When authentication fails
   * @throws {ForbiddenError} When access is denied (environment mismatch)
   * @throws {InternalServerError} When server encounters an error
   */
  async deleteMessage(options) {
    const { queueName, consumerGroup, messageId, ticket } = options;
    const response = await fetch(
      `${this.baseUrl}/api/v2/messages/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        headers: new Headers({
          Authorization: `Bearer ${this.token}`,
          "Vqs-Queue-Name": queueName,
          "Vqs-Consumer-Group": consumerGroup,
          "Vqs-Ticket": ticket
        })
      }
    );
    if (!response.ok) {
      if (response.status === 400) {
        throw new BadRequestError("Missing or invalid ticket");
      }
      if (response.status === 401) {
        throw new UnauthorizedError();
      }
      if (response.status === 403) {
        throw new ForbiddenError();
      }
      if (response.status === 404) {
        throw new MessageNotFoundError(messageId);
      }
      if (response.status === 409) {
        throw new MessageNotAvailableError(
          messageId,
          "Invalid ticket, message not in correct state, or already processed"
        );
      }
      if (response.status >= 500) {
        throw new InternalServerError(
          `Server error: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        `Failed to delete message: ${response.status} ${response.statusText}`
      );
    }
    return { deleted: true };
  }
  /**
   * Change the visibility timeout of a message
   * @param options Change visibility options
   * @returns Promise with update status
   * @throws {MessageNotFoundError} When the message doesn't exist (404)
   * @throws {MessageNotAvailableError} When message can't be updated (409)
   * @throws {BadRequestError} When ticket is missing or visibility timeout invalid (400)
   * @throws {UnauthorizedError} When authentication fails
   * @throws {ForbiddenError} When access is denied (environment mismatch)
   * @throws {InternalServerError} When server encounters an error
   */
  async changeVisibility(options) {
    const {
      queueName,
      consumerGroup,
      messageId,
      ticket,
      visibilityTimeoutSeconds
    } = options;
    const response = await fetch(
      `${this.baseUrl}/api/v2/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        headers: new Headers({
          Authorization: `Bearer ${this.token}`,
          "Vqs-Queue-Name": queueName,
          "Vqs-Consumer-Group": consumerGroup,
          "Vqs-Ticket": ticket,
          "Vqs-Visibility-Timeout": visibilityTimeoutSeconds.toString()
        })
      }
    );
    if (!response.ok) {
      if (response.status === 400) {
        throw new BadRequestError(
          "Missing ticket or invalid visibility timeout"
        );
      }
      if (response.status === 401) {
        throw new UnauthorizedError();
      }
      if (response.status === 403) {
        throw new ForbiddenError();
      }
      if (response.status === 404) {
        throw new MessageNotFoundError(messageId);
      }
      if (response.status === 409) {
        throw new MessageNotAvailableError(
          messageId,
          "Invalid ticket, message not in correct state, or already processed"
        );
      }
      if (response.status >= 500) {
        throw new InternalServerError(
          `Server error: ${response.status} ${response.statusText}`
        );
      }
      throw new Error(
        `Failed to change visibility: ${response.status} ${response.statusText}`
      );
    }
    return { updated: true };
  }
};
var JsonTransport = class {
  contentType = "application/json";
  serialize(value) {
    return Buffer.from(JSON.stringify(value), "utf8");
  }
  async deserialize(stream) {
    const reader = stream.getReader();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(Buffer.from(buffer).toString("utf8"));
  }
};
async function send(topicName, payload, options) {
  const transport = options?.transport || new JsonTransport();
  const client = QueueClient._getDefaultInstance();
  const result = await client.sendMessage(
    {
      queueName: topicName,
      payload,
      idempotencyKey: options?.idempotencyKey,
      retentionSeconds: options?.retentionSeconds,
      callback: options?.callback
    },
    transport
  );
  return { messageId: result.messageId };
}

// ../../packages/core/dist/index.js
var import_workflow_vm = __toESM(require_dist(), 1);

// ../../packages/core/dist/base-url.js
function getBaseUrl(baseUrl, env = process.env) {
  if (baseUrl) {
    const protocol2 = baseUrl.includes("localhost") ? "http" : "https";
    if (!baseUrl.startsWith(`${protocol2}://`)) {
      baseUrl = `${protocol2}://${baseUrl}`;
    }
    return new URL(baseUrl);
  }
  const vercelUrlVal = env.VERCEL_URL;
  if (!vercelUrlVal) {
    throw new Error("The `baseUrl` option must be provided when not running on Vercel");
  }
  const protocol = vercelUrlVal.includes("localhost") ? "http" : "https";
  const vercelUrl = new URL(`${protocol}://${vercelUrlVal}`);
  const vercelAutomationBypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (vercelAutomationBypassSecret) {
    vercelUrl.searchParams.set("x-vercel-protection-bypass", vercelAutomationBypassSecret);
  }
  return vercelUrl;
}

// ../../packages/core/dist/global.js
var STATE = Symbol.for("STATE");
var STEP_INDEX = Symbol.for("STEP_INDEX");

// ../../packages/core/dist/sleep.js
var sleep = (
  // @ts-expect-error - Meant to be used within a workflow file - will evaluate to undefined outside of the workflow VM context
  globalThis[Symbol.for("WORKFLOW_USE_STEP")]?.("__builtin_sleep")
);

// ../../packages/core/dist/index.js
async function start(workflowId, options = {}) {
  const baseUrl = getBaseUrl(options.baseUrl);
  const callbackUrl = new URL(`/api/generated/workflows${baseUrl.search}`, baseUrl);
  const runId = crypto.randomUUID();
  const payload = {
    workflowId,
    runId,
    callbackUrl: callbackUrl.href,
    state: [{ t: Date.now(), arguments: options.arguments ?? [] }]
  };
  const queueResult = await send(`workflow-${workflowId}`, payload, {
    callback: {
      url: callbackUrl.href
    }
  });
  return { runId, ...queueResult };
}

// api/trigger.ts
var POST = async (req) => {
  const url = new URL(req.url);
  const valueParam = url.searchParams.get("v");
  const value = typeof valueParam === "string" ? parseInt(valueParam, 10) : 42;
  const workflowId = "example";
  const { runId } = await start(workflowId, {
    arguments: [value]
  });
  return new Response(
    `Starting "${workflowId}" workflow with run ID "${runId}"`
  );
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  POST
});
