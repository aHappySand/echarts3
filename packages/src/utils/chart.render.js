import * as THREE from 'three';
import Animation, { getTime } from '../../zrender/animation/Animation';
import Handler from '../../zrender/Handler';
import HandlerProxy from '../../zrender/dom/HandlerProxy.js';


export class PickHelper {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.pickedObject = null;
    this.pickedObjectSavedColor = 0;
  }

  pick(normalizedPosition, objects, camera) {
    this.pickedObject = null;
    // cast a ray through the frustum
    this.raycaster.setFromCamera(normalizedPosition, camera);

    // get the list of objects the ray intersected
    const intersectedObjects = this.raycaster.intersectObjects(objects, true);

    if (intersectedObjects.length) {
      // console.log(intersectedObjects);
      // pick the first object. It's the closest one
      this.pickedObject = intersectedObjects[0];// .object
    }
  }

  rebackHex() {
    if (this.pickedObject) {
      this.pickedObject.material.emissive.setHex(this.pickedObjectSavedColor);
    }
  }

  setHex(color) {
    color = color || 0xFFFF00;
    this.pickedObject.material.emissive.setHex(color);
  }
}

export function RenderManager(props) {
  this.canvas = props.canvas;
  this.virtualCanvas = props.virtualCanvas;

  this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
  this.renderer.autoClear = false;
  this.renderer.localClippingEnabled = true;
  // this.renderer.setPixelRatio(1.25);

  this.pickHelper = new PickHelper();
  this.scenes = [];


  this._sleepAfterStill = 10;
  this._stillFrameAccum = 0;
  this._needsRefresh = true;

  this.animation = new Animation({
    stage: {
      update: () => {
        this._flush();
      }
    }
  });
  this.handler = new Handler(this, new HandlerProxy(this.virtualCanvas, this.virtualCanvas));
  this.animation.start();
}

RenderManager.prototype = {
  updateSize() {
    const { width } = this.canvas;
    const { height } = this.canvas;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
    }
  },

  getSize() {
    return { width: this.canvas.width, height: this.canvas.height };
  },

  render(charts) {
    charts = charts || this.scenes;
    this.updateSize();
    const { renderer } = this;
    renderer.setClearColor(0xffffff);
    renderer.setScissorTest(false);
    renderer.clear();

    renderer.setClearColor(0xe0e0e0, 0);
    renderer.setScissorTest(true);

    const renderHeight = renderer.domElement.height;

    charts.forEach((chart) => {
      const rect = chart._dom.rect;
      // set the viewport
      const width = (rect.right - rect.left);
      const height = (rect.bottom - rect.top);

      /**
       * 左下角为起点
       */
      const left = rect.offsetLeft;
      const bottom = renderHeight - rect.offsetTop - height;

      renderer.setViewport(left, bottom, width, height);
      renderer.setScissor(left, bottom, width, height);

      const { componentScene, componentCamera, chartScene, chartCamera } = chart.scene;

      renderer.render(componentScene, componentCamera);
      renderer.render(chartScene, chartCamera);
    });
    this.scenes = charts;
  },

  setBackgroundColor(backgroundColor) {
    (this.scenes || []).forEach(scene => {
      scene.background = new THREE.Color(backgroundColor);
    });
    this.refresh();
    this._backgroundColor = backgroundColor;
  },

  getBackgroundColor() {
    return this._backgroundColor;
  },

  refresh() {
    this._needsRefresh = true;
    this.animation.start();
  },
  refreshImmediately() {
    this._needsRefresh = false;
    this.render();
    this._needsRefresh = false;
  },

  /**
   * Wake up animation loop. But not render.
   */
  wakeUp() {
    this.animation.start();
    // Reset the frame count.
    this._stillFrameAccum = 0;
  },
  flush() {
    this._flush();
  },
  _flush() {
    let triggerRendered;
    const start = getTime();
    if (this._needsRefresh) {
      triggerRendered = true;
      this.refreshImmediately();
    }
    var end = getTime();
    if (triggerRendered) {
      this._stillFrameAccum = 0;
      this.trigger('rendered', {
        elapsedTime: end - start
      });
    }
    else if (this._sleepAfterStill > 0) {
      this._stillFrameAccum++;
      if (this._stillFrameAccum > this._sleepAfterStill) {
        this.animation.stop();
      }
    }
  },
  setSleepAfterStill(stillFramesCount) {
    this._sleepAfterStill = stillFramesCount;
  },

  clearAnimation() {
    this.animation.clear();
  },
  startAnimatioin() {
    this.animation.start();
  },
  stopAnimatioin() {
    this.animation.stop();
  },

  trigger(eventName, event) {
    this.handler.trigger(eventName, event);
  },
  on(eventName, eventHandler, context) {
    this.handler.on(eventName, eventHandler, context);
    return this;
  },

  off(eventName, eventHandler) {
    this.handler.off(eventName, eventHandler);
  }
};
