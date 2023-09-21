import { Group } from 'three';
import { __extends } from 'tslib';
import * as zrUtil from '../core/util.js';
import BoundingRect from '../core/BoundingRect.js';
import { extend, isObject, keys } from '../core/util';

const Group3D = (function (_super) {
  __extends(Group3D, _super);

  function Group3D(opts) {
    var _this = _super.call(this) || this;
    _this.attr(opts);
    return _this;
  }

  Group3D.prototype.childrenRef = function () {
    return this.children;
  };
  Group3D.prototype.children = function () {
    return this.children.slice();
  };
  Group3D.prototype.childAt = function (idx) {
    return this.children[idx];
  };
  Group3D.prototype.childOfName = function (name) {
    var children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].name === name) {
        return children[i];
      }
    }
  };
  Group3D.prototype.childCount = function () {
    return this.children.length;
  };
  Group3D.prototype.addBefore = function (child, nextSibling) {
    if (child && child !== this && child.parent !== this &&
      nextSibling && nextSibling.parent === this) {
      var children = this.children;
      var idx = children.indexOf(nextSibling);
      if (idx >= 0) {
        this.add(child);
        this._doAdd(child);
      }
    }
    return this;
  };
  Group3D.prototype.replace = function (oldChild, newChild) {
    var idx = zrUtil.indexOf(this.children, oldChild);
    if (idx >= 0) {
      this.replaceAt(newChild, idx);
    }
    return this;
  };
  Group3D.prototype.replaceAt = function (child, index) {
    var children = this.children;
    var old = children[index];

    if (child && child !== this && child.parent !== this && child !== old) {
      this.add(child);
      this.remove(old);
      this._doAdd(child);
    }
    return this;
  };
  Group3D.prototype._doAdd = function (child) {
    if (child.parent) {
      child.parent.remove(child);
    }
  };
  Group3D.prototype.delChild = function (child) {
    this.remove(child);
    child.dispose && child.dispose();
  };

  Group3D.prototype.removeAll = function () {
    this.children.forEach(child => {
      this.delChild(child);
    });
    return this;
  };
  Group3D.prototype.eachChild = function (cb, context) {
    var children = this.children;
    for (let i = 0; i < children.length; i++) {
      var child = children[i];
      cb.call(context, child, i);
    }
    return this;
  };
  Group3D.prototype.traverse = function (cb, context) {
    for (let i = 0; i < this.children.length; i++) {
      var child = this.children[i];
      var stopped = cb.call(context, child);
      if (child.isGroup && !stopped) {
        child.traverse(cb, context);
      }
    }
    return this;
  };
  Group3D.prototype.getBoundingRect = function (includeChildren) {
    var tmpRect = new BoundingRect(0, 0, 0, 0);
    var children = includeChildren || this.children;
    var tmpMat = [];
    var rect = null;
    for (let i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.ignore || child.invisible) {
        continue;
      }
      var childRect = child.getBoundingRect();
      var transform = child.getLocalTransform(tmpMat);
      if (transform) {
        BoundingRect.applyTransform(tmpRect, childRect, transform);
        rect = rect || tmpRect.clone();
        rect.union(tmpRect);
      } else {
        rect = rect || childRect.clone();
        rect.union(childRect);
      }
    }
    return rect || tmpRect;
  };

  Group3D.prototype.attrKV = function (key, value) {
    if (key === 'textConfig') {
      this.setTextConfig(value);
    } else if (key === 'textContent') {
      this.setTextContent(value);
    } else if (key === 'clipPath') {
      this.setClipPath(value);
    } else if (key === 'extra') {
      this.userData.extra = this.userData.extra || {};
      extend(this.userData.extra, value);
    } else {
      this.setAttr(key, value);
    }
  };

  Group3D.prototype.hide = function () {
    this.visible = false;
  };

  Group3D.prototype.show = function () {
    this.visible = true;
  };

  Group3D.prototype.setAttr = function (key, value) {
    this.userData[key] = value;
  };

  Group3D.prototype.attr = function (keyOrObj, value) {
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

  Group3D.prototype.getTextContent = function () {
    return this.userData._textContent;
  };

  Group3D.prototype.setTextContent = function (textEl) {
    const previousTextContent = this.userData._textContent;
    if (previousTextContent === textEl) {
      return;
    }
    this.userData._textContent = textEl;
    return this;
  };

  Group3D.prototype.setTextConfig = function (cfg) {
    if (!this.userData.textConfig) {
      this.userData.textConfig = {};
    }
    extend(this.userData.textConfig, cfg);
  };

  Group3D.prototype.removeTextConfig = function () {
    this.userData.textConfig = null;
  };

  Group3D.prototype.getClipPath = function () {
    return this.userData._clipPath;
  };

  Group3D.prototype.setClipPath = function (clipPath) {
    this.userData._clipPath = clipPath;
  };

  Group3D.prototype.getAttr = function (key) {
    return this.userData[key];
  };

  Group3D.prototype.updateTransform = function () {

  };

  return Group3D;
}(Group));

export default Group3D;
