import * as THREE from 'three';
import { OrbitControls } from '../../../../src/plugins/OrbitControls2.js';

import { drawText, distoryObject } from './index';

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


const VirtualEvent = (event) => {
  const e = {
    preventDefault() {
      return false;
    },
  };
  for (const key in event) {
    e[key] = event[key];
  }
  return e;
};


const VirtualDom = () => {
  const _listeners = {};
  let pointerId = 0;

  return {
    rect: {},
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
    getBoundingClientRect() {
      return this.rect;
    },
    cloneDom(dom) {
      for (const key in dom) {
        this[key] = dom[key];
      }
    },
    dispatchEvent(data) {
      const events = _listeners[data.type];
      if (events) {
        events.forEach(fn => {
          fn(VirtualEvent(data.event));
        });
      }
    }
  };
};


export function RenderManager(canvas) {
  this.canvas = canvas;
  this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  this.renderer.autoClear = false;
  this.renderer.localClippingEnabled = true;
  // this.renderer.setPixelRatio(1.25);

  this.pickHelper = new PickHelper();
  this.scenes = [];
}


RenderManager.prototype = {
  updateSize() {
    const { width } = this.canvas;
    const { height } = this.canvas;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
    }
  },

  render(scenes) {
    scenes = scenes || this.scenes;
    this.updateSize();
    const { renderer } = this;
    renderer.setClearColor(0xffffff);
    renderer.setScissorTest(false);
    renderer.clear();

    renderer.setClearColor(0xe0e0e0, 0);
    renderer.setScissorTest(true);

    const renderHeight = renderer.domElement.height;

    scenes.forEach((scene) => {
      const rect = scene.vDom.rect;
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

      renderer.render(scene.scene, scene.camera);
      renderer.render(scene.pointScene, scene.pointCamera);
    });
    this.scenes = scenes;
  },
};


/**
 * @param dom {Element}
 * @param render { RenderManager }
 * @param option {  }
 * @param virtualDiameter {number}
 * @constructor
 */
export function SceneManager({
  dom, render, option, virtualDiameter
}) {
  this.vDom = VirtualDom();
  this.vDom.cloneDom(dom);

  this.option = option;
  this.virtualDiameter = virtualDiameter;
  this.render = render;
  this.scene = new THREE.Scene();
  this.pointScene = new THREE.Scene();

  this.maxLeftOffset = 30;
  this.maxRightOffset = 30;
  this.maxTopOffset = 30;
  this.maxBottomOffset = 30;

  this.axisLineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color('#3d3d3d'),
    fog: false,
  });
  this.pointMesh = Object.create(null);
  this.addCamera();

  this.currentSeries = this.option.series;
  this.position0 = {};
  this.zoom = 1;
}

SceneManager.prototype = {
  addCamera() {
    const virtualDiameter = this.virtualDiameter;
    const { rect: { width, height } } = this.vDom;
    const halfW = width / 2;
    const halfH = height / 2;

    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, virtualDiameter);
    // this.camera = new THREE.PerspectiveCamera( 50, 1, 1, 1000 );
    this.camera.position.z = virtualDiameter;

    this.pointCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, virtualDiameter);
    this.pointCamera.position.z = virtualDiameter;

    // this.handleTransform({k: 0.36, x: 0, y: 0});
    this.controls = new OrbitControls(this.pointCamera, this.vDom);
    this.controls.enableRotate = false; // 禁止旋转
    this.controls.translateType = 'xy';
    this.controls.isRightBtnMove = false;
    this.controls.minZoom = 1;

    this.controls.addEventListener('start', (e) => {
      this.checkOrbitControls(e.target);
    });
    this.controls.addEventListener('change', (e) => {
      console.log(e.target.stopPan);

      let rk = 1 / e.target.object.zoom;
      rk = rk < 0.2 ? 0.2 : rk;
      this.pointGroup.children.forEach(mesh => {
        const size = mesh.userData.size;
        const newGeometry = new THREE.CircleGeometry(size * rk);
        mesh.geometry.dispose();
        mesh.geometry = newGeometry;
      });
      this.checkOrbitControls(e.target);
      //
      // this.controls.target.set(0, 0, 0);
      // this.pointCamera.position.set(0, 0, 0);
      // this.pointCamera.zoom = 1;

      this.render.render();
    });

    // this.getAxisWorld();

    this.drawCover({});
  },
  // 处理鼠标划过
  handleMousemovePoint(pickedObject) {
    if (pickedObject.object instanceof THREE.InstancedMesh) {
      const { type } = pickedObject.object.userData;

      if (type === 'series') {
        console.log(pickedObject.object.userData, pickedObject.instanceId);
      }
    }
  },
  updateCamera() {
    const { width, height } = this.vDom.rect;

    const halfW = width / 2;
    const halfH = height / 2;
    this.camera.left = -halfW;
    this.camera.right = halfW;

    this.camera.bottom = -halfH;
    this.camera.top = halfH;

    this.camera.updateProjectionMatrix();
  },
  handleTransform(transform) {
    const { pointCamera, camera, render, position: { width, height } } = this;

    if (false) {
      // adjust the ortho camera position based on zoom changes
      const mouseBefore = new THREE.Vector3(transform.wx, transform.wy, 0);
      mouseBefore.unproject(pointCamera);

      pointCamera.zoom = transform.k;
      pointCamera.updateProjectionMatrix();

      const mouseAfter = new THREE.Vector3(transform.wx, transform.wy, 0);
      mouseAfter.unproject(pointCamera);

      pointCamera.position.sub(mouseAfter).add(mouseBefore);
    } else {
      pointCamera.position.x = -transform.x / pointCamera.zoom;
      pointCamera.position.y = transform.y / pointCamera.zoom;
    }
    let rk = 1 / transform.k;
    rk = rk < 0.2 ? 0.2 : rk;
    this.pointGroup.children.forEach(mesh => {
      const size = mesh.userData.size;
      const newGeometry = new THREE.CircleGeometry(size * rk);
      mesh.geometry.dispose();
      mesh.geometry = newGeometry;

      var scaleVector = new THREE.Vector3();
      var scaleFactor = 400.0;
      var scale = scaleVector.subVectors(mesh.position, camera.position).length() / scaleFactor;
    });
    pointCamera.updateMatrixWorld();


    //
    // const { x, y, k: zoom } = transform;
    // // TODO::判断是否越线
    //
    // const { width, height } = this.vDom.rect;
    //
    // const maxLeftOffset = 40;
    // const maxRightOffset = 40;
    // const maxTopOffset = 40;
    // const maxBottomOffset = 30;
    //
    // const ratio = zoom - 1;
    // let top = -y - ratio * maxTopOffset;
    // let left = -x - ratio * maxLeftOffset;
    // let right = ratio * width - left - maxRightOffset;
    // let bottom = ratio * height - top - maxBottomOffset;
    //
    // this.afterOrbit = {
    //   zoom,
    //   left,
    //   right,
    //   top,
    //   bottom,
    // };
    //
    // this.drawXAxis(this.option.xAxisData, this.afterOrbit);
    // const yData = this.filterSeriesByX(this.option);
    // const yAxisData = [];
    // for (let i in yData) {
    //   yAxisData.push({
    //     ...this.option.yAxisData[i],
    //     ...yData[i]
    //   });
    // }
    //
    // this.drawYAxis(yAxisData,  this.afterOrbit);
    //
    // // 重新根据x轴 绘制
    // this.drawPoint({
    //   series: this.currentSeries,
    //   yAxisData,
    //   xAxisData: this.option.xAxisData
    // });
    // this.prePoint = null;
    // this.showCurrentScatter();
    // this.render.render();
    // return this;
  },

  reRender() {
    this.render.renderer.render(this.scene, this.pointCamera);
  },
  init() {

  },
  // 获取坐标轴的世界坐标系
  getXAxisWorld() {
    const leftV = new THREE.Vector3(-1, 0, 0);
    this.axisWorldLeft = leftV.unproject(this.camera);

    const rightV = new THREE.Vector3(1, 0, 0);
    this.axisWorldRight = rightV.unproject(this.camera);
  },
  parseXPosition(x) {
    const { width } = this.vDom.rect;
    const halfWidth = width / 2;
    const leftV = new THREE.Vector3(x / halfWidth - 1, 0, 0);
    const nLeftV = leftV.unproject(this.camera).project(this.pointCamera);
    return nLeftV.x * halfWidth;
  },
  // 获取坐标轴的世界坐标系
  getYAxisWorld() {
    const topV = new THREE.Vector3(0, 1, 0);
    this.axisWorldTop = topV.unproject(this.camera);

    const bottomV = new THREE.Vector3(0, -1, 0);
    this.axisWorldBottom = bottomV.unproject(this.camera);
  },
  parseYPosition(y) {
    const { height } = this.vDom.rect;
    const halfHeight = height / 2;
    const topV = new THREE.Vector3(0, 1 - y / halfHeight, 0);
    const nTopV = topV.unproject(this.camera).project(this.pointCamera);
    return nTopV.y * halfHeight;
  },
  checkOrbitControls(orbit) {
    const { zoom } = orbit.object;
    this.zoom = zoom;
    const { width, height } = this.vDom.rect;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    this.getXAxisWorld();
    this.getYAxisWorld();

    orbit.stopPan = false;

    // 转换为屏幕坐标系
    const nLeftV = this.axisWorldLeft.project(this.pointCamera);
    const xLeft = (nLeftV.x + 1) * halfWidth;

    // if (xLeft > 0 && orbit.xDirection >= 0) {
    //   orbit.stopPan = true;
    //   return;
    // }

    const nRightV = this.axisWorldRight.project(this.pointCamera);
    const xRight = (nRightV.x + 1) * halfWidth;

    // if (xRight < width && orbit.xDirection <= 0) {
    //   orbit.stopPan = true;
    //   return;
    // }

    const nTopV = this.axisWorldTop.project(this.pointCamera);
    const yTop = (1 - nTopV.y) * halfHeight;

    const nBottomV = this.axisWorldBottom.project(this.pointCamera);
    const yBottom = (1 - nBottomV.y) * halfHeight;

    const newPos = { xLeft, xRight, yTop, yBottom, zoom };

    console.log('newPos------', newPos);

    this.drawXAxis(this.option.xAxisData, newPos);
    this.drawYAxis(this.option.yAxisData, newPos);
    this.resetAxisPosition();
  },
  // 重新计算x轴坐标
  countXAxisPos(limit, axis) {
    const { width } = this.vDom.rect;
    const { xLeft, xRight, zoom } = limit;
    const { left = 40, right = 40 } = axis;

    const xWidth = zoom * (width - left - right);
    let xStartScale = (left - (xLeft + zoom * left)) / xWidth;

    const rw = xRight < width ? (xRight - left - right * zoom) : (width - left - right);
    let xEndScale = xStartScale + rw / xWidth;
    xStartScale = xStartScale < 0 ? 0 : xStartScale;
    xEndScale = xEndScale > 1 ? 1 : xEndScale;

    return { xStartScale, xEndScale };
  },
  /**
   * @param axisData {Array}
   * @param limit
   */
  drawXAxis(axisData, limit = { xLeft: 0, xRight: 0, zoom: 1 }) {
    const { width, height } = this.vDom.rect;
    const halfW = width / 2;
    const halfH = height / 2;

    if (this.xAxisGroup) {
      distoryObject(this.xAxisGroup, this.scene);
    }
    const group = new THREE.Group();
    group.userData.type = 'xaxis';
    group.position.z = 101;

    const labelGroup = new THREE.Group();
    labelGroup.userData.type = 'xaxis-label';
    labelGroup.position.z = 101;

    group.add(labelGroup);

    let { xLeft, xRight, zoom } = limit;

    if (xLeft === 0 && xRight === 0) {
      xRight = width;
    }

    this.position0.xAxis = null;

    axisData.forEach((axis) => {
      let { data, position = 'bottom', offset = 40, left = 50, right = 40, type = 'category', maxValue, minValue } = axis;

      left += 10;

      const hasStartX = axis.hasOwnProperty('startX');

      const bottom = Math.floor(-halfH + offset) + 0.5;
      // 主线
      const points = [
        new THREE.Vector3(-halfW + left - 15, bottom, 0),
        new THREE.Vector3(halfW - right + 10, bottom, 0),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, this.axisLineMaterial);
      group.add(line);


      if (type === 'category') {
        // 刻度
        const len = data.length;

        const startIndex = 0;
        const endIndex = len - 1;

        const leftCount = len * zoom;

        const splitNumber = leftCount >= 10 ? 10 : leftCount;
        const xLen = (width - left - right) * zoom;
        // if (hasStartX) { // 不需要这一步了，直接根据第一次计算的ratio里处理，如果重新计算ratio，会与之前不对应
        const l = Math.max(left, xLeft + left * zoom);
        const r = Math.min(width - right, xRight - right * zoom);
        // xLen = r - l;
        // }


        // x轴对应的坐标点
        const ratio = xLen / leftCount;

        const tickGeometry = new THREE.BufferGeometry();
        const positions = [];
        let start = Math.floor(-halfW + xLeft + left * zoom);

        const startAxis = -halfW + left;
        const endAxis = halfW - right;

        console.log('index-----------------', startIndex, endIndex, width);
        if (hasStartX) {
          if (type === 'category') {
            // const preStart = axis.startX + startIndex * axis.ratio;
            // start = this.parseXPosition(preStart);
          }
        } else {
          // start = Math.floor(-halfW + left) + 0.5;
          // axis.startX = left;
          // axis.ratio = ratio;
        }

        let txtWidth = 0;

        for (let i = 0; i < len; i++) {
          data[i].x = start;
          if (start >= startAxis && start <= endAxis) {
            // start = Math.floor(start) + 0.5;
            positions.push(start, bottom, 0);
            positions.push(start, bottom - 10, 0);
            const txtMesh = drawText({ txt: data[i].name, x: start, y: bottom - 20 });
            txtWidth += txtMesh.geometry.parameters.width;
            labelGroup.add(txtMesh);
          }
          start += ratio * zoom;
        }

        if (txtWidth > xLen) {
          labelGroup.children.forEach(m => {
            const move = m.geometry.parameters.width * 0.35355;
            m.rotation.set(0, 0, 45);
            m.position.y -= move;
            m.position.x -= move * 0.7;
          });
        }

        tickGeometry.attributes.position = new THREE.Float32BufferAttribute(positions, 3);
        const lineSegments = new THREE.LineSegments(tickGeometry, this.axisLineMaterial);
        group.add(lineSegments);
      } else {
        // 刻度
        const leftCount = 10;

        let splitNumber = leftCount >= 10 ? 10 : leftCount;
        splitNumber *= zoom;

        const xLen = (width - left - right) * zoom;

        // x轴对应的坐标点
        const ratio = xLen / splitNumber;

        const stepValue = (maxValue - minValue) / splitNumber;

        const tickGeometry = new THREE.BufferGeometry();
        const positions = [];
        let start = -halfW + xLeft + left * zoom;

        const startAxis = -halfW + left;
        const endAxis = halfW - right;

        let txtWidth = 0;

        axis.startPos = start;
        axis.endPos = xRight - right * zoom - halfW;

        for (let i = 0, v = minValue; i < splitNumber; i++, start += ratio, v += stepValue) {
          if (start >= startAxis && start <= endAxis) {
            if (v !== 0) {
              positions.push(start, bottom, 0);
              positions.push(start, bottom - 10, 0);
            }
            let txt = v.toFixed(2);
            if (v == 0) {
              txt = 0;
              this.position0.xAxis = { x: start, y: bottom };
            }
            const txtMesh = drawText({ txt: v == 0 ? 0 : v.toFixed(2), x: start, y: bottom - 20 });
            txtWidth += txtMesh.geometry.parameters.width;
            labelGroup.add(txtMesh);
          } else if (start > endAxis) {
            break;
          }
        }


        if (txtWidth > xLen) {
          labelGroup.children.forEach(m => {
            const move = m.geometry.parameters.width * 0.35355;
            m.rotation.set(0, 0, 45);
            m.position.y -= move;
            m.position.x -= move * 0.7;
          });
        }

        tickGeometry.attributes.position = new THREE.Float32BufferAttribute(positions, 3);
        const lineSegments = new THREE.LineSegments(tickGeometry, this.axisLineMaterial);
        group.add(lineSegments);
      }
    });

    this.xAxisGroup = group;
    this.scene.add(group);
  },
  /**
   * 大部分坐标是以0为交叉点，如果有0就需要重新设置
   * @param x
   */
  resetAxisPosition() {
    // x 轴有0，移动y轴
    if (this.position0.xAxis) {
      this.yAxisGroup.children.forEach(child => {

      });
    }

    // y 轴有0， 移动x轴
    if (this.position0.yAxis) {
      this.xAxisGroup.children.forEach(child => {

      });
    }
  },
  drawX2Axis(axisData, limit = { yTop: 0, yBottom: 0, zoom: 1 }) {
    const { width, height } = this.vDom.rect;

    const halfW = width / 2;
    const halfH = height / 2;

    if (this.yAxisGroup) {
      distoryObject(this.yAxisGroup, this.scene);
    }
    const group = new THREE.Group();
    group.userData.type = 'yaxis';
    group.position.z = 101;
    let { yTop, yBottom, zoom } = limit;
    if (yTop === 0 && yBottom === 0) {
      yBottom = width;
    }
    axisData.forEach((axis) => {
      const {
        data, position = 'left', offset = 50, top = 40, bottom = 40, type = 'value',
        minValue, maxValue
      } = axis;


      const startAxis = -halfH + bottom;
      const endAxis = halfH - top;

      const left = Math.floor(-halfW + offset);
      const rBottom = halfH - (yBottom - bottom * zoom);
      axis.startPos = rBottom;
      axis.endPos = halfH - (yTop + top * zoom);

      // 主线
      const points = [
        new THREE.Vector3(left, halfH - top, 0),
        new THREE.Vector3(left, startAxis - 10, 0),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, this.axisLineMaterial);
      line.name = 'yaxis-line';
      group.add(line);

      const leftCount = 10;
      let splitNumber = leftCount >= 10 ? 10 : leftCount;
      splitNumber *= zoom;

      const stepValue = (maxValue - minValue) / splitNumber;

      const xLen = axis.endPos - axis.startPos;

      // y轴对应的坐标点
      const ratio = Math.ceil(xLen / splitNumber);

      const tickGeometry = new THREE.BufferGeometry();
      const positions = [];

      for (let i = 0, v = minValue, start = rBottom; i < splitNumber; i++, start += ratio, v += stepValue) {
        if (start >= startAxis && start <= endAxis) {
          if (v !== 0) {
            positions.push(left, start, 0);
            positions.push(left - 10, start, 0);
          }
          const txtMesh = drawText({ txt: v.toFixed(2), x: left - 30, y: start });
          group.add(txtMesh);
        } else if (start > endAxis) {
          break;
        }
      }

      tickGeometry.attributes.position = new THREE.Float32BufferAttribute(positions, 3);
      const lineSegments = new THREE.LineSegments(tickGeometry, this.axisLineMaterial);
      group.add(lineSegments);
    });
    this.yAxisGroup = group;
    this.scene.add(group);
  },
  // 创建遮盖层，放大超过范围的不显示
  drawCover({ left = 40, right = 40, top = 30, bottom = 30 }) {
    const { width, height } = this.vDom.rect;

    const group = new THREE.Group();
    this.scene.add(group);

    const halfW = width / 2;
    const halfH = height / 2;

    {
      // 左边
      const geometry = new THREE.PlaneGeometry(left, height - 2);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const cube = new THREE.Mesh(geometry, material);

      cube.position.z = 100;
      cube.position.x = -halfW + left / 2 - 1;
      cube.position.y = 0;
      group.add(cube);
    }

    {
      // 右边
      const geometry = new THREE.PlaneGeometry(right, height - 2);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const cube = new THREE.Mesh(geometry, material);

      cube.position.z = 100;
      cube.position.x = halfW - right / 2 + 1;
      cube.position.y = 0;
      group.add(cube);
    }

    {
      // 下边
      const geometry = new THREE.PlaneGeometry(width, right - 2);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const cube = new THREE.Mesh(geometry, material);

      cube.position.z = 100;
      cube.position.x = 0;
      cube.position.y = -halfH + bottom / 2 - 10;
      group.add(cube);
    }

    {
      // 上边
      const geometry = new THREE.PlaneGeometry(width, top - 2);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const cube = new THREE.Mesh(geometry, material);

      cube.position.z = 100;
      cube.position.x = 0;
      cube.position.y = halfH - bottom / 2 + 1;
      group.add(cube);
    }
  },
  createPointMesh({ code, count, size = 10 }) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.7,
      transparent: true,
    });
    const geometry = new THREE.CircleGeometry(size);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.userData.size = size;
    this.pointMesh[code] = mesh;
    if (!this.pointGroup) {
      this.pointGroup = new THREE.Group();
      this.pointGroup.position.z = 13;
      this.pointGroup.userData.type = 'content';
    }
    this.pointGroup.add(mesh);
    this.pointScene.add(this.pointGroup);
    return mesh;
  },
  drawYAxis(axisData, limit = { yTop: 0, yBottom: 0, zoom: 1 }) {
    const { width, height } = this.vDom.rect;

    const halfW = width / 2;
    const halfH = height / 2;

    if (this.yAxisGroup) {
      distoryObject(this.yAxisGroup, this.scene);
    }
    const group = new THREE.Group();
    group.userData.type = 'yaxis';
    group.position.z = 101;

    const labelGroup = new THREE.Group();
    labelGroup.userData.type = 'yaxis-label';
    group.add(labelGroup);
    this.position0.yAxis = null;

    let { yTop, yBottom, zoom } = limit;
    if (yTop === 0 && yBottom === 0) {
      yBottom = height;
    }
    axisData.forEach((axis) => {
      const {
        data, position = 'left', offset = 50, top = 40, bottom = 40, type = 'value',
        minValue, maxValue
      } = axis;


      const startAxis = -halfH + bottom;
      const endAxis = halfH - top;

      const left = Math.floor(-halfW + offset);
      const rBottom = halfH - (yBottom - bottom * zoom);
      axis.startPos = rBottom;
      axis.endPos = halfH - (yTop + top * zoom);

      // 主线
      const points = [
        new THREE.Vector3(left, halfH - top, 0),
        new THREE.Vector3(left, startAxis - 10, 0),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, this.axisLineMaterial);
      line.name = 'yaxis-line';
      group.add(line);

      const leftCount = 10;
      let splitNumber = leftCount >= 10 ? 10 : leftCount;
      splitNumber *= zoom;

      const stepValue = (maxValue - minValue) / splitNumber;

      const xLen = axis.endPos - axis.startPos;

      // y轴对应的坐标点
      const ratio = Math.ceil(xLen / splitNumber);

      const tickGeometry = new THREE.BufferGeometry();
      const positions = [];

      for (let i = 0, v = minValue, start = rBottom; i < splitNumber; i++, start += ratio, v += stepValue) {
        if (start >= startAxis && start <= endAxis) {
          if (v !== 0) {
            positions.push(left, start, 0);
            positions.push(left - 10, start, 0);
          }
          let txt = v.toFixed(2);
          if (v == 0) {
            txt = 0;
            this.position0.yAxis = { x: left, y: start };
          }
          const txtMesh = drawText({ txt, x: left - 30, y: start });
          labelGroup.add(txtMesh);
        } else if (start > endAxis) {
          break;
        }
      }

      tickGeometry.attributes.position = new THREE.Float32BufferAttribute(positions, 3);
      const lineSegments = new THREE.LineSegments(tickGeometry, this.axisLineMaterial);
      group.add(lineSegments);
    });
    this.yAxisGroup = group;
    this.scene.add(group);
  },

  drawLegend() {

  },

  filterSeriesByX({ series, xAxisData }) {
    const currentSeries = [];
    const yAxisData = {};
    series.forEach((serie, sIndex) => {
      const {
        data, xAxisIndex = 0, yAxisIndex = 0, id
      } = serie;

      const { data: xData } = xAxisData[xAxisIndex];
      const xPos = Object.create(null);
      xData.forEach(({ name, x }) => {
        xPos[name] = x;
      });
      const currData = [];
      let dIndex = 0;
      let minValue = Number.MAX_SAFE_INTEGER;
      let maxValue = Number.MIN_SAFE_INTEGER;

      const yData = [];

      data.forEach((d, i) => {
        if (d[1] !== '' && d[1] !== undefined) {
          // 有效数据
          if (xPos[d[0]] !== undefined) {
            currData[dIndex] = d;
            dIndex++;

            if (minValue > d[1]) {
              minValue = d[1];
            }

            if (maxValue < d[1]) {
              maxValue = d[1];
            }
          }
        }
      });

      if (currData.length) {
        yAxisData[yAxisIndex] = { minValue, maxValue, data: yData };
        currentSeries.push({ ...serie, data: currData, minValue, maxValue });
      }
    });

    this.currentSeries = currentSeries;
    return yAxisData;
  },

  drawPoint({ series, startSeriesIndex = 0, yAxisData, startSeriesDataIndex = 0, xAxisData, xPoses = null }) {
    if (series.length) {
      if (this.pointGroup) {
        this.pointGroup.visible = true;
      }

      let total = 0;
      series.forEach(item => {
        total += item.data.length;
      });
      const code = 'why';
      if (this.pointMesh[code]) {
        distoryObject(this.pointMesh[code], this.pointGroup);
      }
      const mesh = this.createPointMesh({ code, count: total, size: 4 });
      mesh.userData.type = 'series';
      // mesh.userData.chartType = serie.type;
      // mesh.userData.seriesIndex = index;
      // mesh.name = serie.name || id;
      this.pointSeries = [];// 索引对应的series及数据的索引
      let dataIndex = 0;
      for (let index = startSeriesIndex, len = series.length; index < len; index++) {
        startSeriesIndex = index + 1;
        const serie = series[index];
        const { data, xAxisIndex = 0, yAxisIndex = 0, id } = serie;

        const { startPos: yStartPos, endPos: yEndPos, minValue: yMinValue, maxValue: yMaxValue } = yAxisData[yAxisIndex];
        const { startPos: xStartPos, endPos: xEndPos, type: xType, minValue: xMinValue, maxValue: xMaxValue } = xAxisData[xAxisIndex];

        let xPos;
        const isCategoryX = xType === 'category';
        if (isCategoryX) {
          if (!xPoses || !xPoses.hasOwnProperty(xAxisIndex)) {
            const { data: xData } = xAxisData[xAxisIndex];
            if (!xPoses) {
              xPoses = {};
            }
            xPoses[xAxisIndex] = {};

            xData.forEach(({ name, x }) => {
              xPoses[xAxisIndex][name] = x;
            });
          }
          xPos = xPoses[xAxisIndex];
        }

        // 最大，最小的差，根据比例计算y轴的坐标点
        const dataYGap = yMaxValue - yMinValue;
        const posYGap = yEndPos - yStartPos;
        const posYC = posYGap / 2;
        const ratioY = dataYGap === 0 ? posYGap : posYGap / dataYGap;

        const dataXGap = xMaxValue - xMinValue;
        const posXGap = xEndPos - xStartPos;
        const posXC = posXGap / 2;
        const ratioX = dataXGap === 0 ? posXGap : posXGap / dataXGap;


        const yPos = (v) => (dataYGap === 0 ? posYC : v * ratioY) + yStartPos;
        const xPosition = (v) => {
          if (isCategoryX) {
            return xPos[v];
          }
          return (dataXGap === 0 ? posXC : v * ratioX) + xStartPos;
        };


        const matrix = new THREE.Matrix4();
        // const code = id || index;
        // if (this.pointMesh[code]) {
        //   distoryObject(this.pointMesh[code], this.pointGroup);
        // }


        const color = new THREE.Color('#81ffae');
        const black = new THREE.Color('#ffffff');


        data.forEach((d, i) => {
          if (d[1] !== '' && d[1] !== undefined) {
            const x = xPosition(d[0]);
            if (x !== undefined) {
              matrix.setPosition(x, yPos(d[1]), 0);
              mesh.setMatrixAt(dataIndex, matrix);
              mesh.setColorAt(dataIndex, color);
            } else {
              mesh.setColorAt(dataIndex, black);
            }

            this.pointSeries[dataIndex] = [index, i];
            dataIndex++;
          }
        });

        serie.itemStyle = {
          color: '#81ffae',
        };

        // if (startSeriesIndex < len) {
        //   requestAnimationFrame(() => {
        //     this.render.render();
        //     this.drawPoint({series, startSeriesIndex, yAxisData, xAxisData, xPoses})
        //   });
        // }
      }
    } else {
      if (this.pointGroup) {
        this.pointGroup.visible = false;
      }
    }
  },


  showCurrentScatter() {
    if (!this.currentScatterMesh) {
      this.currentScatterMesh = null;
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.7,
        transparent: true,
      });
      const geometry = new THREE.CircleGeometry(4);
      this.currentScatterMesh = new THREE.InstancedMesh(geometry, material, 1);
      this.currentScatterMesh.userData.size = 4;
      this.currentScatterMesh.matrix4 = new THREE.Matrix4();
      this.currentScatterMesh.position.z = 100;
      this.pointScene.add(this.currentScatterMesh);
    }

    if (this.prePoint) {
      const { object, instanceId, color } = this.prePoint;
      const size = object.userData.size;
      if (this.currentScatterMesh.userData.size !== size) {
        this.currentScatterMesh.userData.size = size;
        const geometry = new THREE.CircleGeometry(size);
        this.currentScatterMesh.geometry.dispose();
        this.currentScatterMesh.geometry = geometry;
      }
      object.getMatrixAt(instanceId, this.currentScatterMesh.matrix4);

      this.currentScatterMesh.setColorAt(0, color);
      this.currentScatterMesh.setMatrixAt(0, this.currentScatterMesh.matrix4);
      this.currentScatterMesh.visible = true;
      this.currentScatterMesh.instanceColor.needsUpdate = true;
      this.currentScatterMesh.instanceMatrix.needsUpdate = true;

      return true;
    }
    this.currentScatterMesh.visible = false;
    return false;
  },
  showInfo(mouse) {
    const { pickHelper } = this.render;
    if (mouse) {
      pickHelper.pick(mouse, this.pointScene.children, this.pointCamera);
    }

    if (mouse && pickHelper.pickedObject) {
      const { instanceId } = pickHelper.pickedObject;
      const ps = this.pointSeries[instanceId];

      if (!ps) return;

      const seriesIndex = ps[0];

      const series = this.currentSeries[seriesIndex];
      if (!series) {
        return;
      }
      const object = pickHelper.pickedObject.object;
      const color = new THREE.Color();
      object.getColorAt(instanceId, color);
      color.addScalar(-0.4);
      this.prePoint = {
        object,
        color,
        instanceId
      };
      this.showCurrentScatter();
      this.render.render();

      const data = series.data[ps[1]];

      return [
        {
          seriesIndex,
          dataIndex: [instanceId],
          type: series.type,
          name: series.name,
          symbol: series.symbol || 'circle',
          color: series.itemStyle.color,
          item: data
        }
      ];
    } if (this.prePoint) {
      this.prePoint.color = null;
      this.prePoint = null;
      this.showCurrentScatter();

      this.render.render();
    }
  }
};
