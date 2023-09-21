import { __extends } from 'tslib';

import Displayable, { DEFAULT_COMMON_STYLE, DEFAULT_COMMON_ANIMATION_PROPS } from './Displayable.js';
import { defaults, clone } from '../core/util.js';
import { TRANSFORMABLE_PROPS } from '../core/Transformable.js';
import { REDRAW_BIT, SHAPE_CHANGED_BIT, STYLE_CHANGED_BIT } from './constants.js';

export const DEFAULT_PATH_STYLE = defaults({
  fill: '#000',
  stroke: null,
  strokePercent: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  lineDashOffset: 0,
  lineWidth: 1,
  lineCap: 'butt',
  miterLimit: 10,
  strokeNoScale: false,
  strokeFirst: false
}, DEFAULT_COMMON_STYLE);

export const DEFAULT_PATH_ANIMATION_PROPS = {
  style: defaults({
    fill: true,
    stroke: true,
    strokePercent: true,
    fillOpacity: true,
    strokeOpacity: true,
    lineDashOffset: true,
    lineWidth: true,
    miterLimit: true
  }, DEFAULT_COMMON_ANIMATION_PROPS.style)
};
const pathCopyParams = TRANSFORMABLE_PROPS.concat(['invisible',
  'culling', 'z', 'z2', 'zlevel', 'parent'
]);
const ZRPath = (function (_super) {
  __extends(ZRPath, _super);
  function ZRPath(opts) {
    return _super.call(this, opts) || this;
  }
  ZRPath.initDefaultProps = (function () {
    var pathProto = ZRPath.prototype;
    pathProto.type = 'path';
    pathProto.strokeContainThreshold = 5;
    pathProto.segmentIgnoreThreshold = 0;
    pathProto.subPixelOptimize = false;
    pathProto.autoBatch = false;
    pathProto.__dirty = REDRAW_BIT | STYLE_CHANGED_BIT | SHAPE_CHANGED_BIT;
  }());
  ZRPath.extend = function (defaultProps) {
    var Sub = (function (_super) {
      __extends(Sub, _super);
      function Sub(opts) {
        var _this = _super.call(this, opts) || this;
        defaultProps.init && defaultProps.init.call(_this, opts);
        return _this;
      }
      Sub.prototype.getDefaultStyle = function () {
        return clone(defaultProps.style);
      };
      Sub.prototype.getDefaultShape = function () {
        return clone(defaultProps.shape);
      };
      return Sub;
    }(ZRPath));
    for (var key in defaultProps) {
      if (typeof defaultProps[key] === 'function') {
        Sub.prototype[key] = defaultProps[key];
      }
    }
    return Sub;
  };

  return ZRPath;
}(Displayable));
export default ZRPath;
