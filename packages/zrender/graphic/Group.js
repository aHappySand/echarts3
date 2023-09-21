import { __extends } from 'tslib';
import * as zrUtil from '../core/util.js';
import BoundingRect from '../core/BoundingRect.js';
import Element from '../Element';

const ZRGroup = (function (_super) {
  __extends(ZRGroup, _super);

  function ZRGroup(opts) {
    var _this = _super.call(this, opts) || this;
    if (!this.ecModel) {
      throw new Error('ecModel must be passed');
    }
    _this.isGroup = true;
    _this._children = [];
    return _this;
  }
  ZRGroup.prototype.childrenRef = function () {
    return this._children;
  };
  ZRGroup.prototype.children = function () {
    return this._children.slice();
  };
  ZRGroup.prototype.childAt = function (idx) {
    return this._children[idx];
  };
  ZRGroup.prototype.childOfName = function (name) {
    var children = this._children;
    for (var i = 0; i < children.length; i++) {
      if (children[i].name === name) {
        return children[i];
      }
    }
  };
  ZRGroup.prototype.childCount = function () {
    return this._children.length;
  };
  ZRGroup.prototype.add = function (child) {
    if (child) {
      if (child !== this && child.parent !== this) {
        this._children.push(child);
        this._doAdd(child);
      }
      if (process.env.NODE_ENV !== 'production') {
        if (child.__hostTarget) {
          // eslint-disable-next-line no-throw-literal
          throw 'This elemenet has been used as an attachment';
        }
      }
    }
    return this;
  };
  ZRGroup.prototype.addBefore = function (child, nextSibling) {
    if (child && child !== this && child.parent !== this &&
      nextSibling && nextSibling.parent === this) {
      var children = this._children;
      var idx = children.indexOf(nextSibling);
      if (idx >= 0) {
        children.splice(idx, 0, child);
        this._doAdd(child);
      }
    }
    return this;
  };
  ZRGroup.prototype.replace = function (oldChild, newChild) {
    var idx = zrUtil.indexOf(this._children, oldChild);
    if (idx >= 0) {
      this.replaceAt(newChild, idx);
    }
    return this;
  };
  ZRGroup.prototype.replaceAt = function (child, index) {
    var children = this._children;
    var old = children[index];
    if (child && child !== this && child.parent !== this && child !== old) {
      children[index] = child;
      old.parent = null;
      this._doAdd(child);
    }
    return this;
  };
  ZRGroup.prototype._doAdd = function (child) {
    if (child.parent) {
      child.parent.remove(child);
    }
    if (this.ecModel) {
      this.ecModel.scheduler.api.getZr().refresh();
    }
    child.parent = this;
  };
  ZRGroup.prototype.remove = function (child) {
    var children = this._children;
    var idx = zrUtil.indexOf(children, child);
    if (idx < 0) {
      return this;
    }
    children.splice(idx, 1);
    child.parent = null;
    return this;
  };
  ZRGroup.prototype.removeAll = function () {
    var children = this._children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      child.parent = null;
    }
    children.length = 0;
    return this;
  };
  ZRGroup.prototype.eachChild = function (cb, context) {
    var children = this._children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      cb.call(context, child, i);
    }
    return this;
  };
  ZRGroup.prototype.traverse = function (cb, context) {
    for (var i = 0; i < this._children.length; i++) {
      var child = this._children[i];
      var stopped = cb.call(context, child);
      if (child.isGroup && !stopped) {
        child.traverse(cb, context);
      }
    }
    return this;
  };
  ZRGroup.prototype.getBoundingRect = function (includeChildren) {
    var tmpRect = new BoundingRect(0, 0, 0, 0);
    var children = includeChildren || this._children;
    var tmpMat = [];
    var rect = null;
    for (var i = 0; i < children.length; i++) {
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
  return ZRGroup;
}(Element));

export default ZRGroup;
