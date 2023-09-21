
export function cloneEvent(e) {
  const propertys = [
    'isTrusted',
    'altKey',
    'altitudeAngle',
    'azimuthAngle',
    'bubbles',
    'button',
    'buttons',
    'cancelBubble',
    'cancelable',
    'clientX',
    'clientY',
    'composed',
    'ctrlKey',
    'defaultPrevented',
    'detail',
    'eventPhase',
    'height',
    'isPrimary',
    'layerX',
    'layerY',
    'deltaY',
    'deltaX',
    'deltaZ',
    'metaKey',
    'movementX',
    'movementY',
    'offsetX',
    'offsetY',
    'pageX',
    'pageY',
    'pointerId',
    'pointerType',
    'pressure',
    'returnValue',
    'screenX',
    'screenY',
    'shiftKey',
    'tangentialPressure',
    'tiltX',
    'tiltY',
    'timeStamp',
    'twist',
    'type',
    'which',
    'width',
    'x',
    'y'
  ];
  const event = {};
  propertys.forEach(field => {
    event[field] = e[field];
  });
  event.type = event.type.replace('pointer', 'mouse');
  return event;
}

export function cloneDom(dom) {
  const propertys = [
    'clientHeight',
    'clientLeft',
    'clientWidth',
    'clientTop',
    'nodeType',
    'nodeName',
  ];

  const { bottom, height, left, top, right, width, x, y } = dom.getBoundingClientRect();

  const elem = {
    rect: {
      bottom,
      height,
      left,
      top,
      right,
      width,
      x,
      y,
      offsetLeft: dom.offsetLeft,
      offsetTop: dom.offsetTop,
    },
    ownerDocument: {},
    style: {},
  };
  propertys.forEach(field => {
    elem[field] = dom[field];
  });

  return elem;
}

export const VirtualEvent = (event) => {
  const e = {
    preventDefault() {
      return false;
    },
    stopPropagation() {
      return false;
    },
    cancelBubble: false,
  };
  for (const key in event) {
    e[key] = event[key];
  }
  return e;
};


export const VirtualDom = (function () {
  const _listeners = {};
  let pointerId = 0;

  function VirtualDom(dom) {
    if (!(this instanceof VirtualDom)) {
      return new VirtualDom(dom);
    }
    this.rect = {};
    if (dom) {
      this.cloneDom(dom);
    }
  }

  VirtualDom.prototype = {
    addEventListener(type, fn) {
      if (!_listeners[type]) {
        _listeners[type] = [];
      }
      _listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (_listeners[type]) {
        const index = _listeners[type].indexOf(fn);
        _listeners[type].splice(index, 1);
      }
    },
    releasePointerCapture() {
      pointerId = null;
    },
    setPointerCapture(_pointerId) {
      pointerId = _pointerId;
    },
    getPointer() {
      return pointerId;
    },
    getBoundingClientRect() {
      return this.rect;
    },
    cloneDom(dom) {
      for (const key in dom) {
        this[key] = dom[key];
      }
    },
    dispatchEvent(event) {
      const events = _listeners[event.type];
      if (events) {
        events.forEach(fn => {
          fn(VirtualEvent(event));
        });
      }
    },
    setAttribute(key, val) {
      this[key] = val;
    },
    getAttribute(key) {
      return this[key];
    },
    getWidth() {
      return this.rect.width;
    },
    getHeight() {
      return this.rect.height;
    }
  };

  return VirtualDom;
}());
