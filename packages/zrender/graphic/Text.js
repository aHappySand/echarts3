import { __extends } from 'tslib';
import * as THREE from 'three';

import { each, normalizeCssArray, trim, extend, keys, defaults } from '../core/util.js';
import { DEFAULT_COMMON_ANIMATION_PROPS } from './Displayable.js';
import { DEFAULT_FONT_SIZE } from '../core/platform.js';
import Element from '../Element';
import BoundingRect from '../core/BoundingRect';
import { adjustTextX, adjustTextY } from '../contain/text.js';


const DEFAULT_RICH_TEXT_COLOR = {
  fill: '#000'
};
const FONT_SIZE_REG = /\s*(\d+)(px|rem|em)/i;

export const DEFAULT_TEXT_ANIMATION_PROPS = {
  style: defaults({
    fill: true,
    stroke: true,
    fillOpacity: true,
    strokeOpacity: true,
    lineWidth: true,
    fontSize: true,
    lineHeight: true,
    width: true,
    height: true,
    textShadowColor: true,
    textShadowBlur: true,
    textShadowOffsetX: true,
    textShadowOffsetY: true,
    backgroundColor: true,
    padding: true,
    borderColor: true,
    borderWidth: true,
    borderRadius: true
  }, DEFAULT_COMMON_ANIMATION_PROPS.style)
};

export function parseFontSize(fontSize) {
  if (typeof fontSize === 'string' &&
    (fontSize.indexOf('px') !== -1 ||
      fontSize.indexOf('rem') !== -1 ||
      fontSize.indexOf('em') !== -1)) {
    return fontSize;
  }
  if (!isNaN(+fontSize)) {
    return `${fontSize}px`;
  }

  return `${DEFAULT_FONT_SIZE}px`;
}

export function scaleFontSize(fontSize, scale) {
  const fs = parseFontSize(fontSize);
  let fontSizeNum;
  const newFs = fs.replace(/[\d]+/, (val) => {
    fontSizeNum = val;
    return val * scale;
  });

  return { fontSize: newFs, fontSizeNum };
}

const ZRText = (function (_super) {
  __extends(ZRText, _super);
  function ZRText(opts) {
    var _this = _super.call(this, opts) || this;
    _this.type = 'Text';
    _this._defaultStyle = DEFAULT_RICH_TEXT_COLOR;
    return _this;
  }

  ZRText.prototype.updateTransform = function () {
    var innerTransformable = this.innerTransformable;
    if (innerTransformable) {
      innerTransformable.updateTransform();
      if (innerTransformable.transform) {
        this.transform = innerTransformable.transform;
      }
    } else {
      _super.prototype.updateTransform.call(this);
    }
  };
  ZRText.prototype.getLocalTransform = function (m) {
    var innerTransformable = this.innerTransformable;
    return innerTransformable
      ? innerTransformable.getLocalTransform(m)
      : _super.prototype.getLocalTransform.call(this, m);
  };
  ZRText.prototype.setDefaultTextStyle = function (defaultTextStyle) {
    this._defaultStyle = defaultTextStyle || DEFAULT_RICH_TEXT_COLOR;
  };

  ZRText.prototype._mergeStyle = function (targetStyle, sourceStyle) {
    if (!sourceStyle) {
      return targetStyle;
    }
    var sourceRich = sourceStyle.rich;
    var targetRich = targetStyle.rich || (sourceRich && {});
    extend(targetStyle, sourceStyle);
    if (sourceRich && targetRich) {
      this._mergeRich(targetRich, sourceRich);
      targetStyle.rich = targetRich;
    } else if (targetRich) {
      targetStyle.rich = targetRich;
    }
    return targetStyle;
  };
  ZRText.prototype._mergeRich = function (targetRich, sourceRich) {
    var richNames = keys(sourceRich);
    for (var i = 0; i < richNames.length; i++) {
      var richName = richNames[i];
      targetRich[richName] = targetRich[richName] || {};
      extend(targetRich[richName], sourceRich[richName]);
    }
  };
  ZRText.prototype.getAnimationStyleProps = function () {
    return DEFAULT_TEXT_ANIMATION_PROPS;
  };
  ZRText.makeFont = function (style) {
    var font = '';
    if (hasSeparateFont(style)) {
      font = [
        style.fontStyle,
        style.fontWeight,
        parseFontSize(style.fontSize),
        style.fontFamily || 'sans-serif'
      ].join(' ');
    }
    return font && trim(font) || style.textFont || style.font;
  };

  ZRText.makeScaleFont = function (style, scale) {
    let font = '';
    let fontSizeNum;
    if (hasSeparateFont(style)) {
      const fs = scaleFontSize(style.fontSize);
      font = [
        style.fontStyle,
        style.fontWeight,
        fs.fontSize,
        style.fontFamily || 'sans-serif'
      ].join(' ');

      font = trim(font);
      fontSizeNum = fs.fontSizeNum;
    } else {
      font = style.textFont || style.font;
      if (font) {
        const match = font.match(FONT_SIZE_REG);
        if (match) {
          font = font.replace(FONT_SIZE_REG, (...args) => {
            fontSizeNum = args[1];
            return args[0].replace(args[1], args[1] * scale);
          });
        } else {
          fontSizeNum = DEFAULT_FONT_SIZE;
          font = `${DEFAULT_FONT_SIZE * scale}px ${font}`;
        }
      } else {
        fontSizeNum = DEFAULT_FONT_SIZE;
        font = `${DEFAULT_FONT_SIZE * scale}px sans-serif`;
      }
    }

    return { font, fontSizeNum };
  };

  ZRText.prototype.getBoundingRect = function () {
    if (!this._rect) {
      var tmpRect = new BoundingRect(0, 0, 0, 0);
      var children = this.children || [];
      var tmpMat = [];
      var rect = null;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var childRect = child.getBoundingRect();
        var transform = child.getLocalTransform(tmpMat);
        if (transform) {
          tmpRect.copy(childRect);
          tmpRect.applyTransform(transform);
          rect = rect || tmpRect.clone();
          rect.union(tmpRect);
        } else {
          rect = rect || childRect.clone();
          rect.union(childRect);
        }
      }
      this._rect = rect || tmpRect;
    }
    return this._rect;
  };

  ZRText.prototype.draw = function () {
    if (this.ignore) return null;

    const { rotation, style } = this;
    const scale = 1;
    const { font, fontSizeNum } = ZRText.makeScaleFont(style, scale);

    var text = getStyleText(style);

    var textFill = getFill('fill' in style
      ? style.fill
      : this._defaultStyle);

    const offscreen = new OffscreenCanvas(254, fontSizeNum * scale);
    const ctx = offscreen.getContext('2d');

    ctx.fillStyle = textFill;
    ctx.font = font;
    const textRect = ctx.measureText(text);
    offscreen.width = textRect.width;

    ctx.fillStyle = textFill;
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.fillText(text, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    const lineHeight = offscreen.height;
    const textPadding = style.padding;
    const baseX = this.x || 0;
    const baseY = this.y || 0;
    const defaultStyle = this._defaultStyle;
    const textAlign = style.align || defaultStyle.align || 'left';
    const verticalAlign = style.verticalAlign || defaultStyle.verticalAlign || 'top';

    let textX = baseX;
    let textY = baseY;// adjustTextY(baseY, lineHeight, verticalAlign);
    // textY += lineHeight / 2;
    // if (textPadding) {
    //   textX = getTextXForPadding(baseX, textAlign, textPadding);
    //   if (verticalAlign === 'top') {
    //     textY += textPadding[0];
    //   } else if (verticalAlign === 'bottom') {
    //     textY -= textPadding[2];
    //   }
    // }

    if (this.axisModel) {
      const position = this.axisModel.axis.position;
      switch (position) {
        case 'left': {
          textX -= offscreen.width / 2;
          break;
        }

        case 'bottom': {
          textY += lineHeight / 2;
        }
      }
    }

    // plane
    const texture = new THREE.CanvasTexture(offscreen);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: new THREE.Color(textFill) });
    const geometry = new THREE.PlaneGeometry(offscreen.width / scale, fontSizeNum);
    const plane = new THREE.Mesh(geometry, material);
    if (rotation) {
      plane.rotation.set(0, 0, rotation);
    }

    const newPos = this.toCenterCoord({ x: textX, y: textY });
    plane.position.set(newPos[0], newPos[1], newPos[2]);
    return plane;
  };
  return ZRText;
}(Element));

var VALID_TEXT_ALIGN = { left: true, right: 1, center: 1 };
var VALID_TEXT_VERTICAL_ALIGN = { top: 1, bottom: 1, middle: 1 };
export const FONT_PARTS = ['fontStyle', 'fontWeight', 'fontSize', 'fontFamily'];

export function hasSeparateFont(style) {
  return style.fontSize != null || style.fontFamily || style.fontWeight;
}
export function normalizeTextStyle(style) {
  normalizeStyle(style);
  each(style.rich, normalizeStyle);
  return style;
}
function normalizeStyle(style) {
  if (style) {
    style.font = ZRText.makeFont(style);
    var textAlign = style.align;
    textAlign === 'middle' && (textAlign = 'center');
    style.align = (textAlign == null || VALID_TEXT_ALIGN[textAlign]) ? textAlign : 'left';
    var verticalAlign = style.verticalAlign;
    verticalAlign === 'center' && (verticalAlign = 'middle');
    style.verticalAlign = (verticalAlign == null || VALID_TEXT_VERTICAL_ALIGN[verticalAlign]) ? verticalAlign : 'top';
    var textPadding = style.padding;
    if (textPadding) {
      style.padding = normalizeCssArray(style.padding);
    }
  }
}
export function getStroke(stroke, lineWidth) {
  return (stroke == null || lineWidth <= 0 || stroke === 'transparent' || stroke === 'none')
    ? null
    : (stroke.image || stroke.colorStops)
      ? '#000'
      : stroke;
}
export function getFill(fill) {
  return (fill == null || fill === 'none')
    ? null
    : (fill.image || fill.colorStops)
      ? '#000'
      : fill;
}
export function getTextXForPadding(x, textAlign, textPadding) {
  return textAlign === 'right'
    ? (x - textPadding[1])
    : textAlign === 'center'
      ? (x + textPadding[3] / 2 - textPadding[1] / 2)
      : (x + textPadding[3]);
}
export function getStyleText(style) {
  var text = style.text;
  text != null && (text += '');
  return text;
}
export function needDrawBackground(style) {
  return !!(style.backgroundColor ||
    style.lineHeight ||
    (style.borderWidth && style.borderColor));
}
export default ZRText;
