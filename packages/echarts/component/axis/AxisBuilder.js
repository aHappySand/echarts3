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
import { retrieve, defaults, extend, each, isObject, map, isFunction } from '../../../zrender/core/util';
import * as matrixUtil from '../../../zrender/core/matrix';
import { applyTransform as v2ApplyTransform } from '../../../zrender/core/vector';
import * as graphic from '../../util/graphic';
import { getECData } from '../../util/innerStore';
import { createTextStyle } from '../../label/labelStyle';
import Model from '../../model/Model';
import { isRadianAroundZero, remRadian } from '../../util/number';
import { shouldShowAllLabels } from '../../coord/axisHelper';
import { prepareLayoutList, hideOverlap } from '../../label/labelLayoutHelper';

const PI = Math.PI;
/**
 * A final axis is translated and rotated from a "standard axis".
 * So opt.position and opt.rotation is required.
 *
 * A standard axis is and axis from [0, 0] to [0, axisExtent[1]],
 * for example: (0, 0) ------------> (0, 50)
 *
 * nameDirection or tickDirection or labelDirection is 1 means tick
 * or label is below the standard axis, whereas is -1 means above
 * the standard axis. labelOffset means offset between label and axis,
 * which is useful when 'onZero', where axisLabel is in the grid and
 * label in outside grid.
 *
 * Tips: like always,
 * positive rotation represents anticlockwise, and negative rotation
 * represents clockwise.
 * The direction of position coordinate is the same as the direction
 * of screen coordinate.
 *
 * Do not need to consider axis 'inverse', which is auto processed by
 * axis extent.
 */
const AxisBuilder = /** @class */ (function () {
  function AxisBuilder(axisModel, opt) {
    this.group = new graphic.Group3D();
    this.opt = opt;
    this.axisModel = axisModel;
    // Default value
    defaults(opt, {
      labelOffset: 0,
      nameDirection: 1,
      tickDirection: 1,
      labelDirection: 1,
      silent: true,
      handleAutoShown() { return true; }
    });


    this._transform1Group = new graphic.ZRGroup({
      ecModel: axisModel.ecModel,
    });

    // FIXME Not use a separate text group?
    var transformGroup = new graphic.ZRGroup({
      ecModel: axisModel.ecModel,
      x: opt.position[0],
      y: opt.position[1],
      rotation: opt.rotation
    });
    transformGroup.updateTransform();
    this._transform2Group = transformGroup;

    this.reset();
  }
  AxisBuilder.prototype.hasBuilder = function (name) {
    return !!builders[name];
  };

  AxisBuilder.prototype.reset = function () {
    this.group.removeAll();
    this._transform1Group.removeAll();
    this.axisLineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color('#3d3d3d'),
      fog: false,
    });
    this.axisLineGeometry = new THREE.BufferGeometry();

    this.axisLinePosition = [];

    this.axisLineSegments = new THREE.LineSegments(this.axisLineGeometry, this.axisLineMaterial);
    this.group.add(this.axisLineSegments);
  };

  AxisBuilder.prototype.add = function (name) {
    const oldLen = this.axisLinePosition.length;
    const shapes = builders[name](this.opt, this.axisModel, this._transform1Group, this._transform2Group);
    shapes.forEach(shape => {
      const r = shape.draw(this.axisLinePosition);
      if (r && shape.type === 'Text') {
        this.group.add(r);
      }
    });
    if (oldLen !== this.axisLinePosition.length) {
      const tickGeometry = this.axisLineSegments.geometry;
      tickGeometry.attributes.position = new THREE.Float32BufferAttribute(this.axisLinePosition, 3);
      tickGeometry.attributes.position.needsUpdate = true;
    }
  };
  AxisBuilder.prototype.getGroup = function () {
    return this.group;
  };
  AxisBuilder.innerTextLayout = function (axisRotation, textRotation, direction) {
    var rotationDiff = remRadian(textRotation - axisRotation);
    var textAlign;
    var textVerticalAlign;
    if (isRadianAroundZero(rotationDiff)) { // Label is parallel with axis line.
      textVerticalAlign = direction > 0 ? 'top' : 'bottom';
      textAlign = 'center';
    } else if (isRadianAroundZero(rotationDiff - PI)) { // Label is inverse parallel with axis line.
      textVerticalAlign = direction > 0 ? 'bottom' : 'top';
      textAlign = 'center';
    } else {
      textVerticalAlign = 'middle';
      if (rotationDiff > 0 && rotationDiff < PI) {
        textAlign = direction > 0 ? 'right' : 'left';
      } else {
        textAlign = direction > 0 ? 'left' : 'right';
      }
    }
    return {
      rotation: rotationDiff,
      textAlign,
      textVerticalAlign
    };
  };
  AxisBuilder.makeAxisEventDataBase = function (axisModel) {
    var eventData = {
      componentType: axisModel.mainType,
      componentIndex: axisModel.componentIndex
    };
    eventData[`${axisModel.mainType}Index`] = axisModel.componentIndex;
    return eventData;
  };
  AxisBuilder.isLabelSilent = function (axisModel) {
    var tooltipOpt = axisModel.get('tooltip');
    return axisModel.get('silent') ||
            // Consider mouse cursor, add these restrictions.
            !(axisModel.get('triggerEvent') || (tooltipOpt && tooltipOpt.show));
  };
  return AxisBuilder;
}());

const builders = {
  axisLine(opt, axisModel, group, transformGroup) {
    var shown = axisModel.get(['axisLine', 'show']);
    if (shown === 'auto' && opt.handleAutoShown) {
      shown = opt.handleAutoShown('axisLine');
    }
    if (!shown) {
      return [];
    }
    var extent = axisModel.axis.getExtent();
    var matrix = transformGroup.transform;
    var pt1 = [extent[0], 0];
    var pt2 = [extent[1], 0];

    // var inverse = pt1[0] > pt2[0];
    if (matrix) {
      v2ApplyTransform(pt1, pt1, matrix);
      v2ApplyTransform(pt2, pt2, matrix);
    }
    var lineStyle = extend({
      lineCap: 'round'
    }, axisModel.getModel(['axisLine', 'lineStyle']).getLineStyle());
    var line = new graphic.ZRLine({
      ecModel: axisModel.ecModel,
      shape: {
        x1: pt1[0],
        y1: pt1[1],
        x2: pt2[0],
        y2: pt2[1]
      },
      style: lineStyle,
      strokeContainThreshold: opt.strokeContainThreshold || 5,
      silent: true,
      z2: 1
    });
    graphic.subPixelOptimizeLine(line.shape, line.style.lineWidth);
    line.anid = 'line';

    return [line];
    // TODO:: 增加箭头
    // group.add(line);
    // var arrows = axisModel.get(['axisLine', 'symbol']);
    // if (arrows != null) {
    //   var arrowSize = axisModel.get(['axisLine', 'symbolSize']);
    //   if (isString(arrows)) {
    //     // Use the same arrow for start and end point
    //     arrows = [arrows, arrows];
    //   }
    //   if (isString(arrowSize) || isNumber(arrowSize)) {
    //     // Use the same size for width and height
    //     arrowSize = [arrowSize, arrowSize];
    //   }
    //   var arrowOffset = normalizeSymbolOffset(axisModel.get(['axisLine', 'symbolOffset']) || 0, arrowSize);
    //   var symbolWidth_1 = arrowSize[0];
    //   var symbolHeight_1 = arrowSize[1];
    //   each([{
    //     rotate: opt.rotation + Math.PI / 2,
    //     offset: arrowOffset[0],
    //     r: 0
    //   }, {
    //     rotate: opt.rotation - Math.PI / 2,
    //     offset: arrowOffset[1],
    //     r: Math.sqrt((pt1[0] - pt2[0]) * (pt1[0] - pt2[0]) +
    //                     (pt1[1] - pt2[1]) * (pt1[1] - pt2[1]))
    //   }], (point, index) => {
    //     if (arrows[index] !== 'none' && arrows[index] != null) {
    //       var symbol = createSymbol(arrows[index], -symbolWidth_1 / 2, -symbolHeight_1 / 2, symbolWidth_1, symbolHeight_1, lineStyle.stroke, true);
    //       // Calculate arrow position with offset
    //       var r = point.r + point.offset;
    //       var pt = inverse ? pt2 : pt1;
    //       symbol.attr({
    //         rotation: point.rotate,
    //         x: pt[0] + r * Math.cos(opt.rotation),
    //         y: pt[1] - r * Math.sin(opt.rotation),
    //         silent: true,
    //         z2: 11
    //       });
    //       group.add(symbol);
    //     }
    //   });
    // }
  },
  axisTickLabel(opt, axisModel, group, transformGroup) {
    const ticksEls = buildAxisMajorTicks(group, transformGroup, axisModel, opt);
    const labelEls = buildAxisLabel(group, transformGroup, axisModel, opt);
    fixMinMaxLabelShow(axisModel, labelEls, ticksEls);
    const minorTicks = buildAxisMinorTicks(group, transformGroup, axisModel, opt.tickDirection);

    // This bit fixes the label overlap issue for the time chart.
    // See https://github.com/apache/echarts/issues/14266 for more.
    if (axisModel.get(['axisLabel', 'hideOverlap'])) {
      var labelList = prepareLayoutList(map(labelEls, (label) => ({
        label,
        priority: label.z2,
        defaultAttr: {
          ignore: label.ignore
        }
      })));
      hideOverlap(labelList);
    }

    return [...ticksEls, ...labelEls, ...minorTicks];
  },
  // eslint-disable-next-line no-unused-vars
  axisName(opt, axisModel, group, transformGroup) {
    var name = retrieve(opt.axisName, axisModel.get('name'));
    if (!name) {
      return [];
    }
    var nameLocation = axisModel.get('nameLocation');
    var nameDirection = opt.nameDirection;
    var textStyleModel = axisModel.getModel('nameTextStyle');
    var gap = axisModel.get('nameGap') || 0;
    var extent = axisModel.axis.getExtent();
    var gapSignal = extent[0] > extent[1] ? -1 : 1;
    var pos = [
      nameLocation === 'start'
        ? extent[0] - gapSignal * gap
        : nameLocation === 'end'
          ? extent[1] + gapSignal * gap
          : (extent[0] + extent[1]) / 2,
      // Reuse labelOffset.
      isNameLocationCenter(nameLocation) ? opt.labelOffset + nameDirection * gap : 0
    ];
    var labelLayout;
    var nameRotation = axisModel.get('nameRotate');
    if (nameRotation != null) {
      nameRotation = nameRotation * PI / 180; // To radian.
    }
    var axisNameAvailableWidth;
    if (isNameLocationCenter(nameLocation)) {
      labelLayout = AxisBuilder.innerTextLayout(opt.rotation, nameRotation != null ? nameRotation : opt.rotation, // Adapt to axis.
        nameDirection);
    } else {
      labelLayout = endTextLayout(opt.rotation, nameLocation, nameRotation || 0, extent);
      axisNameAvailableWidth = opt.axisNameAvailableWidth;
      if (axisNameAvailableWidth != null) {
        axisNameAvailableWidth = Math.abs(axisNameAvailableWidth / Math.sin(labelLayout.rotation));
        !isFinite(axisNameAvailableWidth) && (axisNameAvailableWidth = null);
      }
    }
    var textFont = textStyleModel.getFont();
    var truncateOpt = axisModel.get('nameTruncate', true) || {};
    var ellipsis = truncateOpt.ellipsis;
    var maxWidth = retrieve(opt.nameTruncateMaxWidth, truncateOpt.maxWidth, axisNameAvailableWidth);
    var textEl = new graphic.ZRText({
      ecModel: axisModel.ecModel,
      x: pos[0],
      y: pos[1],
      rotation: labelLayout.rotation,
      silent: AxisBuilder.isLabelSilent(axisModel),
      style: createTextStyle(textStyleModel, {
        text: name,
        font: textFont,
        overflow: 'truncate',
        width: maxWidth,
        ellipsis,
        fill: textStyleModel.getTextColor() ||
                    axisModel.get(['axisLine', 'lineStyle', 'color']),
        align: textStyleModel.get('align') ||
                    labelLayout.textAlign,
        verticalAlign: textStyleModel.get('verticalAlign') ||
                    labelLayout.textVerticalAlign
      }),
      z2: 1
    });
    graphic.setTooltipConfig({
      el: textEl,
      componentModel: axisModel,
      itemName: name
    });
    textEl.__fullText = name;
    // Id for animation
    textEl.anid = 'name';
    if (axisModel.get('triggerEvent')) {
      var eventData = AxisBuilder.makeAxisEventDataBase(axisModel);
      eventData.targetType = 'axisName';
      eventData.name = name;
      getECData(textEl).eventData = eventData;
    }
    // FIXME
    transformGroup.add(textEl);
    textEl.updateTransform();
    group.add(textEl);
    textEl.decomposeTransform();

    return [textEl];
  }
};
function endTextLayout(rotation, textPosition, textRotate, extent) {
  var rotationDiff = remRadian(textRotate - rotation);
  var textAlign;
  var textVerticalAlign;
  var inverse = extent[0] > extent[1];
  var onLeft = (textPosition === 'start' && !inverse) ||
        (textPosition !== 'start' && inverse);
  if (isRadianAroundZero(rotationDiff - PI / 2)) {
    textVerticalAlign = onLeft ? 'bottom' : 'top';
    textAlign = 'center';
  } else if (isRadianAroundZero(rotationDiff - PI * 1.5)) {
    textVerticalAlign = onLeft ? 'top' : 'bottom';
    textAlign = 'center';
  } else {
    textVerticalAlign = 'middle';
    if (rotationDiff < PI * 1.5 && rotationDiff > PI / 2) {
      textAlign = onLeft ? 'left' : 'right';
    } else {
      textAlign = onLeft ? 'right' : 'left';
    }
  }
  return {
    rotation: rotationDiff,
    textAlign,
    textVerticalAlign
  };
}
function fixMinMaxLabelShow(axisModel, labelEls, tickEls) {
  if (shouldShowAllLabels(axisModel.axis)) {
    return;
  }
  // If min or max are user set, we need to check
  // If the tick on min(max) are overlap on their neighbour tick
  // If they are overlapped, we need to hide the min(max) tick label
  var showMinLabel = axisModel.get(['axisLabel', 'showMinLabel']);
  var showMaxLabel = axisModel.get(['axisLabel', 'showMaxLabel']);
  // FIXME
  // Have not consider onBand yet, where tick els is more than label els.
  labelEls = labelEls || [];
  tickEls = tickEls || [];
  var firstLabel = labelEls[0];
  var nextLabel = labelEls[1];
  var lastLabel = labelEls[labelEls.length - 1];
  var prevLabel = labelEls[labelEls.length - 2];
  var firstTick = tickEls[0];
  var nextTick = tickEls[1];
  var lastTick = tickEls[tickEls.length - 1];
  var prevTick = tickEls[tickEls.length - 2];
  if (showMinLabel === false) {
    ignoreEl(firstLabel);
    ignoreEl(firstTick);
  } else if (isTwoLabelOverlapped(firstLabel, nextLabel)) {
    if (showMinLabel) {
      ignoreEl(nextLabel);
      ignoreEl(nextTick);
    } else {
      ignoreEl(firstLabel);
      ignoreEl(firstTick);
    }
  }
  if (showMaxLabel === false) {
    ignoreEl(lastLabel);
    ignoreEl(lastTick);
  } else if (isTwoLabelOverlapped(prevLabel, lastLabel)) {
    if (showMaxLabel) {
      ignoreEl(prevLabel);
      ignoreEl(prevTick);
    } else {
      ignoreEl(lastLabel);
      ignoreEl(lastTick);
    }
  }
}
function ignoreEl(el) {
  el && (el.ignore = true);
}
function isTwoLabelOverlapped(current, next) {
  // current and next has the same rotation.
  var firstRect = current && current.getBoundingRect().clone();
  var nextRect = next && next.getBoundingRect().clone();
  if (!firstRect || !nextRect) {
    return;
  }
  // When checking intersect of two rotated labels, we use mRotationBack
  // to avoid that boundingRect is enlarge when using `boundingRect.applyTransform`.
  var mRotationBack = matrixUtil.identity([]);
  matrixUtil.rotate(mRotationBack, mRotationBack, -current.rotation);
  firstRect.applyTransform(matrixUtil.mul([], mRotationBack, current.getLocalTransform()));
  nextRect.applyTransform(matrixUtil.mul([], mRotationBack, next.getLocalTransform()));
  return firstRect.intersect(nextRect);
}
function isNameLocationCenter(nameLocation) {
  return nameLocation === 'middle' || nameLocation === 'center';
}
function createTicks({ ticksCoords, tickTransform, tickEndCoord, tickLineStyle, anidPrefix, axisModel }) {
  var tickEls = [];
  var pt1 = [];
  var pt2 = [];
  for (let i = 0; i < ticksCoords.length; i++) {
    var tickCoord = ticksCoords[i].coord;
    pt1[0] = tickCoord;
    pt1[1] = 0;
    pt2[0] = tickCoord;
    pt2[1] = tickEndCoord;
    if (tickTransform) {
      v2ApplyTransform(pt1, pt1, tickTransform);
      v2ApplyTransform(pt2, pt2, tickTransform);
    }
    // Tick line, Not use group transform to have better line draw
    var tickEl = new graphic.ZRLine({
      ecModel: axisModel.ecModel,
      shape: {
        x1: pt1[0],
        y1: pt1[1],
        x2: pt2[0],
        y2: pt2[1]
      },
      style: tickLineStyle,
      z2: 2,
      autoBatch: true,
      silent: true
    });

    graphic.subPixelOptimizeLine(tickEl.shape, tickEl.style.lineWidth);
    tickEl.anid = `${anidPrefix}_${ticksCoords[i].tickValue}`;
    tickEls.push(tickEl);
  }
  return tickEls;
}
function buildAxisMajorTicks(group, transformGroup, axisModel, opt) {
  var axis = axisModel.axis;
  var tickModel = axisModel.getModel('axisTick');
  var shown = tickModel.get('show');
  if (shown === 'auto' && opt.handleAutoShown) {
    shown = opt.handleAutoShown('axisTick');
  }
  if (!shown || axis.scale.isBlank()) {
    return;
  }
  var lineStyleModel = tickModel.getModel('lineStyle');
  var tickEndCoord = opt.tickDirection * tickModel.get('length');
  var ticksCoords = axis.getTicksCoords();

  var ticksEls = createTicks({ ticksCoords,
    tickTransform: transformGroup.transform,
    tickEndCoord,
    tickLineStyle: defaults(lineStyleModel.getLineStyle(), {
      stroke: axisModel.get(['axisLine', 'lineStyle', 'color'])
    }),
    anidPrefix: 'ticks',
    axisModel });
  // for (let i = 0; i < ticksEls.length; i++) {
  //   group.add(ticksEls[i]);
  // }
  return ticksEls;
}
function buildAxisMinorTicks(group, transformGroup, axisModel, tickDirection) {
  var axis = axisModel.axis;
  var minorTickModel = axisModel.getModel('minorTick');
  if (!minorTickModel.get('show') || axis.scale.isBlank()) {
    return [];
  }
  var minorTicksCoords = axis.getMinorTicksCoords();
  if (!minorTicksCoords.length) {
    return [];
  }
  var lineStyleModel = minorTickModel.getModel('lineStyle');
  var tickEndCoord = tickDirection * minorTickModel.get('length');
  var minorTickLineStyle = defaults(lineStyleModel.getLineStyle(), defaults(axisModel.getModel('axisTick').getLineStyle(), {
    stroke: axisModel.get(['axisLine', 'lineStyle', 'color'])
  }));
  let minorTicks = [];
  for (let i = 0; i < minorTicksCoords.length; i++) {
    const minorTicksEls = createTicks({
      ticksCoords: minorTicksCoords[i],
      tickTransform: transformGroup.transform,
      tickEndCoord,
      tickLineStyle: minorTickLineStyle,
      anidPrefix: `minorticks_${i}`,
      axisModel });

    minorTicks = [...minorTicks, ...minorTicksEls];
  }
  return minorTicks;
}
function buildAxisLabel(group, transformGroup, axisModel, opt) {
  var axis = axisModel.axis;
  var show = retrieve(opt.axisLabelShow, axisModel.get(['axisLabel', 'show']));
  if (!show || axis.scale.isBlank()) {
    return;
  }
  var labelModel = axisModel.getModel('axisLabel');
  var labelMargin = labelModel.get('margin');
  var labels = axis.getViewLabels();
  // Special label rotate.
  var labelRotation = (retrieve(opt.labelRotate, labelModel.get('rotate')) || 0) * PI / 180;
  var labelLayout = AxisBuilder.innerTextLayout(opt.rotation, labelRotation, opt.labelDirection);
  var rawCategoryData = axisModel.getCategories && axisModel.getCategories(true);
  var labelEls = [];
  var silent = AxisBuilder.isLabelSilent(axisModel);
  var triggerEvent = axisModel.get('triggerEvent');
  each(labels, (labelItem, index) => {
    var tickValue = axis.scale.type === 'ordinal'
      ? axis.scale.getRawOrdinalNumber(labelItem.tickValue)
      : labelItem.tickValue;
    var formattedLabel = labelItem.formattedLabel;
    var rawLabel = labelItem.rawLabel;
    var itemLabelModel = labelModel;
    if (rawCategoryData && rawCategoryData[tickValue]) {
      var rawCategoryItem = rawCategoryData[tickValue];
      if (isObject(rawCategoryItem) && rawCategoryItem.textStyle) {
        itemLabelModel = new Model(rawCategoryItem.textStyle, labelModel, axisModel.ecModel);
      }
    }
    var textColor = itemLabelModel.getTextColor() ||
            axisModel.get(['axisLine', 'lineStyle', 'color']);
    var tickCoord = axis.dataToCoord(tickValue);
    var textEl = new graphic.ZRText({
      ecModel: axisModel.ecModel,
      axisModel,
      x: tickCoord,
      y: opt.labelOffset + opt.labelDirection * labelMargin,
      rotation: labelLayout.rotation,
      silent,
      z2: 10 + (labelItem.level || 0),
      style: createTextStyle(itemLabelModel, {
        text: formattedLabel,
        align: itemLabelModel.getShallow('align', true) ||
          labelLayout.textAlign,
        verticalAlign: itemLabelModel.getShallow('verticalAlign', true) ||
          itemLabelModel.getShallow('baseline', true) ||
          labelLayout.textVerticalAlign,
        fill: isFunction(textColor)
          ? textColor(
            // (1) In category axis with data zoom, tick is not the original
            // index of axis.data. So tick should not be exposed to user
            // in category axis.
            // (2) Compatible with previous version, which always use formatted label as
            // input. But in interval scale the formatted label is like '223,445', which
            // maked user replace ','. So we modify it to return original val but remain
            // it as 'string' to avoid error in replacing.
            axis.type === 'category'
              ? rawLabel
              : axis.type === 'value'
                ? `${tickValue}`
                : tickValue, index
          )
          : textColor
      })
    });
    textEl.anid = `label_${tickValue}`;
    // Pack data for mouse event
    if (triggerEvent) {
      var eventData = AxisBuilder.makeAxisEventDataBase(axisModel);
      eventData.targetType = 'axisLabel';
      eventData.value = rawLabel;
      eventData.tickIndex = index;
      if (axis.type === 'category') {
        eventData.dataIndex = tickValue;
      }
      getECData(textEl).eventData = eventData;
    }
    // FIXME
    transformGroup.add(textEl);

    textEl.updateTransform();
    labelEls.push(textEl);
    group.add(textEl);
    textEl.decomposeTransform();
  });
  return labelEls;
}
export default AxisBuilder;
