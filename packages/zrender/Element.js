import {
  guid,
  isObject,
  keys,
  extend,
  mixin,
  indexOf,
  logError,
  reduce
} from './core/util.js';
import { REDRAW_BIT } from './graphic/constants';

import Transformable, { TRANSFORMABLE_PROPS } from './core/Transformable';
import Eventful from './core/Eventful';

export const PRESERVED_NORMAL_STATE = '__zr_normal__';
const PRIMARY_STATES_KEYS = TRANSFORMABLE_PROPS.concat(['ignore']);
const DEFAULT_ANIMATABLE_MAP = reduce(TRANSFORMABLE_PROPS, (obj, key) => {
  obj[key] = true;
  return obj;
}, { ignore: false });

const Element = (function () {
  function Element(props) {
    this.id = guid();
    this.currentStates = [];
    this.states = {};
    this._init(props);

    return this;
  }
  Element.prototype._init = function (props) {
    this.attr(props);
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
  };
  Element.prototype.show = function () {
    this.ignore = false;
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
    return this;
  };
  Element.prototype.getTextContent = function () {
    return this._textContent;
  };
  Element.prototype.setTextContent = function (textEl) {
    const previousTextContent = this._textContent;
    if (previousTextContent === textEl) {
      return;
    }
    this._textContent = textEl;
    return this;
  };
  Element.prototype.setTextConfig = function (cfg) {
    if (!this.textConfig) {
      this.textConfig = {};
    }
    extend(this.textConfig, cfg);
  };
  Element.prototype.removeTextConfig = function () {
    this.textConfig = null;
  };

  Element.prototype.getClipPath = function () {
    return this._clipPath;
  };
  Element.prototype.setClipPath = function (clipPath) {
    this._clipPath = clipPath;
  };

  Element.prototype.setAttr = function (key, value) {
    this[key] = value;
  };

  Element.prototype.getAttr = function (key) {
    return this[key];
  };

  Element.prototype.getWidth = function () {
    return this.ecModel.scheduler.api.getWidth();
  };

  Element.prototype.getHeight = function () {
    return this.ecModel.scheduler.api.getHeight();
  };

  Element.prototype.toCenterCoord2 = function (pos) {
    const halfWidth = this.getWidth() / 2;
    const halfHeight = this.getHeight() / 2;
    return [pos.x1 - halfWidth, halfHeight - pos.y1, 0, pos.x2 - halfWidth, halfHeight - pos.y2, 0];
  };

  Element.prototype.toCenterCoord = function (pos) {
    pos = pos || this;
    return [pos.x - this.getWidth() / 2, this.getHeight() / 2 - pos.y, 0];
  };
  Element.prototype.dirty = function () {
    // this.markRedraw();
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


  Element.prototype.saveCurrentToNormalState = function (toState) {
    this._innerSaveToNormal(toState);
    // const normalState = this._normalState;
    // for (let i = 0; i < this.animators.length; i++) {
    //   const animator = this.animators[i];
    //   const fromStateTransition = animator.__fromStateTransition;
    //   if (animator.getLoop() || fromStateTransition && fromStateTransition !== PRESERVED_NORMAL_STATE) {
    //     continue;
    //   }
    //   const targetName = animator.targetName;
    //   const target = targetName
    //     ? normalState[targetName] : normalState;
    //   animator.saveTo(target);
    // }
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
        for (let i = 0; i < len; i++) {
          if (states[i] !== currentStates[i]) {
            notChange = false;
            break;
          }
        }
      }
      if (notChange) {
        return;
      }
      for (let i = 0; i < len; i++) {
        const stateName = states[i];
        let stateObj;
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
      // this.markRedraw();
      if (!useHoverLayer && this.__inHover) {
        this._toggleHoverLayerFlag(false);
        this.__dirty &= ~REDRAW_BIT;
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
    for (let i = 0; i < PRIMARY_STATES_KEYS.length; i++) {
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
    // if (!transition) {
    //   for (let i = 0; i < this.animators.length; i++) {
    //     const animator = this.animators[i];
    //     const targetName = animator.targetName;
    //     if (!animator.getLoop()) {
    //       animator.__changeFinalValue(targetName
    //         ? (state || normalState)[targetName]
    //         : (state || normalState));
    //     }
    //   }
    // }
    // if (hasTransition) {
    //   this._transitionState(stateName, transitionTarget, animationCfg);
    // }
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
  Element.initDefaultProps = (function () {
    var elProto = Element.prototype;
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
    var logs = {};
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
            var pos = this[privateKey] = [];
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

export default Element;
