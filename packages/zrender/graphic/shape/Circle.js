import { __extends } from 'tslib';
import Path from '../Path.js';

const CircleShape = (function () {
  function CircleShape() {
    this.cx = 0;
    this.cy = 0;
    this.r = 0;
  }
  return CircleShape;
}());
export { CircleShape };
const ZRCircle = (function (_super) {
  __extends(ZRCircle, _super);
  function ZRCircle(opts) {
    return _super.call(this, opts) || this;
  }
  ZRCircle.prototype.getDefaultShape = function () {
    return new CircleShape();
  };
  ZRCircle.prototype.draw = function (ctx, shape) {
    ctx.moveTo(shape.cx + shape.r, shape.cy);
    ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
  };
  return ZRCircle;
}(Path));

ZRCircle.prototype.type = 'circle';
export default ZRCircle;
