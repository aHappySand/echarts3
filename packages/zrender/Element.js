import Transformable, { TRANSFORMABLE_PROPS } from './core/Transformable.js';
import BoundingRect from './core/BoundingRect.js';
import Eventful from './core/Eventful.js';
import { calculateTextPosition, parsePercent } from './contain/text.js';
import {
  guid,
  isObject,
  keys,
  extend,
  indexOf,
  logError,
  mixin,
  isArrayLike,
  isTypedArray,
  reduce
} from './core/util.js';
import { LIGHT_LABEL_COLOR, DARK_LABEL_COLOR } from './config.js';
import { parse, stringify } from './tool/color.js';
import { REDRAW_BIT } from './graphic/constants.js';

export const PRESERVED_NORMAL_STATE = '__zr_normal__';
const PRIMARY_STATES_KEYS = TRANSFORMABLE_PROPS.concat(['ignore']);
const DEFAULT_ANIMATABLE_MAP = reduce(TRANSFORMABLE_PROPS, (obj, key) => {
  obj[key] = true;
  return obj;
}, { ignore: false });
const tmpTextPosCalcRes = {};
const tmpBoundingRect = new BoundingRect(0, 0, 0, 0);
const Element = (function () {
  function Element(props) {
    this.id = guid();
    this.animators = [];
    this.currentStates = [];
    this.states = {};
    this._init(props);
  }

  Element.prototype._init = function (props) {
    this.attr(props);
  };
  Element.prototype.drift = function (dx, dy, e) {
    switch (this.draggable) {
      case 'horizontal':
        dy = 0;
        break;
      case 'vertical':
        dx = 0;
        break;
    }
    let m = this.transform;
    if (!m) {
      m = this.transform = [1, 0, 0, 1, 0, 0];
    }
    m[4] += dx;
    m[5] += dy;
    this.decomposeTransform();
    this.markRedraw();
  };
  Element.prototype.beforeUpdate = function () {
  };
  Element.prototype.afterUpdate = function () {
  };
  Element.prototype.update = function () {
    this.updateTransform();
    if (this.__dirty) {
      this.updateInnerText();
    }
  };
  Element.prototype.updateInnerText = function (forceUpdate) {
    const textEl = this._textContent;
    if (textEl && (!textEl.ignore || forceUpdate)) {
      if (!this.textConfig) {
        this.textConfig = {};
      }
      const textConfig = this.textConfig;
      const isLocal = textConfig.local;
      const innerTransformable = textEl.innerTransformable;
      let textAlign = void 0;
      let textVerticalAlign = void 0;
      let textStyleChanged = false;
      innerTransformable.parent = isLocal ? this : null;
      let innerOrigin = false;
      innerTransformable.copyTransform(textEl);
      if (textConfig.position != null) {
        const layoutRect = tmpBoundingRect;
        if (textConfig.layoutRect) {
          layoutRect.copy(textConfig.layoutRect);
        } else {
          layoutRect.copy(this.getBoundingRect());
        }
        if (!isLocal) {
          layoutRect.applyTransform(this.transform);
        }
        if (this.calculateTextPosition) {
          this.calculateTextPosition(tmpTextPosCalcRes, textConfig, layoutRect);
        } else {
          calculateTextPosition(tmpTextPosCalcRes, textConfig, layoutRect);
        }
        innerTransformable.x = tmpTextPosCalcRes.x;
        innerTransformable.y = tmpTextPosCalcRes.y;
        textAlign = tmpTextPosCalcRes.align;
        textVerticalAlign = tmpTextPosCalcRes.verticalAlign;
        const textOrigin = textConfig.origin;
        if (textOrigin && textConfig.rotation != null) {
          let relOriginX = void 0;
          let relOriginY = void 0;
          if (textOrigin === 'center') {
            relOriginX = layoutRect.width * 0.5;
            relOriginY = layoutRect.height * 0.5;
          } else {
            relOriginX = parsePercent(textOrigin[0], layoutRect.width);
            relOriginY = parsePercent(textOrigin[1], layoutRect.height);
          }
          innerOrigin = true;
          innerTransformable.originX = -innerTransformable.x + relOriginX + (isLocal ? 0 : layoutRect.x);
          innerTransformable.originY = -innerTransformable.y + relOriginY + (isLocal ? 0 : layoutRect.y);
        }
      }
      if (textConfig.rotation != null) {
        innerTransformable.rotation = textConfig.rotation;
      }
      const textOffset = textConfig.offset;
      if (textOffset) {
        innerTransformable.x += textOffset[0];
        innerTransformable.y += textOffset[1];
        if (!innerOrigin) {
          innerTransformable.originX = -textOffset[0];
          innerTransformable.originY = -textOffset[1];
        }
      }
      const isInside = textConfig.inside == null
        ? (typeof textConfig.position === 'string' && textConfig.position.indexOf('inside') >= 0)
        : textConfig.inside;
      const innerTextDefaultStyle = this._innerTextDefaultStyle || (this._innerTextDefaultStyle = {});
      let textFill = void 0;
      let textStroke = void 0;
      let autoStroke = void 0;
      if (isInside && this.canBeInsideText()) {
        textFill = textConfig.insideFill;
        textStroke = textConfig.insideStroke;
        if (textFill == null || textFill === 'auto') {
          textFill = this.getInsideTextFill();
        }
        if (textStroke == null || textStroke === 'auto') {
          textStroke = this.getInsideTextStroke(textFill);
          autoStroke = true;
        }
      } else {
        textFill = textConfig.outsideFill;
        textStroke = textConfig.outsideStroke;
        if (textFill == null || textFill === 'auto') {
          textFill = this.getOutsideFill();
        }
        if (textStroke == null || textStroke === 'auto') {
          textStroke = this.getOutsideStroke(textFill);
          autoStroke = true;
        }
      }
      textFill = textFill || '#000';
      if (textFill !== innerTextDefaultStyle.fill ||
        textStroke !== innerTextDefaultStyle.stroke ||
        autoStroke !== innerTextDefaultStyle.autoStroke ||
        textAlign !== innerTextDefaultStyle.align ||
        textVerticalAlign !== innerTextDefaultStyle.verticalAlign) {
        textStyleChanged = true;
        innerTextDefaultStyle.fill = textFill;
        innerTextDefaultStyle.stroke = textStroke;
        innerTextDefaultStyle.autoStroke = autoStroke;
        innerTextDefaultStyle.align = textAlign;
        innerTextDefaultStyle.verticalAlign = textVerticalAlign;
        textEl.setDefaultTextStyle(innerTextDefaultStyle);
      }
      textEl.__dirty |= REDRAW_BIT;
      if (textStyleChanged) {
        textEl.dirtyStyle(true);
      }
    }
  };
  Element.prototype.canBeInsideText = function () {
    return true;
  };
  Element.prototype.getInsideTextFill = function () {
    return '#fff';
  };
  Element.prototype.getInsideTextStroke = function (textFill) {
    return '#000';
  };
  Element.prototype.getOutsideFill = function () {
    return this.__zr && this.__zr.isDarkMode() ? LIGHT_LABEL_COLOR : DARK_LABEL_COLOR;
  };
  Element.prototype.getOutsideStroke = function (textFill) {
    const backgroundColor = this.__zr && this.__zr.getBackgroundColor();
    let colorArr = typeof backgroundColor === 'string' && parse(backgroundColor);
    if (!colorArr) {
      colorArr = [255, 255, 255, 1];
    }
    const alpha = colorArr[3];
    const isDark = this.__zr.isDarkMode();
    for (let i = 0; i < 3; i++) {
      colorArr[i] = colorArr[i] * alpha + (isDark ? 0 : 255) * (1 - alpha);
    }
    colorArr[3] = 1;
    return stringify(colorArr, 'rgba');
  };
  Element.prototype.traverse = function (cb, context) {
  };
  Element.prototype.attrKV = function (key, value) {
    if (key === 'textConfig') {
      this.setTextConfig(value);
    } else if (key === 'textContent') {
      this.setTextContent(value);
    } else if (key === 'clipPath') {
      this.setClipPath(value);
    } else if (key === 'extra') {
      this.extra = this.extra || {};
      extend(this.extra, value);
    } else {
      this[key] = value;
    }
  };
  Element.prototype.hide = function () {
    this.ignore = true;
    this.markRedraw();
  };
  Element.prototype.show = function () {
    this.ignore = false;
    this.markRedraw();
  };
  Element.prototype.attr = function (keyOrObj, value) {
    if (typeof keyOrObj === 'string') {
      this.attrKV(keyOrObj, value);
    } else if (isObject(keyOrObj)) {
      const obj = keyOrObj;
      const keysArr = keys(obj);
      for (let i = 0; i < keysArr.length; i++) {
        const key = keysArr[i];
        this.attrKV(key, keyOrObj[key]);
      }
    }
    this.markRedraw();
    return this;
  };
  Element.prototype.saveCurrentToNormalState = function (toState) {
    this._innerSaveToNormal(toState);
    const normalState = this._normalState;
    for (let i = 0; i < this.animators.length; i++) {
      const animator = this.animators[i];
      const fromStateTransition = animator.__fromStateTransition;
      if (animator.getLoop() || fromStateTransition && fromStateTransition !== PRESERVED_NORMAL_STATE) {
        continue;
      }
      const targetName = animator.targetName;
      const target = targetName
        ? normalState[targetName] : normalState;
      animator.saveTo(target);
    }
  };
  Element.prototype._innerSaveToNormal = function (toState) {
    let normalState = this._normalState;
    if (!normalState) {
      normalState = this._normalState = {};
    }
    if (toState.textConfig && !normalState.textConfig) {
      normalState.textConfig = this.textConfig;
    }
    this._savePrimaryToNormal(toState, normalState, PRIMARY_STATES_KEYS);
  };
  Element.prototype._savePrimaryToNormal = function (toState, normalState, primaryKeys) {
    for (let i = 0; i < primaryKeys.length; i++) {
      const key = primaryKeys[i];
      if (toState[key] != null && !(key in normalState)) {
        normalState[key] = this[key];
      }
    }
  };
  Element.prototype.hasState = function () {
    return this.currentStates.length > 0;
  };
  Element.prototype.getState = function (name) {
    return this.states[name];
  };
  Element.prototype.ensureState = function (name) {
    const states = this.states;
    if (!states[name]) {
      states[name] = {};
    }
    return states[name];
  };
  Element.prototype.clearStates = function (noAnimation) {
    this.useState(PRESERVED_NORMAL_STATE, false, noAnimation);
  };
  Element.prototype.useState = function (stateName, keepCurrentStates, noAnimation, forceUseHoverLayer) {
    const toNormalState = stateName === PRESERVED_NORMAL_STATE;
    const hasStates = this.hasState();
    if (!hasStates && toNormalState) {
      return;
    }
    const currentStates = this.currentStates;
    const animationCfg = this.stateTransition;
    if (indexOf(currentStates, stateName) >= 0 && (keepCurrentStates || currentStates.length === 1)) {
      return;
    }
    let state;
    if (this.stateProxy && !toNormalState) {
      state = this.stateProxy(stateName);
    }
    if (!state) {
      state = (this.states && this.states[stateName]);
    }
    if (!state && !toNormalState) {
      logError(`State ${stateName} not exists.`);
      return;
    }
    if (!toNormalState) {
      this.saveCurrentToNormalState(state);
    }
    const useHoverLayer = !!((state && state.hoverLayer) || forceUseHoverLayer);
    if (useHoverLayer) {
      this._toggleHoverLayerFlag(true);
    }
    this._applyStateObj(stateName, state, this._normalState, keepCurrentStates, !noAnimation && !this.__inHover && animationCfg && animationCfg.duration > 0, animationCfg);
    const textContent = this._textContent;
    const textGuide = this._textGuide;
    if (textContent) {
      textContent.useState(stateName, keepCurrentStates, noAnimation, useHoverLayer);
    }
    if (textGuide) {
      textGuide.useState(stateName, keepCurrentStates, noAnimation, useHoverLayer);
    }
    if (toNormalState) {
      this.currentStates = [];
      this._normalState = {};
    } else {
      if (!keepCurrentStates) {
        this.currentStates = [stateName];
      } else {
        this.currentStates.push(stateName);
      }
    }
    this._updateAnimationTargets();
    this.markRedraw();
    if (!useHoverLayer && this.__inHover) {
      this._toggleHoverLayerFlag(false);
      this.__dirty &= ~REDRAW_BIT;
    }
    return state;
  };
  Element.prototype.useStates = function (states, noAnimation, forceUseHoverLayer) {
    if (!states.length) {
      this.clearStates();
    } else {
      const stateObjects = [];
      const currentStates = this.currentStates;
      const len = states.length;
      let notChange = len === currentStates.length;
      if (notChange) {
        for (var i = 0; i < len; i++) {
          if (states[i] !== currentStates[i]) {
            notChange = false;
            break;
          }
        }
      }
      if (notChange) {
        return;
      }
      for (var i = 0; i < len; i++) {
        const stateName = states[i];
        let stateObj = void 0;
        if (this.stateProxy) {
          stateObj = this.stateProxy(stateName, states);
        }
        if (!stateObj) {
          stateObj = this.states[stateName];
        }
        if (stateObj) {
          stateObjects.push(stateObj);
        }
      }
      const lastStateObj = stateObjects[len - 1];
      const useHoverLayer = !!((lastStateObj && lastStateObj.hoverLayer) || forceUseHoverLayer);
      if (useHoverLayer) {
        this._toggleHoverLayerFlag(true);
      }
      const mergedState = this._mergeStates(stateObjects);
      const animationCfg = this.stateTransition;
      this.saveCurrentToNormalState(mergedState);
      this._applyStateObj(states.join(','), mergedState, this._normalState, false, !noAnimation && !this.__inHover && animationCfg && animationCfg.duration > 0, animationCfg);
      const textContent = this._textContent;
      const textGuide = this._textGuide;
      if (textContent) {
        textContent.useStates(states, noAnimation, useHoverLayer);
      }
      if (textGuide) {
        textGuide.useStates(states, noAnimation, useHoverLayer);
      }
      this._updateAnimationTargets();
      this.currentStates = states.slice();
      this.markRedraw();
      if (!useHoverLayer && this.__inHover) {
        this._toggleHoverLayerFlag(false);
        this.__dirty &= ~REDRAW_BIT;
      }
    }
  };
  Element.prototype._updateAnimationTargets = function () {
    for (let i = 0; i < this.animators.length; i++) {
      const animator = this.animators[i];
      if (animator.targetName) {
        animator.changeTarget(this[animator.targetName]);
      }
    }
  };
  Element.prototype.removeState = function (state) {
    const idx = indexOf(this.currentStates, state);
    if (idx >= 0) {
      const currentStates = this.currentStates.slice();
      currentStates.splice(idx, 1);
      this.useStates(currentStates);
    }
  };
  Element.prototype.replaceState = function (oldState, newState, forceAdd) {
    const currentStates = this.currentStates.slice();
    const idx = indexOf(currentStates, oldState);
    const newStateExists = indexOf(currentStates, newState) >= 0;
    if (idx >= 0) {
      if (!newStateExists) {
        currentStates[idx] = newState;
      } else {
        currentStates.splice(idx, 1);
      }
    } else if (forceAdd && !newStateExists) {
      currentStates.push(newState);
    }
    this.useStates(currentStates);
  };
  Element.prototype.toggleState = function (state, enable) {
    if (enable) {
      this.useState(state, true);
    } else {
      this.removeState(state);
    }
  };
  Element.prototype._mergeStates = function (states) {
    const mergedState = {};
    let mergedTextConfig;
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      extend(mergedState, state);
      if (state.textConfig) {
        mergedTextConfig = mergedTextConfig || {};
        extend(mergedTextConfig, state.textConfig);
      }
    }
    if (mergedTextConfig) {
      mergedState.textConfig = mergedTextConfig;
    }
    return mergedState;
  };
  Element.prototype._applyStateObj = function (stateName, state, normalState, keepCurrentStates, transition, animationCfg) {
    const needsRestoreToNormal = !(state && keepCurrentStates);
    if (state && state.textConfig) {
      this.textConfig = extend({}, keepCurrentStates ? this.textConfig : normalState.textConfig);
      extend(this.textConfig, state.textConfig);
    } else if (needsRestoreToNormal) {
      if (normalState.textConfig) {
        this.textConfig = normalState.textConfig;
      }
    }
    const transitionTarget = {};
    let hasTransition = false;
    for (var i = 0; i < PRIMARY_STATES_KEYS.length; i++) {
      const key = PRIMARY_STATES_KEYS[i];
      const propNeedsTransition = transition && DEFAULT_ANIMATABLE_MAP[key];
      if (state && state[key] != null) {
        if (propNeedsTransition) {
          hasTransition = true;
          transitionTarget[key] = state[key];
        } else {
          this[key] = state[key];
        }
      } else if (needsRestoreToNormal) {
        if (normalState[key] != null) {
          if (propNeedsTransition) {
            hasTransition = true;
            transitionTarget[key] = normalState[key];
          } else {
            this[key] = normalState[key];
          }
        }
      }
    }
    if (!transition) {
      for (var i = 0; i < this.animators.length; i++) {
        const animator = this.animators[i];
        const targetName = animator.targetName;
        if (!animator.getLoop()) {
          animator.__changeFinalValue(targetName
            ? (state || normalState)[targetName]
            : (state || normalState));
        }
      }
    }
    if (hasTransition) {
      this._transitionState(stateName, transitionTarget, animationCfg);
    }
  };
  Element.prototype._attachComponent = function (componentEl) {

  };
  Element.prototype._detachComponent = function (componentEl) {

  };
  Element.prototype.getClipPath = function () {
    return this._clipPath;
  };
  Element.prototype.setClipPath = function (clipPath) {
    if (this._clipPath && this._clipPath !== clipPath) {
      this.removeClipPath();
    }
    this._attachComponent(clipPath);
    this._clipPath = clipPath;
    this.markRedraw();
  };
  Element.prototype.removeClipPath = function () {
    const clipPath = this._clipPath;
    if (clipPath) {
      this._detachComponent(clipPath);
      this._clipPath = null;
      this.markRedraw();
    }
  };
  Element.prototype.getTextContent = function () {
    return this._textContent;
  };
  Element.prototype.setTextContent = function (textEl) {
    const previousTextContent = this._textContent;
    if (previousTextContent === textEl) {
      return;
    }
    if (previousTextContent && previousTextContent !== textEl) {
      this.removeTextContent();
    }

    textEl.innerTransformable = new Transformable();
    this._attachComponent(textEl);
    this._textContent = textEl;
  };
  Element.prototype.setTextConfig = function (cfg) {
    if (!this.textConfig) {
      this.textConfig = {};
    }
    extend(this.textConfig, cfg);
    this.markRedraw();
  };
  Element.prototype.removeTextConfig = function () {
    this.textConfig = null;
    this.markRedraw();
  };
  Element.prototype.removeTextContent = function () {
    const textEl = this._textContent;
    if (textEl) {
      textEl.innerTransformable = null;
      this._detachComponent(textEl);
      this._textContent = null;
      this._innerTextDefaultStyle = null;
    }
  };
  Element.prototype.getTextGuideLine = function () {
    return this._textGuide;
  };
  Element.prototype.setTextGuideLine = function (guideLine) {
    if (this._textGuide && this._textGuide !== guideLine) {
      this.removeTextGuideLine();
    }
    this._textGuide = guideLine;
  };
  Element.prototype.removeTextGuideLine = function () {

  };
  Element.prototype.markRedraw = function () {

  };
  Element.prototype.dirty = function () {
    this.markRedraw();
  };
  Element.prototype._toggleHoverLayerFlag = function (inHover) {
    this.__inHover = inHover;
    const textContent = this._textContent;
    const textGuide = this._textGuide;
    if (textContent) {
      textContent.__inHover = inHover;
    }
    if (textGuide) {
      textGuide.__inHover = inHover;
    }
  };
  Element.prototype.addSelfToZr = function (zr) {

  };
  Element.prototype.removeSelfFromZr = function (zr) {

  };
  Element.prototype.animate = function (key, loop, allowDiscreteAnimation) {

  };
  Element.prototype.addAnimator = function (animator, key) {

  };
  Element.prototype.updateDuringAnimation = function (key) {
    this.markRedraw();
  };
  Element.prototype.stopAnimation = function (scope, forwardToLast) {
    return this;
  };
  Element.prototype.animateTo = function (target, cfg, animationProps) {

  };
  Element.prototype.animateFrom = function (target, cfg, animationProps) {

  };
  Element.prototype._transitionState = function (stateName, target, cfg, animationProps) {

  };
  Element.prototype.getBoundingRect = function () {
    return null;
  };
  Element.prototype.getPaintRect = function () {
    return null;
  };
  Element.initDefaultProps = (function () {
    const elProto = Element.prototype;
    elProto.type = 'element';
    elProto.name = '';
    elProto.ignore =
      elProto.silent =
        elProto.isGroup =
          elProto.draggable =
            elProto.dragging =
              elProto.ignoreClip =
                elProto.__inHover = false;
    elProto.__dirty = REDRAW_BIT;
    const logs = {};

    function logDeprecatedError(key, xKey, yKey) {
      if (!logs[key + xKey + yKey]) {
        console.warn(`DEPRECATED: '${key}' has been deprecated. use '${xKey}', '${yKey}' instead`);
        logs[key + xKey + yKey] = true;
      }
    }

    function createLegacyProperty(key, privateKey, xKey, yKey) {
      Object.defineProperty(elProto, key, {
        get() {
          if (process.env.NODE_ENV !== 'production') {
            logDeprecatedError(key, xKey, yKey);
          }
          if (!this[privateKey]) {
            const pos = this[privateKey] = [];
            enhanceArray(this, pos);
          }
          return this[privateKey];
        },
        set(pos) {
          if (process.env.NODE_ENV !== 'production') {
            logDeprecatedError(key, xKey, yKey);
          }
          this[xKey] = pos[0];
          this[yKey] = pos[1];
          this[privateKey] = pos;
          enhanceArray(this, pos);
        }
      });

      function enhanceArray(self, pos) {
        Object.defineProperty(pos, 0, {
          get() {
            return self[xKey];
          },
          set(val) {
            self[xKey] = val;
          }
        });
        Object.defineProperty(pos, 1, {
          get() {
            return self[yKey];
          },
          set(val) {
            self[yKey] = val;
          }
        });
      }
    }

    if (Object.defineProperty) {
      createLegacyProperty('position', '_legacyPos', 'x', 'y');
      createLegacyProperty('scale', '_legacyScale', 'scaleX', 'scaleY');
      createLegacyProperty('origin', '_legacyOrigin', 'originX', 'originY');
    }
  }());
  return Element;
}());
mixin(Element, Eventful);
mixin(Element, Transformable);

function copyArrShallow(source, target, len) {
  for (let i = 0; i < len; i++) {
    source[i] = target[i];
  }
}

function is2DArray(value) {
  return isArrayLike(value[0]);
}

function copyValue(target, source, key) {
  if (isArrayLike(source[key])) {
    if (!isArrayLike(target[key])) {
      target[key] = [];
    }
    if (isTypedArray(source[key])) {
      const len = source[key].length;
      if (target[key].length !== len) {
        target[key] = new (source[key].constructor)(len);
        copyArrShallow(target[key], source[key], len);
      }
    } else {
      const sourceArr = source[key];
      const targetArr = target[key];
      const len0 = sourceArr.length;
      if (is2DArray(sourceArr)) {
        const len1 = sourceArr[0].length;
        for (let i = 0; i < len0; i++) {
          if (!targetArr[i]) {
            targetArr[i] = Array.prototype.slice.call(sourceArr[i]);
          } else {
            copyArrShallow(targetArr[i], sourceArr[i], len1);
          }
        }
      } else {
        copyArrShallow(targetArr, sourceArr, len0);
      }
      targetArr.length = sourceArr.length;
    }
  } else {
    target[key] = source[key];
  }
}

function isValueSame(val1, val2) {
  return val1 === val2 ||
    isArrayLike(val1) && isArrayLike(val2) && is1DArraySame(val1, val2);
}

function is1DArraySame(arr0, arr1) {
  const len = arr0.length;
  if (len !== arr1.length) {
    return false;
  }
  for (let i = 0; i < len; i++) {
    if (arr0[i] !== arr1[i]) {
      return false;
    }
  }
  return true;
}

export default Element;
