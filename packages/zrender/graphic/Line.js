import { __extends } from 'tslib';
import Element from '../Element';

const ZRLine = (function (_super) {
  __extends(ZRLine, _super);
  function ZRLine(opts) {
    const _this = _super.call(this, opts) || this;
    _this.type = 'Line';
    return _this;
  }
  ZRLine.prototype.getDefaultStyle = function () {
    return {
      stroke: '#000',
      fill: null
    };
  };

  /**
   * @param positions {Array}
   */
  ZRLine.prototype.draw = function (positions) {
    if (!this.ignore) {
      positions.push(...this.toCenterCoord2(this.shape));
    }
  };

  return ZRLine;
}(Element));

export default ZRLine;
