import { Group } from 'three';
// import { __extends } from 'tslib';
import * as zrUtil from '../core/util.js';
import BoundingRect from '../core/BoundingRect.js';
import { extend, isObject, keys } from '../core/util';

class Group3D extends Group {
  constructor(opts) {
    super();
    this.attr(opts);
    return this;
  }


  childrenRef() {
    return this.children;
  }

  children() {
    return this.children.slice();
  }

  childAt(idx) {
    return this.children[idx];
  }

  childOfName(name) {
    var children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].name === name) {
        return children[i];
      }
    }
  }

  childCount() {
    return this.children.length;
  }

  addBefore(child, nextSibling) {
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
  }

  replace(oldChild, newChild) {
    var idx = zrUtil.indexOf(this.children, oldChild);
    if (idx >= 0) {
      this.replaceAt(newChild, idx);
    }
    return this;
  }

  replaceAt(child, index) {
    var children = this.children;
    var old = children[index];

    if (child && child !== this && child.parent !== this && child !== old) {
      this.add(child);
      this.remove(old);
      this._doAdd(child);
    }
    return this;
  }

  _doAdd(child) {
    if (child.parent) {
      child.parent.remove(child);
    }
  }

  delChild(child) {
    this.remove(child);
    child.dispose && child.dispose();
  }

  removeAll() {
    this.children.forEach(child => {
      this.delChild(child);
    });
    return this;
  }

  eachChild(cb, context) {
    var children = this.children;
    for (let i = 0; i < children.length; i++) {
      var child = children[i];
      cb.call(context, child, i);
    }
    return this;
  }

  traverse(cb, context) {
    for (let i = 0; i < this.children.length; i++) {
      var child = this.children[i];
      var stopped = cb.call(context, child);
      if (child.isGroup && !stopped) {
        child.traverse(cb, context);
      }
    }
    return this;
  }

  getBoundingRect(includeChildren) {
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
  }

  attrKV(key, value) {
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
  }

  hide() {
    this.visible = false;
  }

  show() {
    this.visible = true;
  }

  setAttr(key, value) {
    this.userData[key] = value;
  }

  attr(keyOrObj, value) {
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
  }

  getTextContent() {
    return this.userData._textContent;
  }

  setTextContent(textEl) {
    const previousTextContent = this.userData._textContent;
    if (previousTextContent === textEl) {
      return;
    }
    this.userData._textContent = textEl;
    return this;
  }

  setTextConfig(cfg) {
    if (!this.userData.textConfig) {
      this.userData.textConfig = {};
    }
    extend(this.userData.textConfig, cfg);
  }

  removeTextConfig() {
    this.userData.textConfig = null;
  }

  getClipPath() {
    return this.userData._clipPath;
  }

  setClipPath(clipPath) {
    this.userData._clipPath = clipPath;
  }

  getAttr(key) {
    return this.userData[key];
  }

  updateTransform() {

  }
}
export default Group3D;
