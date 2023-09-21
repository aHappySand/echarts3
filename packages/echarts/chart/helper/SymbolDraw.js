/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/
import * as THREE from 'three';
import * as graphic from '../../util/graphic';
import SymbolClz from './Symbol';
import { isObject } from '../../../zrender/core/util';
import { getLabelStatesModels } from '../../label/labelStyle';

function symbolNeedsDraw(data, point, idx, opt) {
  return point && !isNaN(point[0]) && !isNaN(point[1]) &&
        !(opt.isIgnore && opt.isIgnore(idx)) &&
        // We do not set clipShape on group, because it will cut part of
        // the symbol element shape. We use the same clip shape here as
        // the line clip.
        !(opt.clipShape && !opt.clipShape.contain(point[0], point[1])) &&
        data.getItemVisual(idx, 'symbol') !== 'none';
}
function normalizeUpdateOpt(opt) {
  if (opt != null && !isObject(opt)) {
    opt = { isIgnore: opt };
  }
  return opt || {};
}


function makeSeriesScope(data) {
  var seriesModel = data.hostModel;
  var emphasisModel = seriesModel.getModel('emphasis');
  return {
    emphasisItemStyle: emphasisModel.getModel('itemStyle').getItemStyle(),
    blurItemStyle: seriesModel.getModel(['blur', 'itemStyle']).getItemStyle(),
    selectItemStyle: seriesModel.getModel(['select', 'itemStyle']).getItemStyle(),
    focus: emphasisModel.get('focus'),
    blurScope: emphasisModel.get('blurScope'),
    emphasisDisabled: emphasisModel.get('disabled'),
    hoverScale: emphasisModel.get('scale'),
    labelStatesModels: getLabelStatesModels(seriesModel),
    cursorStyle: seriesModel.get('cursor')
  };
}
const SymbolDraw = /** @class */ (function () {
  function SymbolDraw(SymbolCtor) {
    this.group = new graphic.Group3D();
    this.meshs = {};
    this._SymbolCtor = SymbolCtor || SymbolClz;
  }
  SymbolDraw.prototype.setCaller = function (caller) {
    this.caller = caller;
  };
  SymbolDraw.prototype.createPointMesh = function ({ symbolType, count, seriesIndex = 0 }) {
    const typeId = `${symbolType}`;
    if (this.meshs[typeId]) return this.meshs[typeId];

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.7,
      transparent: true,
    });
    const geometry = new THREE.CircleGeometry(2);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.userData.seriesIndex = seriesIndex;
    mesh.userData.type = 'chart';
    mesh.userData.uid = this.caller.uid;
    mesh.userData.symbolType = symbolType;
    this.meshs[typeId] = mesh;
    const matrix = new THREE.Matrix4();
    matrix.setPosition(-2000, -2000, 0);

    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrix);
    }
    this.group.add(mesh);
    return mesh;
  };
  /**
     * Update symbols draw by new data
     */
  SymbolDraw.prototype.updateData = function (data, opt) {
    if (!this.caller) throw new Error('请设置caller');

    // Remove progressive els.
    this._progressiveEls = null;
    opt = normalizeUpdateOpt(opt);
    var group = this.group;
    var seriesModel = data.hostModel;

    this.ecModel = seriesModel.ecModel;
    var oldData = this._data;
    var SymbolCtor = this._SymbolCtor;
    var disableAnimation = opt.disableAnimation;
    var seriesScope = makeSeriesScope(data);
    var symbolUpdateOpt = { disableAnimation };
    var getSymbolPoint = opt.getSymbolPoint || function (idx) {
      return data.getItemLayout(idx);
    };
    // There is no oldLineData only when first rendering or switching from
    // stream mode to normal mode, where previous elements should be removed.
    // if (!oldData) {
    group.removeAll();
    // }

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color('#81ffae');

    const count = data._store._count;

    const seriesIndex = seriesModel.seriesIndex;

    data.diff(oldData)
      .add((newIdx) => {
        var point = getSymbolPoint(newIdx);
        if (symbolNeedsDraw(data, point, newIdx, opt)) {
          var symbolEl = new SymbolCtor(data, newIdx, seriesScope, symbolUpdateOpt);

          const mesh = this.createPointMesh({ symbolType: symbolEl._symbolType, count, seriesIndex });

          symbolEl.setPosition(point);
          data.setItemGraphicEl(newIdx, symbolEl);
          const newPos = symbolEl.toCenterCoord();

          const matrix = graphic.updateMatrix(newPos[0], newPos[1], 0, symbolEl._sizeX, symbolEl._sizeY, 1);

          mesh.setMatrixAt(newIdx, matrix);
          mesh.setColorAt(newIdx, new THREE.Color(symbolEl.getColor()));
        } else {
          var symbolType = data.getItemVisual(newIdx, 'symbol') || 'circle';
          const mesh = this.createPointMesh({ symbolType, count, seriesIndex });
          mesh.setMatrixAt(newIdx, graphic.emptyMatrix);
        }
      })
      .update((newIdx, oldIdx) => {
        return;
        var symbolEl = oldData.getItemGraphicEl(oldIdx);
        var point = getSymbolPoint(newIdx);
        if (!symbolNeedsDraw(data, point, newIdx, opt)) {
          matrix.setPosition(-2000, -2000, 0);
          mesh.setMatrixAt(newIdx, matrix);
          return;
        }
        var newSymbolType = data.getItemVisual(newIdx, 'symbol') || 'circle';
        var oldSymbolType = symbolEl &&
                symbolEl.getSymbolType &&
                symbolEl.getSymbolType();
        if (!symbolEl ||
                // Create a new if symbol type changed.
                (oldSymbolType && oldSymbolType !== newSymbolType)) {
          symbolEl = new SymbolCtor(data, newIdx, seriesScope, symbolUpdateOpt);
          symbolEl.setPosition(point);
        } else {
          symbolEl.updateData(data, newIdx, seriesScope, symbolUpdateOpt);
          var target = {
            x: point[0],
            y: point[1]
          };
          symbolEl.attr(target);
        }
        // Add back
        const newPos = symbolEl.toCenterCoord();
        matrix.setPosition(newPos[0], newPos[1], 0);
        mesh.setMatrixAt(newIdx, matrix);
        mesh.setColorAt(newIdx, color);
        data.setItemGraphicEl(newIdx, symbolEl);
      })
      .execute();
    this._getSymbolPoint = getSymbolPoint;
    this._data = data;
  };

  SymbolDraw.prototype.updateLayout = function () {
    var _this = this;
    var data = this._data;
    if (data) {
      // Not use animation
      data.eachItemGraphicEl((el, idx) => {
        var point = _this._getSymbolPoint(idx);
        el.setPosition(point);
        // TODO:: update
        // el.markRedraw();
      });
    }
  };

  SymbolDraw.prototype.incrementalPrepareUpdate = function (data) {
    this._seriesScope = makeSeriesScope(data);
    this._data = null;
    this.group.removeAll();
  };

  /**
     * Update symbols draw by new data
     */
  SymbolDraw.prototype.incrementalUpdate = function (taskParams, data, opt) {
    // Clear
    this._progressiveEls = [];
    opt = normalizeUpdateOpt(opt);
    function updateIncrementalAndHover(el) {
      if (!el.isGroup) {
        el.incremental = true;
        el.ensureState('emphasis').hoverLayer = true;
      }
    }

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color('#81ffae');
    const count = data._store._count;
    const seriesIndex = data.hostModel.seriesIndex;

    for (let idx = taskParams.start; idx < taskParams.end; idx++) {
      var point = data.getItemLayout(idx);
      if (symbolNeedsDraw(data, point, idx, opt)) {
        var el = new this._SymbolCtor(data, idx, this._seriesScope);

        const mesh = this.createPointMesh({ symbolType: el._symbolType, count, seriesIndex });

        el.traverse(updateIncrementalAndHover);
        el.setPosition(point);
        // this.group.add(el);
        const newPos = el.toCenterCoord();

        const matrix = graphic.updateMatrix(newPos[0], newPos[1], 0, el._sizeX, el._sizeY, 1);

        mesh.setMatrixAt(idx, matrix);
        mesh.setColorAt(idx, new THREE.Color(el.getColor()));

        data.setItemGraphicEl(idx, el);
        this._progressiveEls.push(el);

        mesh.instanceColor.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

  };

  SymbolDraw.prototype.eachRendered = function (cb) {
    // graphic.traverseElements(this._progressiveEls || this.group, cb);
  };
  SymbolDraw.prototype.remove = function (enableAnimation) {
    var group = this.group;
    var data = this._data;
    // Incremental model do not have this._data.
    if (data && enableAnimation) {
      data.eachItemGraphicEl((el) => {
        el.fadeOut(() => {
          group.remove(el);
        }, data.hostModel);
      });
    } else {
      group.removeAll();
    }
  };

  return SymbolDraw;
}());
export default SymbolDraw;
