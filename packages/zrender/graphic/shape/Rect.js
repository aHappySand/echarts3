import { __extends } from 'tslib';
import Path from '../Path.js';
import * as roundRectHelper from '../helper/roundRect.js';
import { subPixelOptimizeRect } from '../helper/subPixelOptimize.js';

const RectShape = (function () {
  function RectShape() {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }
  return RectShape;
}());
export { RectShape };
const subPixelOptimizeOutputShape = {};
const ZRRect = (function (_super) {
  __extends(ZRRect, _super);
  function ZRRect(opts) {
    return _super.call(this, opts) || this;
  }
  ZRRect.prototype.getDefaultShape = function () {
    return new RectShape();
  };
  ZRRect.prototype.draw = function (shape) {
    var x;
    var y;
    var width;
    var height;
    if (this.subPixelOptimize) {
      var optimizedShape = subPixelOptimizeRect(subPixelOptimizeOutputShape, shape, this.style);
      x = optimizedShape.x;
      y = optimizedShape.y;
      width = optimizedShape.width;
      height = optimizedShape.height;
      optimizedShape.r = shape.r;
      shape = optimizedShape;
    } else {
      x = shape.x;
      y = shape.y;
      width = shape.width;
      height = shape.height;
    }
    if (!shape.r) {
      // ctx.rect(x, y, width, height);
      return { x, y, width, height };
    }
    return roundRectHelper.buildPath(shape);
  };
  ZRRect.prototype.isZeroArea = function () {
    return !this.shape.width || !this.shape.height;
  };
  return ZRRect;
}(Path));
ZRRect.prototype.type = 'rect';
export default ZRRect;
