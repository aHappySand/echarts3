import { platformApi } from './platform.js';

const BUILTIN_OBJECT = reduce([
  'Function',
  'RegExp',
  'Date',
  'Error',
  'CanvasGradient',
  'CanvasPattern',
  'Image',
  'Canvas'
], (obj, val) => {
  obj[`[object ${val}]`] = true;
  return obj;
}, {});
const TYPED_ARRAY = reduce([
  'Int8',
  'Uint8',
  'Uint8Clamped',
  'Int16',
  'Uint16',
  'Int32',
  'Uint32',
  'Float32',
  'Float64'
], (obj, val) => {
  obj[`[object ${val}Array]`] = true;
  return obj;
}, {});
const objToString = Object.prototype.toString;
const arrayProto = Array.prototype;
const nativeForEach = arrayProto.forEach;
const nativeFilter = arrayProto.filter;
const nativeSlice = arrayProto.slice;
const nativeMap = arrayProto.map;
const ctorFunction = function () {
}.constructor;
const protoFunction = ctorFunction ? ctorFunction.prototype : null;
const protoKey = '__proto__';
let idStart = 0x0907;

export function guid() {
  return idStart++;
}

export function logError() {
  var args = [];
  for (let _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  if (typeof console !== 'undefined') {
    console.error.apply(console, args);
  }
}

export function clone(source) {
  if (source == null || typeof source !== 'object') {
    return source;
  }
  var result = source;
  var typeStr = objToString.call(source);
  if (typeStr === '[object Array]') {
    if (!isPrimitive(source)) {
      result = [];
      for (let i = 0, len = source.length; i < len; i++) {
        result[i] = clone(source[i]);
      }
    }
  } else if (TYPED_ARRAY[typeStr]) {
    if (!isPrimitive(source)) {
      var Ctor = source.constructor;
      if (Ctor.from) {
        result = Ctor.from(source);
      } else {
        result = new Ctor(source.length);
        for (let i = 0, len = source.length; i < len; i++) {
          result[i] = source[i];
        }
      }
    }
  } else if (!BUILTIN_OBJECT[typeStr] && !isPrimitive(source) && !isDom(source)) {
    result = {};
    for (let key in source) {
      if (source.hasOwnProperty(key) && key !== protoKey) {
        result[key] = clone(source[key]);
      }
    }
  }
  return result;
}

export function merge(target, source, overwrite) {
  if (!isObject(source) || !isObject(target)) {
    return overwrite ? clone(source) : target;
  }
  for (let key in source) {
    if (source.hasOwnProperty(key) && key !== protoKey) {
      var targetProp = target[key];
      var sourceProp = source[key];
      if (isObject(sourceProp) &&
        isObject(targetProp) &&
        !isArray(sourceProp) &&
        !isArray(targetProp) &&
        !isDom(sourceProp) &&
        !isDom(targetProp) &&
        !isBuiltInObject(sourceProp) &&
        !isBuiltInObject(targetProp) &&
        !isPrimitive(sourceProp) &&
        !isPrimitive(targetProp)) {
        merge(targetProp, sourceProp, overwrite);
      } else if (overwrite || !(key in target)) {
        target[key] = clone(source[key]);
      }
    }
  }
  return target;
}

export function mergeAll(targetAndSources, overwrite) {
  var result = targetAndSources[0];
  for (let i = 1, len = targetAndSources.length; i < len; i++) {
    result = merge(result, targetAndSources[i], overwrite);
  }
  return result;
}

export function extend(target, source) {
  if (Object.assign) {
    Object.assign(target, source);
  } else {
    for (let key in source) {
      if (source.hasOwnProperty(key) && key !== protoKey) {
        target[key] = source[key];
      }
    }
  }
  return target;
}

export function defaults(target, source, overlay) {
  var keysArr = keys(source);
  for (let i = 0; i < keysArr.length; i++) {
    var key = keysArr[i];
    if ((overlay ? source[key] != null : target[key] == null)) {
      target[key] = source[key];
    }
  }
  return target;
}

export const createCanvas = platformApi.createCanvas;

export function indexOf(array, value) {
  if (array) {
    if (array.indexOf) {
      return array.indexOf(value);
    }
    for (let i = 0, len = array.length; i < len; i++) {
      if (array[i] === value) {
        return i;
      }
    }
  }
  return -1;
}

export function inherits(clazz, baseClazz) {
  var clazzPrototype = clazz.prototype;

  function F() {
  }

  F.prototype = baseClazz.prototype;
  clazz.prototype = new F();
  for (let prop in clazzPrototype) {
    if (clazzPrototype.hasOwnProperty(prop)) {
      clazz.prototype[prop] = clazzPrototype[prop];
    }
  }
  clazz.prototype.constructor = clazz;
  clazz.superClass = baseClazz;
}

export function mixin(target, source, override) {
  target = 'prototype' in target ? target.prototype : target;
  source = 'prototype' in source ? source.prototype : source;
  if (Object.getOwnPropertyNames) {
    var keyList = Object.getOwnPropertyNames(source);
    for (let i = 0; i < keyList.length; i++) {
      var key = keyList[i];
      if (key !== 'constructor') {
        if ((override ? source[key] != null : target[key] == null)) {
          target[key] = source[key];
        }
      }
    }
  } else {
    defaults(target, source, override);
  }
}

export function isArrayLike(data) {
  if (!data) {
    return false;
  }
  if (typeof data === 'string') {
    return false;
  }
  return typeof data.length === 'number';
}

export function each(arr, cb, context) {
  if (!(arr && cb)) {
    return;
  }
  if (arr.forEach && arr.forEach === nativeForEach) {
    arr.forEach(cb, context);
  } else if (arr.length === +arr.length) {
    for (let i = 0, len = arr.length; i < len; i++) {
      cb.call(context, arr[i], i, arr);
    }
  } else {
    for (let key in arr) {
      if (arr.hasOwnProperty(key)) {
        cb.call(context, arr[key], key, arr);
      }
    }
  }
}

export function map(arr, cb, context) {
  if (!arr) {
    return [];
  }
  if (!cb) {
    return slice(arr);
  }
  if (arr.map && arr.map === nativeMap) {
    return arr.map(cb, context);
  }
  var result = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    result.push(cb.call(context, arr[i], i, arr));
  }
  return result;
}

export function reduce(arr, cb, memo, context) {
  if (!(arr && cb)) {
    return;
  }
  for (let i = 0, len = arr.length; i < len; i++) {
    memo = cb.call(context, memo, arr[i], i, arr);
  }
  return memo;
}

export function filter(arr, cb, context) {
  if (!arr) {
    return [];
  }
  if (!cb) {
    return slice(arr);
  }
  if (arr.filter && arr.filter === nativeFilter) {
    return arr.filter(cb, context);
  }
  var result = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb.call(context, arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
}

export function find(arr, cb, context) {
  if (!(arr && cb)) {
    return;
  }
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb.call(context, arr[i], i, arr)) {
      return arr[i];
    }
  }
}

export function keys(obj) {
  if (!obj) {
    return [];
  }
  if (Object.keys) {
    return Object.keys(obj);
  }
  var keyList = [];
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      keyList.push(key);
    }
  }
  return keyList;
}

function bindPolyfill(func, context) {
  var args = [];
  for (let _i = 2; _i < arguments.length; _i++) {
    args[_i - 2] = arguments[_i];
  }
  return function () {
    return func.apply(context, args.concat(nativeSlice.call(arguments)));
  };
}

export const bind = (protoFunction && isFunction(protoFunction.bind))
  ? protoFunction.call.bind(protoFunction.bind)
  : bindPolyfill;

function curry(func) {
  var args = [];
  for (let _i = 1; _i < arguments.length; _i++) {
    args[_i - 1] = arguments[_i];
  }
  return function () {
    return func.apply(this, args.concat(nativeSlice.call(arguments)));
  };
}

export { curry };

export function isArray(value) {
  if (Array.isArray) {
    return Array.isArray(value);
  }
  return objToString.call(value) === '[object Array]';
}

export function isFunction(value) {
  return typeof value === 'function';
}

export function isString(value) {
  return typeof value === 'string';
}

export function isStringSafe(value) {
  return objToString.call(value) === '[object String]';
}

export function isNumber(value) {
  return typeof value === 'number';
}

export function isObject(value) {
  var type = typeof value;
  return type === 'function' || (!!value && type === 'object');
}

export function isBuiltInObject(value) {
  return !!BUILTIN_OBJECT[objToString.call(value)];
}

export function isTypedArray(value) {
  return !!TYPED_ARRAY[objToString.call(value)];
}

export function isDom(value) {
  return typeof value === 'object' &&
    typeof value.nodeType === 'number' &&
    typeof value.ownerDocument === 'object';
}

export function isGradientObject(value) {
  return value.colorStops != null;
}

export function isImagePatternObject(value) {
  return value.image != null;
}

export function isRegExp(value) {
  return objToString.call(value) === '[object RegExp]';
}

export function eqNaN(value) {
  return value !== value;
}

export function retrieve() {
  var args = [];
  for (let _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  for (let i = 0, len = args.length; i < len; i++) {
    if (args[i] != null) {
      return args[i];
    }
  }
}

export function retrieve2(value0, value1) {
  return value0 != null
    ? value0
    : value1;
}

export function retrieve3(value0, value1, value2) {
  return value0 != null
    ? value0
    : value1 != null
      ? value1
      : value2;
}

export function slice(arr) {
  var args = [];
  for (let _i = 1; _i < arguments.length; _i++) {
    args[_i - 1] = arguments[_i];
  }
  return nativeSlice.apply(arr, args);
}

export function normalizeCssArray(val) {
  if (typeof (val) === 'number') {
    return [val, val, val, val];
  }
  var len = val.length;
  if (len === 2) {
    return [val[0], val[1], val[0], val[1]];
  } if (len === 3) {
    return [val[0], val[1], val[2], val[1]];
  }
  return val;
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function trim(str) {
  if (str == null) {
    return null;
  } if (typeof str.trim === 'function') {
    return str.trim();
  }
  return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

const primitiveKey = '__ec_primitive__';

export function setAsPrimitive(obj) {
  obj[primitiveKey] = true;
}

export function isPrimitive(obj) {
  return obj[primitiveKey];
}

const MapPolyfill = (function () {
  function MapPolyfill() {
    this.data = {};
  }

  MapPolyfill.prototype['delete'] = function (key) {
    var existed = this.has(key);
    if (existed) {
      delete this.data[key];
    }
    return existed;
  };
  MapPolyfill.prototype.has = function (key) {
    return this.data.hasOwnProperty(key);
  };
  MapPolyfill.prototype.get = function (key) {
    return this.data[key];
  };
  MapPolyfill.prototype.set = function (key, value) {
    this.data[key] = value;
    return this;
  };
  MapPolyfill.prototype.keys = function () {
    return keys(this.data);
  };
  MapPolyfill.prototype.forEach = function (callback) {
    var data = this.data;
    for (let key in data) {
      if (data.hasOwnProperty(key)) {
        callback(data[key], key);
      }
    }
  };
  return MapPolyfill;
}());
const isNativeMapSupported = typeof Map === 'function';

function maybeNativeMap() {
  return (isNativeMapSupported ? new Map() : new MapPolyfill());
}

const HashMap = (function () {
  function HashMap(obj) {
    var isArr = isArray(obj);
    this.data = maybeNativeMap();
    var thisMap = this;
    (obj instanceof HashMap)
      ? obj.each(visit)
      : (obj && each(obj, visit));

    function visit(value, key) {
      isArr ? thisMap.set(value, key) : thisMap.set(key, value);
    }
  }

  HashMap.prototype.hasKey = function (key) {
    return this.data.has(key);
  };
  HashMap.prototype.get = function (key) {
    return this.data.get(key);
  };
  HashMap.prototype.set = function (key, value) {
    this.data.set(key, value);
    return value;
  };
  HashMap.prototype.each = function (cb, context) {
    this.data.forEach((value, key) => {
      cb.call(context, value, key);
    });
  };
  HashMap.prototype.keys = function () {
    var keys = this.data.keys();
    return isNativeMapSupported
      ? Array.from(keys)
      : keys;
  };
  HashMap.prototype.removeKey = function (key) {
    this.data['delete'](key);
  };
  return HashMap;
}());
export { HashMap };

export function createHashMap(obj) {
  return new HashMap(obj);
}

export function concatArray(a, b) {
  var newArray = new a.constructor(a.length + b.length);
  for (let i = 0; i < a.length; i++) {
    newArray[i] = a[i];
  }
  var offset = a.length;
  for (let i = 0; i < b.length; i++) {
    newArray[i + offset] = b[i];
  }
  return newArray;
}

export function createObject(proto, properties) {
  var obj;
  if (Object.create) {
    obj = Object.create(proto);
  } else {
    var StyleCtor = function () {
    };
    StyleCtor.prototype = proto;
    obj = new StyleCtor();
  }
  if (properties) {
    extend(obj, properties);
  }
  return obj;
}

export function disableUserSelect(dom) {
  var domStyle = dom.style;
  domStyle.webkitUserSelect = 'none';
  domStyle.userSelect = 'none';
  domStyle.webkitTapHighlightColor = 'rgba(0,0,0,0)';
  domStyle['-webkit-touch-callout'] = 'none';
}

export function hasOwn(own, prop) {
  return own.hasOwnProperty(prop);
}

export function noop() {
}

export const RADIAN_TO_DEGREE = 180 / Math.PI;
