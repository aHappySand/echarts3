import * as THREE from 'three';
import { OrbitControls } from '../../../src/plugins/OrbitControls2.js';

/**
 * @param dom {Element}
 * @param render { RenderManager }
 * @param option {  }
 * @param virtualDiameter {number}
 * @constructor
 */
export function SceneManager({ chart, virtualDiameter = 1000 }) {
  this.vDom = chart._dom;
  this.virtualDiameter = virtualDiameter;
  this.render = chart.renderer;
  this.componentScene = new THREE.Scene();
  this.chartScene = new THREE.Scene();
  this.mesh = Object.create(null);
  this.addCamera();
}

SceneManager.prototype = {
  addCamera() {
    const virtualDiameter = this.virtualDiameter;
    const { rect: { width, height } } = this.vDom;
    const halfW = width / 2;
    const halfH = height / 2;

    this.componentCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, virtualDiameter);
    // this.camera = new THREE.PerspectiveCamera( 50, 1, 1, 1000 );
    this.componentCamera.position.z = virtualDiameter;

    this.chartCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, virtualDiameter);
    this.chartCamera.position.z = virtualDiameter;

    // this.handleTransform({k: 0.36, x: 0, y: 0});
    this.controls = new OrbitControls(this.chartCamera, this.vDom);
    this.controls.enableRotate = false; // 禁止旋转
    this.controls.translateType = 'xy';
    this.controls.isRightBtnMove = false;
    this.controls.minZoom = 1;

    this.controls.addEventListener('start', (e) => {
      this.checkOrbitControls(e.target);
    });

    this.controls.addEventListener('change', (e) => {
      console.log(e);

      // let rk = 1 / e.target.object.zoom;
      // rk = rk < 0.2 ? 0.2 : rk;
      // this.pointGroup.children.forEach(mesh => {
      //   const size = mesh.userData.size;
      //   const newGeometry = new THREE.CircleGeometry(size * rk);
      //   mesh.geometry.dispose();
      //   mesh.geometry = newGeometry;
      // });
      // this.checkOrbitControls(e.target);

      this.render.render();
    });
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
    this.componentCamera.left = -halfW;
    this.componentCamera.right = halfW;

    this.componentCamera.bottom = -halfH;
    this.componentCamera.top = halfH;

    this.componentCamera.updateProjectionMatrix();
  },
  handleTransform(transform) {
    console.log(transform);
  },
  allRender() {
    this.render.render();
  },
  reRender() {
    this.render.renderer.render(this.componentScene, this.chartCamera);
  },
  init() {

  },
  // 获取坐标轴的世界坐标系
  getXAxisWorld() {
    const leftV = new THREE.Vector3(-1, 0, 0);
    this.axisWorldLeft = leftV.unproject(this.componentCamera);

    const rightV = new THREE.Vector3(1, 0, 0);
    this.axisWorldRight = rightV.unproject(this.componentCamera);
  },
  parseXPosition(x) {
    const { width } = this.vDom.rect;
    const halfWidth = width / 2;
    const leftV = new THREE.Vector3(x / halfWidth - 1, 0, 0);
    const nLeftV = leftV.unproject(this.componentCamera).project(this.chartCamera);
    return nLeftV.x * halfWidth;
  },
  // 获取坐标轴的世界坐标系
  getYAxisWorld() {
    const topV = new THREE.Vector3(0, 1, 0);
    this.axisWorldTop = topV.unproject(this.componentCamera);

    const bottomV = new THREE.Vector3(0, -1, 0);
    this.axisWorldBottom = bottomV.unproject(this.componentCamera);
  },
  parseYPosition(y) {
    const { height } = this.vDom.rect;
    const halfHeight = height / 2;
    const topV = new THREE.Vector3(0, 1 - y / halfHeight, 0);
    const nTopV = topV.unproject(this.componentCamera).project(this.chartCamera);
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
    const nLeftV = this.axisWorldLeft.project(this.chartCamera);
    const xLeft = (nLeftV.x + 1) * halfWidth;

    // if (xLeft > 0 && orbit.xDirection >= 0) {
    //   orbit.stopPan = true;
    //   return;
    // }

    const nRightV = this.axisWorldRight.project(this.chartCamera);
    const xRight = (nRightV.x + 1) * halfWidth;

    // if (xRight < width && orbit.xDirection <= 0) {
    //   orbit.stopPan = true;
    //   return;
    // }

    const nTopV = this.axisWorldTop.project(this.chartCamera);
    const yTop = (1 - nTopV.y) * halfHeight;

    const nBottomV = this.axisWorldBottom.project(this.chartCamera);
    const yBottom = (1 - nBottomV.y) * halfHeight;

    const newPos = { xLeft, xRight, yTop, yBottom, zoom };

    console.log('newPos------', newPos);
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
  // 创建遮盖层，放大超过范围的不显示
  drawCover({ left = 40, right = 40, top = 30, bottom = 30 }) {
    const { width, height } = this.vDom.rect;

    const group = new THREE.Group();
    this.componentScene.add(group);

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
    this.mesh[code] = mesh;
    if (!this.pointGroup) {
      this.pointGroup = new THREE.Group();
      this.pointGroup.position.z = 13;
      this.pointGroup.userData.type = 'content';
    }
    this.pointGroup.add(mesh);
    this.chartScene.add(this.pointGroup);
    return mesh;
  },
  getPickedObject(mouse) {
    const { pickHelper } = this.render;
    if (mouse) {
      pickHelper.pick(mouse, this.chartScene.children, this.chartCamera);
    }

    if (mouse && pickHelper.pickedObject) {
      return pickHelper.pickedObject;
    }
  },
  showInfo(mouse) {
    const { pickHelper } = this.render;
    if (mouse) {
      pickHelper.pick(mouse, this.chartScene.children, this.chartCamera);
    }

    if (mouse && pickHelper.pickedObject) {
      const { instanceId } = pickHelper.pickedObject;
    //   const ps = this.pointSeries[instanceId];
    //
    //   if (!ps) return;
    //
    //   const seriesIndex = ps[0];
    //
    //   const series = this.currentSeries[seriesIndex];
    //   if (!series) {
    //     return;
    //   }
    //   const object = pickHelper.pickedObject.object;
    //   const color = new THREE.Color();
    //   object.getColorAt(instanceId, color);
    //   color.addScalar(-0.4);
    //   this.prePoint = {
    //     object,
    //     color,
    //     instanceId
    //   };
    //   this.render.render();
    //
    //   const data = series.data[ps[1]];
    //
    //   return [
    //     {
    //       seriesIndex,
    //       dataIndex: [instanceId],
    //       type: series.type,
    //       name: series.name,
    //       symbol: series.symbol || 'circle',
    //       color: series.itemStyle.color,
    //       item: data
    //     }
    //   ];
    // } if (this.prePoint) {
    //   this.prePoint.color = null;
    //   this.prePoint = null;
    //
    //   this.render.render();
    }
  }
};
