import { __extends } from 'tslib';
import { SceneManager } from '../../src/utils/chart.scene';
import { throttle } from '../util/throttle';

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
import {
  assert,
  each,
  isFunction,
  isObject,
  indexOf,
  bind,
  clone,
  setAsPrimitive,
  extend,
  createHashMap,
  map,
  defaults,
  isDom,
  isArray,
  noop,
  isString,
} from '../../zrender/core/util';
import env from '../../zrender/core/env';
import timsort from '../../zrender/core/timsort';
import Eventful from '../../zrender/core/Eventful';
import GlobalModel from '../model/Global';
import ExtensionAPI from './ExtensionAPI';
import OptionManager from '../model/OptionManager';
import backwardCompat from '../preprocessor/backwardCompat';
import CoordinateSystemManager from './CoordinateSystem';
import dataStack from '../processor/dataStack';
import SeriesModel from '../model/Series';
import { getECData } from '../util/innerStore';
import {
  isHighDownDispatcher,
  HOVER_STATE_EMPHASIS,
  HOVER_STATE_BLUR,
  blurSeriesFromHighlightPayload,
  toggleSelectionFromPayload,
  updateSeriesElementSelection,
  getAllSelectedIndices,
  isSelectChangePayload,
  isHighDownPayload,
  HIGHLIGHT_ACTION_TYPE,
  DOWNPLAY_ACTION_TYPE,
  SELECT_ACTION_TYPE,
  UNSELECT_ACTION_TYPE,
  TOGGLE_SELECT_ACTION_TYPE,
  savePathStates,
  enterEmphasis,
  leaveEmphasis,
  leaveBlur,
  enterSelect,
  leaveSelect,
  enterBlur,
  allLeaveBlur,
  findComponentHighDownDispatchers,
  blurComponent,
  handleGlobalMouseOverForHighDown,
  handleGlobalMouseOutForHighDown
} from '../util/states';
import * as modelUtil from '../util/model';
import Animation from '../../zrender/animation/Animation';

import { seriesStyleTask, dataStyleTask, dataColorPaletteTask } from '../visual/style';
import Scheduler from './Scheduler';
import lightTheme from '../theme/light';
import darkTheme from '../theme/dark';
import { parseClassType } from '../util/clazz';
import { ECEventProcessor } from '../util/ECEventProcessor';
import { seriesSymbolTask, dataSymbolTask } from '../visual/symbol';
import { getVisualFromData, getItemVisualFromData } from '../visual/helper';
import { deprecateLog, deprecateReplaceLog, error, warn } from '../util/log';
import { registerExternalTransform } from '../data/helper/transform';
import { createLocaleObject, SYSTEM_LANG } from './locale';
import { findEventDispatcher } from '../util/event';
import decal from '../visual/decal';
import lifecycle from './lifecycle';
import { getImpl } from './impl';
import ComponentView from '../view/Component';
import ChartView from '../view/Chart';

export const version = '5.4.3';
export const dependencies = {
  zrender: '5.4.4'
};
const TEST_FRAME_REMAIN_TIME = 1;
const PRIORITY_PROCESSOR_SERIES_FILTER = 800;
// Some data processors depends on the stack result dimension (to calculate data extent).
// So data stack stage should be in front of data processing stage.
const PRIORITY_PROCESSOR_DATASTACK = 900;
// "Data filter" will block the stream, so it should be
// put at the beginning of data processing.
const PRIORITY_PROCESSOR_FILTER = 1000;
const PRIORITY_PROCESSOR_DEFAULT = 2000;
const PRIORITY_PROCESSOR_STATISTIC = 5000;
const PRIORITY_VISUAL_LAYOUT = 1000;
const PRIORITY_VISUAL_PROGRESSIVE_LAYOUT = 1100;
const PRIORITY_VISUAL_GLOBAL = 2000;
const PRIORITY_VISUAL_CHART = 3000;
const PRIORITY_VISUAL_COMPONENT = 4000;
// Visual property in data. Greater than `PRIORITY_VISUAL_COMPONENT` to enable to
// overwrite the viusal result of component (like `visualMap`)
// using data item specific setting (like itemStyle.xxx on data item)
const PRIORITY_VISUAL_CHART_DATA_CUSTOM = 4500;
// Greater than `PRIORITY_VISUAL_CHART_DATA_CUSTOM` to enable to layout based on
// visual result like `symbolSize`.
const PRIORITY_VISUAL_POST_CHART_LAYOUT = 4600;
const PRIORITY_VISUAL_BRUSH = 5000;
const PRIORITY_VISUAL_ARIA = 6000;
const PRIORITY_VISUAL_DECAL = 7000;
export const PRIORITY = {
  PROCESSOR: {
    FILTER: PRIORITY_PROCESSOR_FILTER,
    SERIES_FILTER: PRIORITY_PROCESSOR_SERIES_FILTER,
    STATISTIC: PRIORITY_PROCESSOR_STATISTIC
  },
  VISUAL: {
    LAYOUT: PRIORITY_VISUAL_LAYOUT,
    PROGRESSIVE_LAYOUT: PRIORITY_VISUAL_PROGRESSIVE_LAYOUT,
    GLOBAL: PRIORITY_VISUAL_GLOBAL,
    CHART: PRIORITY_VISUAL_CHART,
    POST_CHART_LAYOUT: PRIORITY_VISUAL_POST_CHART_LAYOUT,
    COMPONENT: PRIORITY_VISUAL_COMPONENT,
    BRUSH: PRIORITY_VISUAL_BRUSH,
    CHART_ITEM: PRIORITY_VISUAL_CHART_DATA_CUSTOM,
    ARIA: PRIORITY_VISUAL_ARIA,
    DECAL: PRIORITY_VISUAL_DECAL
  }
};
// Main process have three entries: `setOption`, `dispatchAction` and `resize`,
// where they must not be invoked nestedly, except the only case: invoke
// dispatchAction with updateMethod "none" in main process.
// This flag is used to carry out this rule.
// All events will be triggered out side main process (i.e. when !this[IN_MAIN_PROCESS]).
const IN_MAIN_PROCESS_KEY = '__flagInMainProcess';
const PENDING_UPDATE = '__pendingUpdate';
const STATUS_NEEDS_UPDATE_KEY = '__needsUpdateStatus';
const ACTION_REG = /^[a-zA-Z0-9_]+$/;
const CONNECT_STATUS_KEY = '__connectUpdateStatus';
const CONNECT_STATUS_PENDING = 0;
const CONNECT_STATUS_UPDATING = 1;
const CONNECT_STATUS_UPDATED = 2;
const VIRTUAL_DIAMETER = 1000;

function createRegisterEventWithLowercaseECharts(method) {
  return function () {
    var args = [];
    for (let _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    if (this.isDisposed()) {
      disposedWarning(this.id);
      return;
    }
    return toLowercaseNameAndCallEventful(this, method, args);
  };
}

function createRegisterEventWithLowercaseMessageCenter(method) {
  return function () {
    var args = [];
    for (let _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    return toLowercaseNameAndCallEventful(this, method, args);
  };
}

function toLowercaseNameAndCallEventful(host, method, args) {
  // `args[0]` is event name. Event name is all lowercase.
  args[0] = args[0] && args[0].toLowerCase();
  return Eventful.prototype[method].apply(host, args);
}

const MessageCenter = /** @class */ (function (_super) {
  __extends(MessageCenter, _super);

  function MessageCenter() {
    return _super !== null && _super.apply(this, arguments) || this;
  }

  return MessageCenter;
}(Eventful));
const messageCenterProto = MessageCenter.prototype;
messageCenterProto.on = createRegisterEventWithLowercaseMessageCenter('on');
messageCenterProto.off = createRegisterEventWithLowercaseMessageCenter('off');
// ---------------------------------------
// Internal method names for class ECharts
// ---------------------------------------
let prepare;
let prepareView;
let updateDirectly;
let updateMethods;
let doConvertPixel;
let updateStreamModes;
let doDispatchAction;
let flushPendingActions;
let triggerUpdatedEvent;
let bindRenderedEvent;
let bindMouseEvent;
let render;
let renderComponents;
let renderSeries;
let createExtensionAPI;
let enableConnect;
let markStatusToUpdate;
let applyChangedStates;
const ECharts = /** @class */ (function (_super) {
  __extends(ECharts, _super);

  function ECharts(dom,
    // Theme name or themeOption.
    theme, opts) {
    var _this = _super.call(this, new ECEventProcessor()) || this;
    _this._chartsViews = [];
    _this._chartsMap = {};
    _this._componentsViews = [];
    _this._componentsMap = {};
    // Can't dispatch action during rendering procedure
    _this._pendingActions = [];
    opts = opts || {};
    // Get theme by name
    if (isString(theme)) {
      theme = themeStorage[theme];
    }
    _this._dom = dom;
    _this._ssr = opts.ssr;
    _this.renderer = opts.render;

    _this._throttledZrFlush = throttle(bind(_this.renderer.flush, _this.renderer), 17);

    // Expect 60 fps.
    theme = clone(theme);
    theme && backwardCompat(theme, true);
    _this._theme = theme;
    _this._locale = createLocaleObject(opts.locale || SYSTEM_LANG);
    _this._coordSysMgr = new CoordinateSystemManager();
    var api = _this._api = createExtensionAPI(_this);

    // Sort on demand
    function prioritySortFunc(a, b) {
      return a.__prio - b.__prio;
    }

    timsort(visualFuncs, prioritySortFunc);
    timsort(dataProcessorFuncs, prioritySortFunc);

    _this.scene = new SceneManager({ chart: _this, virtualDiameter: VIRTUAL_DIAMETER });


    _this._scheduler = new Scheduler(_this, api, dataProcessorFuncs, visualFuncs);
    _this._messageCenter = new MessageCenter();
    // Init mouse events
    _this._initEvents();
    // In case some people write `window.onresize = chart.resize`
    _this.resize = bind(_this.resize, _this);

    // ECharts instance can be used as value.
    setAsPrimitive(_this);

    _this.renderer.animation.on('frame', _this._onframe, _this);
    bindRenderedEvent(_this.renderer, _this);
    bindMouseEvent(_this.renderer, _this);

    return _this;
  }
  ECharts.prototype._onframe = function () {
    console.log('_onframe');
    if (this._disposed) {
      return;
    }
    applyChangedStates(this);
    var scheduler = this._scheduler;
    // Lazy update
    if (this[PENDING_UPDATE]) {
      var silent = this[PENDING_UPDATE].silent;
      this[IN_MAIN_PROCESS_KEY] = true;
      try {
        prepare(this);
        updateMethods.update.call(this, null, this[PENDING_UPDATE].updateParams);
      } catch (e) {
        this[IN_MAIN_PROCESS_KEY] = false;
        this[PENDING_UPDATE] = null;
        throw e;
      }
      // At present, in each frame, zrender performs:
      //   (1) animation step forward.
      //   (2) trigger('frame') (where this `_onframe` is called)
      //   (3) zrender flush (render).
      // If we do nothing here, since we use `setToFinal: true`, the step (3) above
      // will render the final state of the elements before the real animation started.
      this.renderer.flush();
      this[IN_MAIN_PROCESS_KEY] = false;
      this[PENDING_UPDATE] = null;
      flushPendingActions.call(this, silent);
      triggerUpdatedEvent.call(this, silent);
    }
    // Avoid do both lazy update and progress in one frame.
    else if (scheduler.unfinished) {
      // Stream progress.
      var remainTime = TEST_FRAME_REMAIN_TIME;
      var ecModel = this._model;
      var api = this._api;
      scheduler.unfinished = false;
      do {
        var startTime = +new Date();
        scheduler.performSeriesTasks(ecModel);
        // Currently dataProcessorFuncs do not check threshold.
        scheduler.performDataProcessorTasks(ecModel);
        updateStreamModes(this, ecModel);
        // Do not update coordinate system here. Because that coord system update in
        // each frame is not a good user experience. So we follow the rule that
        // the extent of the coordinate system is determined in the first frame (the
        // frame is executed immediately after task reset.
        // this._coordSysMgr.update(ecModel, api);
        // console.log('--- ec frame visual ---', remainTime);
        scheduler.performVisualTasks(ecModel);
        renderSeries(this, this._model, api, 'remain', {});
        remainTime -= (+new Date() - startTime);
      } while (remainTime > 0 && scheduler.unfinished);
      // Call flush explicitly for trigger finished event.
      if (!scheduler.unfinished) {
        this.renderer.flush();
      }
      // Else, zr flushing be ensue within the same frame,
      // because zr flushing is after onframe event.
    }
  };
  ECharts.prototype.getDom = function () {
    return this._dom;
  };
  ECharts.prototype.getId = function () {
    return this.id;
  };
  ECharts.prototype.getZr = function () {
    return this.renderer;
  };
  ECharts.prototype.isSSR = function () {
    return this._ssr;
  };
  /* eslint-disable-next-line */
  ECharts.prototype.setOption = function (option, notMerge, lazyUpdate) {
    console.time('setOption');
    if (this[IN_MAIN_PROCESS_KEY]) {
      if (self.__DEV__) {
        error('`setOption` should not be called during main process.');
      }
      return;
    }
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    var silent;
    var replaceMerge;
    var transitionOpt;
    if (isObject(notMerge)) {
      lazyUpdate = notMerge.lazyUpdate;
      silent = notMerge.silent;
      replaceMerge = notMerge.replaceMerge;
      transitionOpt = notMerge.transition;
      notMerge = notMerge.notMerge;
    }
    this[IN_MAIN_PROCESS_KEY] = true;
    if (!this._model || notMerge) {
      var optionManager = new OptionManager(this._api);
      var theme = this._theme;
      var ecModel = this._model = new GlobalModel();
      ecModel.scheduler = this._scheduler;
      ecModel.ssr = this._ssr;
      ecModel.init(null, null, null, theme, this._locale, optionManager);
    }

    this._model.setOption(option, { replaceMerge }, optionPreprocessorFuncs);
    var updateParams = {
      seriesTransition: transitionOpt,
      optionChanged: true
    };
    if (lazyUpdate) {
      this[PENDING_UPDATE] = {
        silent,
        updateParams
      };
      this[IN_MAIN_PROCESS_KEY] = false;
      // `setOption(option, {lazyMode: true})` may be called when zrender has been slept.
      // It should wake it up to make sure zrender start to render at the next frame.
    } else {
      console.timeEnd('setOption');

      try {
        console.time('prepare------1');
        prepare(this);
        console.timeEnd('prepare------1');
        console.time('prepare------2');
        updateMethods.update.call(this, null, updateParams);
        console.timeEnd('prepare------2');
      } catch (e) {
        this[PENDING_UPDATE] = null;
        this[IN_MAIN_PROCESS_KEY] = false;
        throw e;
      }
      // Ensure zr refresh sychronously, and then pixel in canvas can be
      // fetched after `setOption`.
      this.renderer.flush();

      this[PENDING_UPDATE] = null;
      this[IN_MAIN_PROCESS_KEY] = false;
      flushPendingActions.call(this, silent);
      triggerUpdatedEvent.call(this, silent);
    }
  };
  /**
   * @deprecated
   */
  ECharts.prototype.setTheme = function () {
    deprecateLog('ECharts#setTheme() is DEPRECATED in ECharts 3.0');
  };
  // We don't want developers to use getModel directly.
  ECharts.prototype.getModel = function () {
    return this._model;
  };
  ECharts.prototype.getOption = function () {
    return this._model && this._model.getOption();
  };
  ECharts.prototype.getWidth = function () {
    return this._dom.rect.width;
  };
  ECharts.prototype.getHeight = function () {
    return this._dom.rect.height;
  };
  ECharts.prototype.getDevicePixelRatio = function () {
    return 1;
    // return this._zr.painter.dpr
    //     /* eslint-disable-next-line */
    //     || (env.hasGlobalWindow && window.devicePixelRatio) || 1;
  };
  /**
   * Get canvas which has all thing rendered
   * @deprecated Use renderToCanvas instead.
   */
  ECharts.prototype.getRenderedCanvas = function (opts) {
    if (self.__DEV__) {
      deprecateReplaceLog('getRenderedCanvas', 'renderToCanvas');
    }
    return this.renderToCanvas(opts);
  };
  ECharts.prototype.renderToCanvas = function (opts) {
    opts = opts || {};
    var painter = this._zr.painter;
    // if (self.__DEV__) {
    //     if (painter.type !== 'canvas') {
    //         throw new Error('renderToCanvas can only be used in the canvas renderer.');
    //     }
    // }
    // return painter.getRenderedCanvas({
    //     backgroundColor: (opts.backgroundColor || this._model.get('backgroundColor')),
    //     pixelRatio: opts.pixelRatio || this.getDevicePixelRatio()
    // });
  };
  /**
   * Get svg data url
   */
  ECharts.prototype.getDataURL = function (opts) {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    opts = opts || {};
    var excludeComponents = opts.excludeComponents;
    var ecModel = this._model;
    var excludesComponentViews = [];
    var self = this;
    each(excludeComponents, (componentType) => {
      ecModel.eachComponent({
        mainType: componentType
      }, (component) => {
        var view = self._componentsMap[component.__viewId];
        if (!view.group.ignore) {
          excludesComponentViews.push(view);
          view.group.ignore = true;
        }
      });
    });
    // var url = this._zr.painter.getType() === 'svg'
    //     ? this.getSvgDataURL()
    //     : this.renderToCanvas(opts).toDataURL('image/' + (opts && opts.type || 'png'));
    // each(excludesComponentViews, function (view) {
    //     view.group.ignore = false;
    // });
    // return url;
  };
  ECharts.prototype.getConnectedDataURL = function (opts) {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    var isSvg = opts.type === 'svg';
    var groupId = this.group;
    var mathMin = Math.min;
    var mathMax = Math.max;
    var MAX_NUMBER = Infinity;
    if (connectedGroups[groupId]) {
      var left_1 = MAX_NUMBER;
      var top_1 = MAX_NUMBER;
      var right_1 = -MAX_NUMBER;
      var bottom_1 = -MAX_NUMBER;
      var canvasList_1 = [];
      var dpr_1 = (opts && opts.pixelRatio) || this.getDevicePixelRatio();
      each(instances, (chart, id) => {
        if (chart.group === groupId) {
          var canvas = isSvg
            ? chart.getZr().painter.getSvgDom().innerHTML
            : chart.renderToCanvas(clone(opts));
          var boundingRect = chart.getDom().getBoundingClientRect();
          left_1 = mathMin(boundingRect.left, left_1);
          top_1 = mathMin(boundingRect.top, top_1);
          right_1 = mathMax(boundingRect.right, right_1);
          bottom_1 = mathMax(boundingRect.bottom, bottom_1);
          canvasList_1.push({
            dom: canvas,
            left: boundingRect.left,
            top: boundingRect.top
          });
        }
      });
      left_1 *= dpr_1;
      top_1 *= dpr_1;
      right_1 *= dpr_1;
      bottom_1 *= dpr_1;
      var width = right_1 - left_1;
      var height = bottom_1 - top_1;
      var targetCanvas = platformApi.createCanvas();
      var zr_1 = zrender.init(targetCanvas, {
        renderer: isSvg ? 'svg' : 'canvas'
      });
      zr_1.resize({
        width,
        height
      });
      if (isSvg) {
        var content_1 = '';
        each(canvasList_1, (item) => {
          var x = item.left - left_1;
          var y = item.top - top_1;
          content_1 += `<g transform="translate(${x},${
            y})">${item.dom}</g>`;
        });
        zr_1.painter.getSvgRoot().innerHTML = content_1;
        if (opts.connectedBackgroundColor) {
          zr_1.painter.setBackgroundColor(opts.connectedBackgroundColor);
        }
        zr_1.refreshImmediately();
        return zr_1.painter.toDataURL();
      }
      // Background between the charts
      if (opts.connectedBackgroundColor) {
        zr_1.add(new graphic.Rect({
          shape: {
            x: 0,
            y: 0,
            width,
            height
          },
          style: {
            fill: opts.connectedBackgroundColor
          }
        }));
      }
      each(canvasList_1, (item) => {
        var img = new graphic.Image({
          style: {
            x: item.left * dpr_1 - left_1,
            y: item.top * dpr_1 - top_1,
            image: item.dom
          }
        });
        zr_1.add(img);
      });
      zr_1.refreshImmediately();
      return targetCanvas.toDataURL(`image/${opts && opts.type || 'png'}`);
    }
    return this.getDataURL(opts);
  };
  ECharts.prototype.convertToPixel = function (finder, value) {
    return doConvertPixel(this, 'convertToPixel', finder, value);
  };
  ECharts.prototype.convertFromPixel = function (finder, value) {
    return doConvertPixel(this, 'convertFromPixel', finder, value);
  };
  /**
   * Is the specified coordinate systems or components contain the given pixel point.
   * @param {Array|number} value
   * @return {boolean} result
   */
  ECharts.prototype.containPixel = function (finder, value) {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    var ecModel = this._model;
    var result;
    var findResult = modelUtil.parseFinder(ecModel, finder);
    each(findResult, function (models, key) {
      key.indexOf('Models') >= 0 && each(models, function (model) {
        var coordSys = model.coordinateSystem;
        if (coordSys && coordSys.containPoint) {
          result = result || !!coordSys.containPoint(value);
        } else if (key === 'seriesModels') {
          var view = this._chartsMap[model.__viewId];
          if (view && view.containPoint) {
            result = result || view.containPoint(value, model);
          } else {
            if (self.__DEV__) {
              warn(`${key}: ${view
                ? 'The found component do not support containPoint.'
                : 'No view mapping to the found component.'}`);
            }
          }
        } else {
          if (self.__DEV__) {
            warn(`${key}: containPoint is not supported`);
          }
        }
      }, this);
    }, this);
    return !!result;
  };
  /**
   * Get visual from series or data.
   * @param finder
   *        If string, e.g., 'series', means {seriesIndex: 0}.
   *        If Object, could contain some of these properties below:
   *        {
   *            seriesIndex / seriesId / seriesName,
   *            dataIndex / dataIndexInside
   *        }
   *        If dataIndex is not specified, series visual will be fetched,
   *        but not data item visual.
   *        If all of seriesIndex, seriesId, seriesName are not specified,
   *        visual will be fetched from first series.
   * @param visualType 'color', 'symbol', 'symbolSize'
   */
  ECharts.prototype.getVisual = function (finder, visualType) {
    var ecModel = this._model;
    var parsedFinder = modelUtil.parseFinder(ecModel, finder, {
      defaultMainType: 'series'
    });
    var seriesModel = parsedFinder.seriesModel;
    if (self.__DEV__) {
      if (!seriesModel) {
        warn('There is no specified series model');
      }
    }
    var data = seriesModel.getData();
    var dataIndexInside = parsedFinder.hasOwnProperty('dataIndexInside')
      ? parsedFinder.dataIndexInside
      : parsedFinder.hasOwnProperty('dataIndex')
        ? data.indexOfRawIndex(parsedFinder.dataIndex)
        : null;
    return dataIndexInside != null
      ? getItemVisualFromData(data, dataIndexInside, visualType)
      : getVisualFromData(data, visualType);
  };
  /**
   * Get view of corresponding component model
   */
  ECharts.prototype.getViewOfComponentModel = function (componentModel) {
    return this._componentsMap[componentModel.__viewId];
  };
  /**
   * Get view of corresponding series model
   */
  ECharts.prototype.getViewOfSeriesModel = function (seriesModel) {
    return this._chartsMap[seriesModel.__viewId];
  };
  ECharts.prototype.getSymbolForEvent = function (event) {
    const pObject = event.pickedObject;
    const { uid, type } = pObject.object.userData;
    let view;
    if (type === 'chart') {
      view = this._chartsViews.find(item => item.uid === uid);
      const symbol = view._symbolDraw._data.getItemGraphicEl(pObject.instanceId);
      return symbol;
    }
    view = this._componentsViews.find(item => item.uid === uid);
    return null;
  };
  ECharts.prototype._initEvents = function () {
    var _this = this;
    each(MOUSE_EVENT_NAMES, (eveName) => {
      var handler = function (e) {
        var ecModel = _this.getModel();
        var el = e.target;
        var params;
        var isGlobalOut = eveName === 'globalout';
        // no e.target when 'globalout'.
        if (isGlobalOut) {
          params = {};
        } else {
          const parent = this.getSymbolForEvent(e);
          if (parent) {
            var ecData = getECData(parent);
            if (ecData && ecData.dataIndex != null) {
              var dataModel = ecData.dataModel || ecModel.getSeriesByIndex(ecData.seriesIndex);
              params = (dataModel && dataModel.getDataParams(ecData.dataIndex, ecData.dataType, el) || {});
            }
            // If element has custom eventData of components
            if (ecData.eventData) {
              params = extend({}, ecData.eventData);
            }
          }
        }
        // Contract: if params prepared in mouse event,
        // these properties must be specified:
        // {
        //    componentType: string (component main type)
        //    componentIndex: number
        // }
        // Otherwise event query can not work.
        if (params) {
          var componentType = params.componentType;
          var componentIndex = params.componentIndex;
          // Special handling for historic reason: when trigger by
          // markLine/markPoint/markArea, the componentType is
          // 'markLine'/'markPoint'/'markArea', but we should better
          // enable them to be queried by seriesIndex, since their
          // option is set in each series.
          if (componentType === 'markLine' ||
            componentType === 'markPoint' ||
            componentType === 'markArea') {
            componentType = 'series';
            componentIndex = params.seriesIndex;
          }
          var model = componentType && componentIndex != null &&
            ecModel.getComponent(componentType, componentIndex);
          var view = model && _this[model.mainType === 'series' ? '_chartsMap' : '_componentsMap'][model.__viewId];
          if (self.__DEV__) {
            // `event.componentType` and `event[componentTpype + 'Index']` must not
            // be missed, otherwise there is no way to distinguish source component.
            // See `dataFormat.getDataParams`.
            if (!isGlobalOut && !(model && view)) {
              warn('model or view can not be found by params');
            }
          }
          params.event = e;
          params.type = eveName;
          _this._$eventProcessor.eventInfo = {
            targetEl: el,
            packedEvent: params,
            model,
            view
          };
          _this.trigger(eveName, params);
        }
      };
      // Consider that some component (like tooltip, brush, ...)
      // register zr event handler, but user event handler might
      // do anything, such as call `setOption` or `dispatchAction`,
      // which probably update any of the content and probably
      // cause problem if it is called previous other inner handlers.
      handler.zrEventfulCallAtLast = true;
      _this.renderer.on(eveName, handler, _this);
    });
    each(eventActionMap, (actionType, eventType) => {
      _this._messageCenter.on(eventType, function (event) {
        this.trigger(eventType, event);
      }, _this);
    });
    // Extra events
    // TODO register?
    each(['selectchanged'], (eventType) => {
      _this._messageCenter.on(eventType, function (event) {
        this.trigger(eventType, event);
      }, _this);
    });
    // handleLegacySelectEvents(this._messageCenter, this, this._api);
  };
  ECharts.prototype.isDisposed = function () {
    return this._disposed;
  };
  ECharts.prototype.clear = function () {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    this.setOption({ series: [] }, true);
  };
  ECharts.prototype.dispose = function () {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    this._disposed = true;
    var dom = this.getDom();
    if (dom) {
      modelUtil.setAttribute(this.getDom(), DOM_ATTRIBUTE_KEY, '');
    }
    var chart = this;
    var api = chart._api;
    var ecModel = chart._model;
    each(chart._componentsViews, (component) => {
      component.dispose(ecModel, api);
    });
    each(chart._chartsViews, (chart) => {
      chart.dispose(ecModel, api);
    });
    // Dispose after all views disposed
    chart._zr.dispose();
    // Set properties to null.
    // To reduce the memory cost in case the top code still holds this instance unexpectedly.
    chart._dom =
      chart._model =
        chart._chartsMap =
          chart._componentsMap =
            chart._chartsViews =
              chart._componentsViews =
                chart._scheduler =
                  chart._api =
                    chart._zr =
                      chart._throttledZrFlush =
                        chart._theme =
                          chart._coordSysMgr =
                            chart._messageCenter = null;
    delete instances[chart.id];
  };
  /**
   * Resize the chart
   */
  ECharts.prototype.resize = function (opts) {
    if (this[IN_MAIN_PROCESS_KEY]) {
      if (self.__DEV__) {
        error('`resize` should not be called during main process.');
      }
      return;
    }
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    // this._zr.resize(opts);
    var ecModel = this._model;
    // Resize loading effect
    this._loadingFX && this._loadingFX.resize();
    if (!ecModel) {
      return;
    }
    var needPrepare = ecModel.resetOption('media');
    var silent = opts && opts.silent;
    // There is some real cases that:
    // chart.setOption(option, { lazyUpdate: true });
    // chart.resize();
    if (this[PENDING_UPDATE]) {
      if (silent == null) {
        silent = this[PENDING_UPDATE].silent;
      }
      needPrepare = true;
      this[PENDING_UPDATE] = null;
    }
    this[IN_MAIN_PROCESS_KEY] = true;
    try {
      needPrepare && prepare(this);
      updateMethods.update.call(this, {
        type: 'resize',
        animation: extend({
          // Disable animation
          duration: 0
        }, opts && opts.animation)
      });
    } catch (e) {
      this[IN_MAIN_PROCESS_KEY] = false;
      throw e;
    }
    this[IN_MAIN_PROCESS_KEY] = false;
    flushPendingActions.call(this, silent);
    triggerUpdatedEvent.call(this, silent);
  };
  ECharts.prototype.showLoading = function (name, cfg) {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    if (isObject(name)) {
      cfg = name;
      name = '';
    }
    name = name || 'default';
    this.hideLoading();
    if (!loadingEffects[name]) {
      if (self.__DEV__) {
        warn(`Loading effects ${name} not exists.`);
      }
      return;
    }
    var el = loadingEffects[name](this._api, cfg);
    // var zr = this._zr;
    this._loadingFX = el;
    // zr.add(el);
  };
  /**
   * Hide loading effect
   */
  ECharts.prototype.hideLoading = function () {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    // this._loadingFX && this._zr.remove(this._loadingFX);
    this._loadingFX = null;
  };
  ECharts.prototype.makeActionFromEvent = function (eventObj) {
    var payload = extend({}, eventObj);
    payload.type = eventActionMap[eventObj.type];
    return payload;
  };
  /**
   * @param opt If pass boolean, means opt.silent
   * @param opt.silent Default `false`. Whether trigger events.
   * @param opt.flush Default `undefined`.
   *        true: Flush immediately, and then pixel in canvas can be fetched
   *            immediately. Caution: it might affect performance.
   *        false: Not flush.
   *        undefined: Auto decide whether perform flush.
   */
  ECharts.prototype.dispatchAction = function (payload, opt) {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    if (!isObject(opt)) {
      opt = { silent: !!opt };
    }
    if (!actions[payload.type]) {
      return;
    }
    // Avoid dispatch action before setOption. Especially in `connect`.
    if (!this._model) {
      return;
    }
    // May dispatchAction in rendering procedure
    if (this[IN_MAIN_PROCESS_KEY]) {
      this._pendingActions.push(payload);
      return;
    }
    var silent = opt.silent;
    doDispatchAction.call(this, payload, silent);
    var flush = opt.flush;
    if (flush) {
      this.renderer.flush();
    } else if (flush !== false && env.browser.weChat) {
      // In WeChat embedded browser, `requestAnimationFrame` and `setInterval`
      // hang when sliding page (on touch event), which cause that zr does not
      // refresh until user interaction finished, which is not expected.
      // But `dispatchAction` may be called too frequently when pan on touch
      // screen, which impacts performance if do not throttle them.
      this._throttledZrFlush();
    }
    flushPendingActions.call(this, silent);
    triggerUpdatedEvent.call(this, silent);
  };
  ECharts.prototype.updateLabelLayout = function () {
    lifecycle.trigger('series:layoutlabels', this._model, this._api, {
      // Not adding series labels.
      // TODO
      updatedSeries: []
    });
  };
  ECharts.prototype.appendData = function (params) {
    if (this._disposed) {
      disposedWarning(this.id);
      return;
    }
    var seriesIndex = params.seriesIndex;
    var ecModel = this.getModel();
    var seriesModel = ecModel.getSeriesByIndex(seriesIndex);
    if (self.__DEV__) {
      assert(params.data && seriesModel);
    }
    seriesModel.appendData(params);
    // Note: `appendData` does not support that update extent of coordinate
    // system, util some scenario require that. In the expected usage of
    // `appendData`, the initial extent of coordinate system should better
    // be fixed by axis `min`/`max` setting or initial data, otherwise if
    // the extent changed while `appendData`, the location of the painted
    // graphic elements have to be changed, which make the usage of
    // `appendData` meaningless.
    this._scheduler.unfinished = true;
    this.getZr().wakeUp();
  };
  // A work around for no `internal` modifier in ts yet but
  // need to strictly hide private methods to JS users.
  ECharts.internalField = (function () {
    prepare = function (ecIns) {
      var scheduler = ecIns._scheduler;
      scheduler.restorePipelines(ecIns._model);
      scheduler.prepareStageTasks();
      prepareView(ecIns, true);
      prepareView(ecIns, false);
      scheduler.plan();
    };
    /**
     * Prepare view instances of charts and components
     */
    prepareView = function (ecIns, isComponent) {
      const ecModel = ecIns._model;
      const scheduler = ecIns._scheduler;
      const viewList = isComponent ? ecIns._componentsViews : ecIns._chartsViews;
      const viewMap = isComponent ? ecIns._componentsMap : ecIns._chartsMap;
      const scene = isComponent ? ecIns.scene.componentScene : ecIns.scene.chartScene;
      const api = ecIns._api;
      for (let i = 0; i < viewList.length; i++) {
        viewList[i].__alive = false;
      }

      isComponent
        ? ecModel.eachComponent((componentType, model) => {
          componentType !== 'series' && doPrepare(model);
        })
        : ecModel.eachSeries(doPrepare);
      function doPrepare(model) {
        // By default view will be reused if possible for the case that `setOption` with "notMerge"
        // mode and need to enable transition animation. (Usually, when they have the same id, or
        // especially no id but have the same type & name & index. See the `model.id` generation
        // rule in `makeIdAndName` and `viewId` generation rule here).
        // But in `replaceMerge` mode, this feature should be able to disabled when it is clear that
        // the new model has nothing to do with the old model.
        var requireNewView = model.__requireNewView;
        // This command should not work twice.
        model.__requireNewView = false;
        // Consider: id same and type changed.
        var viewId = `_ec_${model.id}_${model.type}`;
        var view = !requireNewView && viewMap[viewId];
        if (!view) {
          var classType = parseClassType(model.type);
          var Clazz = isComponent
            ? ComponentView.getClass(classType.main, classType.sub)
            : (
              // FIXME:TS
              // (ChartView as ChartViewConstructor).getClass('series', classType.sub)
              // For backward compat, still support a chart type declared as only subType
              // like "liquidfill", but recommend "series.liquidfill"
              // But need a base class to make a type series.
              ChartView.getClass(classType.sub));
          if (!Clazz) return;
          if (self.__DEV__) {
            assert(Clazz, `${classType.sub} does not exist.`);
          }
          view = new Clazz();
          view.init(ecModel, api);
          viewMap[viewId] = view;
          viewList.push(view);
          scene.add(view.group);
        }
        model.__viewId = view.__id = viewId;
        view.__alive = true;
        view.__model = model;
        view.group.__ecComponentInfo = {
          mainType: model.mainType,
          index: model.componentIndex
        };
        !isComponent && scheduler.prepareView(view, model, ecModel, api);
      }
      for (let i = 0; i < viewList.length;) {
        var view = viewList[i];
        if (!view.__alive) {
          !isComponent && view.renderTask.dispose();
          scene.remove(view.group);
          view.dispose(ecModel, api);
          viewList.splice(i, 1);
          if (viewMap[view.__id] === view) {
            delete viewMap[view.__id];
          }
          view.__id = view.group.__ecComponentInfo = null;
        } else {
          i++;
        }
      }
    };

    updateDirectly = function (ecIns, method, payload, mainType, subType) {
      var ecModel = ecIns._model;
      ecModel.setUpdatePayload(payload);
      // broadcast
      if (!mainType) {
        // FIXME
        // Chart will not be update directly here, except set dirty.
        // But there is no such scenario now.
        each([].concat(ecIns._componentsViews).concat(ecIns._chartsViews), callView);
        return;
      }
      var query = {};
      query[`${mainType}Id`] = payload[`${mainType}Id`];
      query[`${mainType}Index`] = payload[`${mainType}Index`];
      query[`${mainType}Name`] = payload[`${mainType}Name`];
      var condition = { mainType, query };
      subType && (condition.subType = subType); // subType may be '' by parseClassType;
      var excludeSeriesId = payload.excludeSeriesId;
      var excludeSeriesIdMap;
      if (excludeSeriesId != null) {
        excludeSeriesIdMap = createHashMap();
        each(modelUtil.normalizeToArray(excludeSeriesId), (id) => {
          var modelId = modelUtil.convertOptionIdName(id, null);
          if (modelId != null) {
            excludeSeriesIdMap.set(modelId, true);
          }
        });
      }
      // If dispatchAction before setOption, do nothing.
      ecModel && ecModel.eachComponent(condition, (model) => {
        var isExcluded = excludeSeriesIdMap && excludeSeriesIdMap.get(model.id) != null;
        if (isExcluded) {
          return;
        }

        if (isHighDownPayload(payload)) {
          if (model instanceof SeriesModel) {
            if (payload.type === HIGHLIGHT_ACTION_TYPE &&
              !payload.notBlur && !model.get(['emphasis', 'disabled'])) {
              blurSeriesFromHighlightPayload(model, payload, ecIns._api);
            }
          } else {
            var _a = findComponentHighDownDispatchers(model.mainType, model.componentIndex, payload.name, ecIns._api);
            var focusSelf = _a.focusSelf; var
              dispatchers = _a.dispatchers;
            if (payload.type === HIGHLIGHT_ACTION_TYPE && focusSelf && !payload.notBlur) {
              blurComponent(model.mainType, model.componentIndex, ecIns._api);
            }
            // PENDING:
            // Whether to put this "enter emphasis" code in `ComponentView`,
            // which will be the same as `ChartView` but might be not necessary
            // and will be far from this logic.
            if (dispatchers) {
              each(dispatchers, (dispatcher) => {
                payload.type === HIGHLIGHT_ACTION_TYPE
                  ? enterEmphasis(dispatcher)
                  : leaveEmphasis(dispatcher);
              });
            }
          }
        } else if (isSelectChangePayload(payload)) {
          // TODO geo
          if (model instanceof SeriesModel) {
            toggleSelectionFromPayload(model, payload, ecIns._api);
            updateSeriesElementSelection(model);
            markStatusToUpdate(ecIns);
          }
        }
      }, ecIns);
      ecModel && ecModel.eachComponent(condition, (model) => {
        var isExcluded = excludeSeriesIdMap && excludeSeriesIdMap.get(model.id) != null;
        if (isExcluded) {
          return;
        }

        callView(ecIns[mainType === 'series' ? '_chartsMap' : '_componentsMap'][model.__viewId]);
      }, ecIns);

      function callView(view) {
        view && view.__alive && view[method] && view[method](view.__model, ecModel, ecIns._api, payload);
      }
    };
    updateMethods = {
      prepareAndUpdate(payload) {
        prepare(this);
        updateMethods.update.call(this, payload, {
          // Needs to mark option changed if newOption is given.
          // It's from MagicType.
          // TODO If use a separate flag optionChanged in payload?
          optionChanged: payload.newOption != null
        });
      },
      update(payload, updateParams) {
        console.time('before-render');
        var ecModel = this._model;
        var api = this._api;
        var coordSysMgr = this._coordSysMgr;
        var scheduler = this._scheduler;
        // update before setOption
        if (!ecModel) {
          return;
        }
        ecModel.setUpdatePayload(payload);
        scheduler.restoreData(ecModel, payload);
        scheduler.performSeriesTasks(ecModel);
        // TODO
        // Save total ecModel here for undo/redo (after restoring data and before processing data).
        // Undo (restoration of total ecModel) can be carried out in 'action' or outside API call.
        // Create new coordinate system each update
        // In LineView may save the old coordinate system and use it to get the original point.
        coordSysMgr.create(ecModel, api);
        scheduler.performDataProcessorTasks(ecModel, payload);
        // Current stream render is not supported in data process. So we can update
        // stream modes after data processing, where the filtered data is used to
        // determine whether to use progressive rendering.
        updateStreamModes(this, ecModel);
        // We update stream modes before coordinate system updated, then the modes info
        // can be fetched when coord sys updating (consider the barGrid extent fix). But
        // the drawback is the full coord info can not be fetched. Fortunately this full
        // coord is not required in stream mode updater currently.
        coordSysMgr.update(ecModel, api);
        clearColorPalette(ecModel);
        scheduler.performVisualTasks(ecModel, payload);

        console.timeEnd('before-render');

        console.time('render');
        render(this, ecModel, api, payload, updateParams);
        console.timeEnd('render');

        // Set background
        // var backgroundColor = ecModel.get('backgroundColor') || 'transparent';
        // var darkMode = ecModel.get('darkMode');
        // zr.setBackgroundColor(backgroundColor);
        // // Force set dark mode.
        // if (darkMode != null && darkMode !== 'auto') {
        //     zr.setDarkMode(darkMode);
        // }
        lifecycle.trigger('afterupdate', ecModel, api);
      },
      updateTransform(payload) {
        var _this = this;
        var ecModel = this._model;
        var api = this._api;
        // update before setOption
        if (!ecModel) {
          return;
        }
        ecModel.setUpdatePayload(payload);
        // ChartView.markUpdateMethod(payload, 'updateTransform');
        var componentDirtyList = [];
        ecModel.eachComponent((componentType, componentModel) => {
          if (componentType === 'series') {
            return;
          }
          var componentView = _this.getViewOfComponentModel(componentModel);
          if (componentView && componentView.__alive) {
            if (componentView.updateTransform) {
              var result = componentView.updateTransform(componentModel, ecModel, api, payload);
              result && result.update && componentDirtyList.push(componentView);
            } else {
              componentDirtyList.push(componentView);
            }
          }
        });
        var seriesDirtyMap = createHashMap();
        ecModel.eachSeries((seriesModel) => {
          var chartView = _this._chartsMap[seriesModel.__viewId];
          if (chartView.updateTransform) {
            var result = chartView.updateTransform(seriesModel, ecModel, api, payload);
            result && result.update && seriesDirtyMap.set(seriesModel.uid, 1);
          } else {
            seriesDirtyMap.set(seriesModel.uid, 1);
          }
        });
        clearColorPalette(ecModel);
        // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        // this._scheduler.performVisualTasks(ecModel, payload, 'layout', true);
        this._scheduler.performVisualTasks(ecModel, payload, { setDirty: true, dirtyMap: seriesDirtyMap });
        // Currently, not call render of components. Geo render cost a lot.
        // renderComponents(ecIns, ecModel, api, payload, componentDirtyList);
        renderSeries(this, ecModel, api, payload, {}, seriesDirtyMap);
        lifecycle.trigger('afterupdate', ecModel, api);
      },
      updateView(payload) {
        var ecModel = this._model;
        // update before setOption
        if (!ecModel) {
          return;
        }
        ecModel.setUpdatePayload(payload);
        ChartView.markUpdateMethod(payload, 'updateView');
        clearColorPalette(ecModel);
        // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        this._scheduler.performVisualTasks(ecModel, payload, { setDirty: true });
        render(this, ecModel, this._api, payload, {});
        lifecycle.trigger('afterupdate', ecModel, this._api);
      },
      updateVisual(payload) {
        // updateMethods.update.call(this, payload);
        var _this = this;
        var ecModel = this._model;
        // update before setOption
        if (!ecModel) {
          return;
        }
        ecModel.setUpdatePayload(payload);
        // clear all visual
        ecModel.eachSeries((seriesModel) => {
          seriesModel.getData().clearAllVisual();
        });
        // Perform visual
        ChartView.markUpdateMethod(payload, 'updateVisual');
        clearColorPalette(ecModel);
        // Keep pipe to the exist pipeline because it depends on the render task of the full pipeline.
        this._scheduler.performVisualTasks(ecModel, payload, { visualType: 'visual', setDirty: true });
        ecModel.eachComponent((componentType, componentModel) => {
          if (componentType !== 'series') {
            var componentView = _this.getViewOfComponentModel(componentModel);
            componentView && componentView.__alive &&
            componentView.updateVisual(componentModel, ecModel, _this._api, payload);
          }
        });
        ecModel.eachSeries((seriesModel) => {
          var chartView = _this._chartsMap[seriesModel.__viewId];
          chartView.updateVisual(seriesModel, ecModel, _this._api, payload);
        });
        lifecycle.trigger('afterupdate', ecModel, this._api);
      },
      updateLayout(payload) {
        updateMethods.update.call(this, payload);
      }
    };
    doConvertPixel = function (ecIns, methodName, finder, value) {
      if (ecIns._disposed) {
        disposedWarning(ecIns.id);
        return;
      }
      var ecModel = ecIns._model;
      var coordSysList = ecIns._coordSysMgr.getCoordinateSystems();
      var result;
      var parsedFinder = modelUtil.parseFinder(ecModel, finder);
      for (let i = 0; i < coordSysList.length; i++) {
        var coordSys = coordSysList[i];
        if (coordSys[methodName] &&
          (result = coordSys[methodName](ecModel, parsedFinder, value)) != null) {
          return result;
        }
      }
      if (self.__DEV__) {
        warn(`No coordinate system that supports ${methodName} found by the given finder.`);
      }
    };
    updateStreamModes = function (ecIns, ecModel) {
      var chartsMap = ecIns._chartsMap;
      var scheduler = ecIns._scheduler;
      ecModel.eachSeries((seriesModel) => {
        scheduler.updateStreamModes(seriesModel, chartsMap[seriesModel.__viewId]);
      });
    };
    doDispatchAction = function (payload, silent) {
      var _this = this;
      var ecModel = this.getModel();
      var payloadType = payload.type;
      var escapeConnect = payload.escapeConnect;
      var actionWrap = actions[payloadType];
      var actionInfo = actionWrap.actionInfo;
      var cptTypeTmp = (actionInfo.update || 'update').split(':');
      var updateMethod = cptTypeTmp.pop();
      var cptType = cptTypeTmp[0] != null && parseClassType(cptTypeTmp[0]);
      this[IN_MAIN_PROCESS_KEY] = true;
      var payloads = [payload];
      var batched = false;
      // Batch action
      if (payload.batch) {
        batched = true;
        payloads = map(payload.batch, (item) => {
          item = defaults(extend({}, item), payload);
          item.batch = null;
          return item;
        });
      }
      var eventObjBatch = [];
      var eventObj;
      var isSelectChange = isSelectChangePayload(payload);
      var isHighDown = isHighDownPayload(payload);
      // Only leave blur once if there are multiple batches.
      if (isHighDown) {
        allLeaveBlur(this._api);
      }
      each(payloads, (batchItem) => {
        // Action can specify the event by return it.
        eventObj = actionWrap.action(batchItem, _this._model, _this._api);
        // Emit event outside
        eventObj = eventObj || extend({}, batchItem);
        // Convert type to eventType
        eventObj.type = actionInfo.event || eventObj.type;
        eventObjBatch.push(eventObj);
        // light update does not perform data process, layout and visual.
        if (isHighDown) {
          var _a = modelUtil.preParseFinder(payload); var queryOptionMap = _a.queryOptionMap;
          var mainTypeSpecified = _a.mainTypeSpecified;
          var componentMainType = mainTypeSpecified ? queryOptionMap.keys()[0] : 'series';
          updateDirectly(_this, updateMethod, batchItem, componentMainType);
          markStatusToUpdate(_this);
        } else if (isSelectChange) {
          // At present `dispatchAction({ type: 'select', ... })` is not supported on components.
          // geo still use 'geoselect'.
          updateDirectly(_this, updateMethod, batchItem, 'series');
          markStatusToUpdate(_this);
        } else if (cptType) {
          updateDirectly(_this, updateMethod, batchItem, cptType.main, cptType.sub);
        }
      });
      if (updateMethod !== 'none' && !isHighDown && !isSelectChange && !cptType) {
        try {
          // Still dirty
          if (this[PENDING_UPDATE]) {
            prepare(this);
            updateMethods.update.call(this, payload);
            this[PENDING_UPDATE] = null;
          } else {
            updateMethods[updateMethod].call(this, payload);
          }
        } catch (e) {
          this[IN_MAIN_PROCESS_KEY] = false;
          throw e;
        }
      }
      // Follow the rule of action batch
      if (batched) {
        eventObj = {
          type: actionInfo.event || payloadType,
          escapeConnect,
          batch: eventObjBatch
        };
      } else {
        eventObj = eventObjBatch[0];
      }
      this[IN_MAIN_PROCESS_KEY] = false;
      if (!silent) {
        var messageCenter = this._messageCenter;
        messageCenter.trigger(eventObj.type, eventObj);
        // Extra triggered 'selectchanged' event
        if (isSelectChange) {
          var newObj = {
            type: 'selectchanged',
            escapeConnect,
            selected: getAllSelectedIndices(ecModel),
            isFromClick: payload.isFromClick || false,
            fromAction: payload.type,
            fromActionPayload: payload
          };
          messageCenter.trigger(newObj.type, newObj);
        }
      }
    };
    flushPendingActions = function (silent) {
      var pendingActions = this._pendingActions;
      while (pendingActions.length) {
        var payload = pendingActions.shift();
        doDispatchAction.call(this, payload, silent);
      }
    };
    triggerUpdatedEvent = function (silent) {
      !silent && this.trigger('updated');
    };
    /**
     * Event `rendered` is triggered when zr
     * rendered. It is useful for realtime
     * snapshot (reflect animation).
     *
     * Event `finished` is triggered when:
     * (1) zrender rendering finished.
     * (2) initial animation finished.
     * (3) progressive rendering finished.
     * (4) no pending action.
     * (5) no delayed setOption needs to be processed.
     */
    bindRenderedEvent = function (zr, ecIns) {
      zr.on('rendered', (params) => {
        ecIns.trigger('rendered', params);
        // The `finished` event should not be triggered repeatedly,
        // so it should only be triggered when rendering indeed happens
        // in zrender. (Consider the case that dipatchAction is keep
        // triggering when mouse move).
        if (
          // Although zr is dirty if initial animation is not finished
          // and this checking is called on frame, we also check
          // animation finished for robustness.
          zr.animation.isFinished() &&
          !ecIns[PENDING_UPDATE] &&
          !ecIns._scheduler.unfinished &&
          !ecIns._pendingActions.length) {
          ecIns.trigger('finished');
        }
      });
    };
    bindMouseEvent = function (zr, ecIns) {
      zr.on('mouseover', (e) => {
        var el = e.target;
        var dispatcher = findEventDispatcher(el, isHighDownDispatcher);
        if (dispatcher) {
          handleGlobalMouseOverForHighDown(dispatcher, e, ecIns._api);
          markStatusToUpdate(ecIns);
        }
      }).on('mouseout', (e) => {
        var el = e.target;
        var dispatcher = findEventDispatcher(el, isHighDownDispatcher);
        if (dispatcher) {
          handleGlobalMouseOutForHighDown(dispatcher, e, ecIns._api);
          markStatusToUpdate(ecIns);
        }
      }).on('click', (e) => {
        var el = e.target;
        var dispatcher = findEventDispatcher(el, (target) => getECData(target).dataIndex != null, true);
        if (dispatcher) {
          var actionType = dispatcher.selected ? 'unselect' : 'select';
          var ecData = getECData(dispatcher);
          ecIns._api.dispatchAction({
            type: actionType,
            dataType: ecData.dataType,
            dataIndexInside: ecData.dataIndex,
            seriesIndex: ecData.seriesIndex,
            isFromClick: true
          });
        }
      });
    };

    function clearColorPalette(ecModel) {
      ecModel.clearColorPalette();
      ecModel.eachSeries((seriesModel) => {
        seriesModel.clearColorPalette();
      });
    }


    // Allocate zlevels for series and components
    function allocateZlevels(ecModel) {
      var componentZLevels = [];
      var seriesZLevels = [];
      var hasSeparateZLevel = false;
      ecModel.eachComponent((componentType, componentModel) => {
        var zlevel = componentModel.get('zlevel') || 0;
        var z = componentModel.get('z') || 0;
        var zlevelKey = componentModel.getZLevelKey();
        hasSeparateZLevel = hasSeparateZLevel || !!zlevelKey;
        (componentType === 'series' ? seriesZLevels : componentZLevels).push({
          zlevel,
          z,
          idx: componentModel.componentIndex,
          type: componentType,
          key: zlevelKey
        });
      });
      if (hasSeparateZLevel) {
        // Series after component
        var zLevels = componentZLevels.concat(seriesZLevels);
        var lastSeriesZLevel_1;
        var lastSeriesKey_1;
        timsort(zLevels, (a, b) => {
          if (a.zlevel === b.zlevel) {
            return a.z - b.z;
          }
          return a.zlevel - b.zlevel;
        });
        each(zLevels, (item) => {
          var componentModel = ecModel.getComponent(item.type, item.idx);
          var zlevel = item.zlevel;
          var key = item.key;
          if (lastSeriesZLevel_1 != null) {
            zlevel = Math.max(lastSeriesZLevel_1, zlevel);
          }
          if (key) {
            if (zlevel === lastSeriesZLevel_1 && key !== lastSeriesKey_1) {
              zlevel++;
            }
            lastSeriesKey_1 = key;
          } else if (lastSeriesKey_1) {
            if (zlevel === lastSeriesZLevel_1) {
              zlevel++;
            }
            lastSeriesKey_1 = '';
          }
          lastSeriesZLevel_1 = zlevel;
          componentModel.setZLevel(zlevel);
        });
      }
    }

    render = function (ecIns, ecModel, api, payload, updateParams) {
      allocateZlevels(ecModel);
      renderComponents(ecIns, ecModel, api, payload, updateParams);
      each(ecIns._chartsViews, (chart) => {
        chart.__alive = false;
      });
      renderSeries(ecIns, ecModel, api, payload, updateParams);
      // Remove groups of unrendered charts
      each(ecIns._chartsViews, (chart) => {
        if (!chart.__alive) {
          chart.remove(ecModel, api);
        }
      });
    };
    renderComponents = function (ecIns, ecModel, api, payload, updateParams, dirtyList) {
      each(dirtyList || ecIns._componentsViews, (componentView) => {
        var componentModel = componentView.__model;
        clearStates(componentModel, componentView);
        componentView.render(componentModel, ecModel, api, payload);
        updateZ(componentModel, componentView);
        updateStates(componentModel, componentView);
      });
    };
    /**
     * Render each chart and component
     */
    renderSeries = function (ecIns, ecModel, api, payload, updateParams, dirtyMap) {
      // Render all charts
      var scheduler = ecIns._scheduler;
      updateParams = extend(updateParams || {}, {
        updatedSeries: ecModel.getSeries()
      });
      // TODO progressive?
      lifecycle.trigger('series:beforeupdate', ecModel, api, updateParams);
      var unfinished = false;

      console.time('eachSeries-render');
      ecModel.eachSeries((seriesModel) => {
        var chartView = ecIns._chartsMap[seriesModel.__viewId];
        chartView.__alive = true;
        var renderTask = chartView.renderTask;
        scheduler.updatePayload(renderTask, payload);
        // TODO states on marker.
        clearStates(seriesModel, chartView);
        if (dirtyMap && dirtyMap.get(seriesModel.uid)) {
          renderTask.dirty();
        }
        console.time(`${seriesModel.__viewId}---perform`);
        if (renderTask.perform(scheduler.getPerformArgs(renderTask))) {
          unfinished = true;
        }
        console.timeEnd(`${seriesModel.__viewId}---perform`);

        chartView.group.silent = !!seriesModel.get('silent');
        // Should not call markRedraw on group, because it will disable zrender
        // incremental render (always render from the __startIndex each frame)
        // chartView.group.markRedraw();
        updateBlend(seriesModel, chartView);
        updateSeriesElementSelection(seriesModel);
      });
      console.timeEnd('eachSeries-render');


      scheduler.unfinished = unfinished || scheduler.unfinished;
      lifecycle.trigger('series:layoutlabels', ecModel, api, updateParams);
      // transition after label is layouted.
      lifecycle.trigger('series:transition', ecModel, api, updateParams);
      ecModel.eachSeries((seriesModel) => {
        var chartView = ecIns._chartsMap[seriesModel.__viewId];
        // Update Z after labels updated. Before applying states.
        updateZ(seriesModel, chartView);
        // NOTE: Update states after label is updated.
        // label should be in normal status when layouting.
        updateStates(seriesModel, chartView);
      });
      // If use hover layer
      // updateHoverLayerStatus(ecIns, ecModel);
      lifecycle.trigger('series:afterupdate', ecModel, api, updateParams);
    };
    markStatusToUpdate = function (ecIns) {
      ecIns[STATUS_NEEDS_UPDATE_KEY] = true;
      // Wake up zrender if it's sleep. Let it update states in the next frame.
      ecIns.getZr().wakeUp();
    };
    applyChangedStates = function (ecIns) {
      if (!ecIns[STATUS_NEEDS_UPDATE_KEY]) {
        return;
      }
      // ecIns.getZr().storage.traverse((el) => {
      //   // Not applied on removed elements, it may still in fading.
      //   if (graphic.isElementRemoved(el)) {
      //     return;
      //   }
      //   applyElementStates(el);
      // });
      ecIns[STATUS_NEEDS_UPDATE_KEY] = false;
    };

    function applyElementStates(el) {
      var newStates = [];
      var oldStates = el.currentStates;
      // Keep other states.
      for (let i = 0; i < oldStates.length; i++) {
        var stateName = oldStates[i];
        if (!(stateName === 'emphasis' || stateName === 'blur' || stateName === 'select')) {
          newStates.push(stateName);
        }
      }
      // Only use states when it's exists.
      if (el.selected && el.states.select) {
        newStates.push('select');
      }
      if (el.hoverState === HOVER_STATE_EMPHASIS && el.states.emphasis) {
        newStates.push('emphasis');
      } else if (el.hoverState === HOVER_STATE_BLUR && el.states.blur) {
        newStates.push('blur');
      }
      el.useStates(newStates);
    }

    function updateHoverLayerStatus(ecIns, ecModel) {
      var zr = ecIns._zr;
      var storage = zr.storage;
      var elCount = 0;
      storage.traverse((el) => {
        if (!el.isGroup) {
          elCount++;
        }
      });
      if (elCount > ecModel.get('hoverLayerThreshold') && !env.node && !env.worker) {
        ecModel.eachSeries((seriesModel) => {
          if (seriesModel.preventUsingHoverLayer) {
            return;
          }
          var chartView = ecIns._chartsMap[seriesModel.__viewId];
          if (chartView.__alive) {
            chartView.eachRendered((el) => {
              if (el.states.emphasis) {
                el.states.emphasis.hoverLayer = true;
              }
            });
          }
        });
      }
    }


    /**
     * Update chart and blend.
     */
    function updateBlend(seriesModel, chartView) {
      var blendMode = seriesModel.get('blendMode') || null;
      chartView.eachRendered((el) => {
        // FIXME marker and other components
        if (!el.isGroup) {
          // DON'T mark the element dirty. In case element is incremental and don't want to rerender.
          el.style.blend = blendMode;
        }
      });
    }


    function updateZ(model, view) {
      if (model.preventAutoZ) {
        return;
      }
      var z = model.get('z') || 0;
      var zlevel = model.get('zlevel') || 0;
      // Set z and zlevel
      view.eachRendered((el) => {
        doUpdateZ(el, z, zlevel, -Infinity);
        // Don't traverse the children because it has been traversed in _updateZ.
        return true;
      });
    }


    function doUpdateZ(el, z, zlevel, maxZ2) {
      return;
      // Group may also have textContent
      var label = el.getTextContent();
      var labelLine = el.getTextGuideLine();
      var isGroup = el.isGroup;
      if (isGroup) {
        // set z & zlevel of children elements of Group
        var children = el.childrenRef();
        for (let i = 0; i < children.length; i++) {
          maxZ2 = Math.max(doUpdateZ(children[i], z, zlevel, maxZ2), maxZ2);
        }
      } else {
        // not Group
        el.z = z;
        el.zlevel = zlevel;
        maxZ2 = Math.max(el.z2, maxZ2);
      }
      // always set z and zlevel if label/labelLine exists
      if (label) {
        label.z = z;
        label.zlevel = zlevel;
        // lift z2 of text content
        // TODO if el.emphasis.z2 is spcefied, what about textContent.
        isFinite(maxZ2) && (label.z2 = maxZ2 + 2);
      }
      if (labelLine) {
        var textGuideLineConfig = el.textGuideLineConfig;
        labelLine.z = z;
        labelLine.zlevel = zlevel;
        isFinite(maxZ2) &&
        (labelLine.z2 = maxZ2 + (textGuideLineConfig && textGuideLineConfig.showAbove ? 1 : -1));
      }
      return maxZ2;
    }

    // Clear states without animation.
    // TODO States on component.
    function clearStates(model, view) {
      view.eachRendered((el) => {
        // Not applied on removed elements, it may still in fading.
        if (graphic.isElementRemoved(el)) {
          return;
        }
        var textContent = el.getTextContent();
        var textGuide = el.getTextGuideLine();
        if (el.stateTransition) {
          el.stateTransition = null;
        }
        if (textContent && textContent.stateTransition) {
          textContent.stateTransition = null;
        }
        if (textGuide && textGuide.stateTransition) {
          textGuide.stateTransition = null;
        }
        // TODO If el is incremental.
        if (el.hasState()) {
          el.prevStates = el.currentStates;
          el.clearStates();
        } else if (el.prevStates) {
          el.prevStates = null;
        }
      });
    }

    function updateStates(model, view) {
      return;
      var stateAnimationModel = model.getModel('stateAnimation');
      var enableAnimation = model.isAnimationEnabled();
      var duration = stateAnimationModel.get('duration');
      var stateTransition = duration > 0 ? {
        duration,
        delay: stateAnimationModel.get('delay'),
        easing: stateAnimationModel.get('easing')
        // additive: stateAnimationModel.get('additive')
      } : null;
      view.eachRendered((el) => {
        if (el.states && el.states.emphasis) {
          // Not applied on removed elements, it may still in fading.
          if (graphic.isElementRemoved(el)) {
            return;
          }
          if (el instanceof graphic.Path) {
            savePathStates(el);
          }
          // Only updated on changed element. In case element is incremental and don't want to rerender.
          // TODO, a more proper way?
          if (el.__dirty) {
            var prevStates = el.prevStates;
            // Restore states without animation
            if (prevStates) {
              el.useStates(prevStates);
            }
          }
          // Update state transition and enable animation again.
          if (enableAnimation) {
            el.stateTransition = stateTransition;
            var textContent = el.getTextContent();
            var textGuide = el.getTextGuideLine();
            // TODO Is it necessary to animate label?
            if (textContent) {
              textContent.stateTransition = stateTransition;
            }
            if (textGuide) {
              textGuide.stateTransition = stateTransition;
            }
          }
          // Use highlighted and selected flag to toggle states.
          if (el.__dirty) {
            applyElementStates(el);
          }
        }
      });
    }

    createExtensionAPI = function (ecIns) {
      return new (/** @class */ (function (_super) {
        __extends(class_1, _super);

        function class_1() {
          return _super !== null && _super.apply(this, arguments) || this;
        }

        class_1.prototype.getCoordinateSystems = function () {
          return ecIns._coordSysMgr.getCoordinateSystems();
        };
        class_1.prototype.getComponentByElement = function (el) {
          while (el) {
            var modelInfo = el.__ecComponentInfo;
            if (modelInfo != null) {
              return ecIns._model.getComponent(modelInfo.mainType, modelInfo.index);
            }
            el = el.parent;
          }
        };
        class_1.prototype.enterEmphasis = function (el, highlightDigit) {
          enterEmphasis(el, highlightDigit);
          markStatusToUpdate(ecIns);
        };
        class_1.prototype.leaveEmphasis = function (el, highlightDigit) {
          leaveEmphasis(el, highlightDigit);
          markStatusToUpdate(ecIns);
        };
        class_1.prototype.enterBlur = function (el) {
          enterBlur(el);
          markStatusToUpdate(ecIns);
        };
        class_1.prototype.leaveBlur = function (el) {
          leaveBlur(el);
          markStatusToUpdate(ecIns);
        };
        class_1.prototype.enterSelect = function (el) {
          enterSelect(el);
          markStatusToUpdate(ecIns);
        };
        class_1.prototype.leaveSelect = function (el) {
          leaveSelect(el);
          markStatusToUpdate(ecIns);
        };
        class_1.prototype.getModel = function () {
          return ecIns.getModel();
        };
        class_1.prototype.getViewOfComponentModel = function (componentModel) {
          return ecIns.getViewOfComponentModel(componentModel);
        };
        class_1.prototype.getViewOfSeriesModel = function (seriesModel) {
          return ecIns.getViewOfSeriesModel(seriesModel);
        };
        return class_1;
      }(ExtensionAPI)))(ecIns);
    };
    enableConnect = function (chart) {
      function updateConnectedChartsStatus(charts, status) {
        for (let i = 0; i < charts.length; i++) {
          var otherChart = charts[i];
          otherChart[CONNECT_STATUS_KEY] = status;
        }
      }

      each(eventActionMap, (actionType, eventType) => {
        chart._messageCenter.on(eventType, (event) => {
          if (connectedGroups[chart.group] && chart[CONNECT_STATUS_KEY] !== CONNECT_STATUS_PENDING) {
            if (event && event.escapeConnect) {
              return;
            }
            var action_1 = chart.makeActionFromEvent(event);
            var otherCharts_1 = [];
            each(instances, (otherChart) => {
              if (otherChart !== chart && otherChart.group === chart.group) {
                otherCharts_1.push(otherChart);
              }
            });
            updateConnectedChartsStatus(otherCharts_1, CONNECT_STATUS_PENDING);
            each(otherCharts_1, (otherChart) => {
              if (otherChart[CONNECT_STATUS_KEY] !== CONNECT_STATUS_UPDATING) {
                otherChart.dispatchAction(action_1);
              }
            });
            updateConnectedChartsStatus(otherCharts_1, CONNECT_STATUS_UPDATED);
          }
        });
      });
    };
  }());
  return ECharts;
}(Eventful));
const echartsProto = ECharts.prototype;
echartsProto.on = createRegisterEventWithLowercaseECharts('on');
echartsProto.off = createRegisterEventWithLowercaseECharts('off');
/**
 * @deprecated
 */
// @ts-ignore
echartsProto.one = function (eventName, cb, ctx) {
  var self = this;
  deprecateLog('ECharts#one is deprecated.');

  function wrapped() {
    var args2 = [];
    for (let _i = 0; _i < arguments.length; _i++) {
      // eslint-disable-next-line prefer-rest-params
      args2[_i] = arguments[_i];
    }
    cb && cb.apply && cb.apply(this, args2);
    // @ts-ignore
    self.off(eventName, wrapped);
  }

  // @ts-ignore
  this.on.call(this, eventName, wrapped, ctx);
};
const MOUSE_EVENT_NAMES = [
  'click', 'dblclick', 'mouseover', 'mouseout', 'mousemove',
  'mousedown', 'mouseup', 'globalout', 'contextmenu'
];

function disposedWarning(id) {
  // eslint-disable-next-line no-undef
  if (self.__DEV__) {
    warn(`Instance ${id} has been disposed`);
  }
}

const actions = {};
/**
 * Map eventType to actionType
 */
const eventActionMap = {};
const dataProcessorFuncs = [];
const optionPreprocessorFuncs = [];
const visualFuncs = [];
const themeStorage = {};
const loadingEffects = {};
const instances = {};
const connectedGroups = {};
let idBase = +(new Date()) - 0;
let groupIdBase = +(new Date()) - 0;
const DOM_ATTRIBUTE_KEY = '_echarts_instance_';

/**
 * @param opts.devicePixelRatio Use window.devicePixelRatio by default
 * @param opts.renderer Can choose 'canvas' or 'svg' to render the chart.
 * @param opts.width Use clientWidth of the input `dom` by default.
 *        Can be 'auto' (the same as null/undefined)
 * @param opts.height Use clientHeight of the input `dom` by default.
 *        Can be 'auto' (the same as null/undefined)
 * @param opts.locale Specify the locale.
 * @param opts.useDirtyRect Enable dirty rectangle rendering or not.
 */
export function init(dom, theme, opts) {
  var isClient = !(opts && opts.ssr);
  if (isClient) {
    // eslint-disable-next-line no-undef
    if (self.__DEV__) {
      if (!dom) {
        throw new Error('Initialize failed: invalid dom.');
      }
    }
    var existInstance = getInstanceByDom(dom);
    if (existInstance) {
      // eslint-disable-next-line no-undef
      if (self.__DEV__) {
        warn('There is a chart instance already initialized on the dom.');
      }
      return existInstance;
    }
    // eslint-disable-next-line no-undef
    if (self.__DEV__) {
      if (isDom(dom) &&
        dom.nodeName.toUpperCase() !== 'CANVAS' &&
        ((!dom.clientWidth && (!opts || opts.width == null)) ||
          (!dom.clientHeight && (!opts || opts.height == null)))) {
        warn('Can\'t get DOM width or height. Please check ' +
          'dom.clientWidth and dom.clientHeight. They should not be 0.' +
          'For example, you may need to call this in the callback ' +
          'of window.onload.');
      }
    }
  }
  var chart = new ECharts(dom, theme, opts);
  chart.id = `ec_${idBase++}`;
  instances[chart.id] = chart;
  isClient && modelUtil.setAttribute(dom, DOM_ATTRIBUTE_KEY, chart.id);
  enableConnect(chart);
  lifecycle.trigger('afterinit', chart);
  return chart;
}

/**
 * @usage
 * (A)
 * ```js
 * let chart1 = echarts.init(dom1);
 * let chart2 = echarts.init(dom2);
 * chart1.group = 'xxx';
 * chart2.group = 'xxx';
 * echarts.connect('xxx');
 * ```
 * (B)
 * ```js
 * let chart1 = echarts.init(dom1);
 * let chart2 = echarts.init(dom2);
 * echarts.connect('xxx', [chart1, chart2]);
 * ```
 */
export function connect(groupId) {
  // Is array of charts
  if (isArray(groupId)) {
    var charts = groupId;
    groupId = null;
    // If any chart has group
    each(charts, (chart) => {
      if (chart.group != null) {
        groupId = chart.group;
      }
    });
    groupId = groupId || (`g_${groupIdBase++}`);
    each(charts, (chart) => {
      chart.group = groupId;
    });
  }
  connectedGroups[groupId] = true;
  return groupId;
}

export function disconnect(groupId) {
  connectedGroups[groupId] = false;
}

/**
 * Alias and backward compatibility
 * @deprecated
 */
export const disConnect = disconnect;

/**
 * Dispose a chart instance
 */
export function dispose(chart) {
  if (isString(chart)) {
    chart = instances[chart];
  } else if (!(chart instanceof ECharts)) {
    // Try to treat as dom
    chart = getInstanceByDom(chart);
  }
  if ((chart instanceof ECharts) && !chart.isDisposed()) {
    chart.dispose();
  }
}

export function getInstanceByDom(dom) {
  return instances[modelUtil.getAttribute(dom, DOM_ATTRIBUTE_KEY)];
}

export function getInstanceById(key) {
  return instances[key];
}

/**
 * Register theme
 */
export function registerTheme(name, theme) {
  themeStorage[name] = theme;
}

/**
 * Register option preprocessor
 */
export function registerPreprocessor(preprocessorFunc) {
  if (indexOf(optionPreprocessorFuncs, preprocessorFunc) < 0) {
    optionPreprocessorFuncs.push(preprocessorFunc);
  }
}

export function registerProcessor(priority, processor) {
  normalizeRegister(dataProcessorFuncs, priority, processor, PRIORITY_PROCESSOR_DEFAULT);
}

/**
 * Register postIniter
 * @param {Function} postInitFunc
 */
export function registerPostInit(postInitFunc) {
  registerUpdateLifecycle('afterinit', postInitFunc);
}

/**
 * Register postUpdater
 * @param {Function} postUpdateFunc
 */
export function registerPostUpdate(postUpdateFunc) {
  registerUpdateLifecycle('afterupdate', postUpdateFunc);
}

export function registerUpdateLifecycle(name, cb) {
  lifecycle.on(name, cb);
}

export function registerAction(actionInfo, eventName, action) {
  if (isFunction(eventName)) {
    action = eventName;
    eventName = '';
  }
  var actionType = isObject(actionInfo)
    ? actionInfo.type
    : ([actionInfo, actionInfo = {
      event: eventName
    }][0]);
  // Event name is all lowercase
  actionInfo.event = (actionInfo.event || actionType).toLowerCase();
  eventName = actionInfo.event;
  if (eventActionMap[eventName]) {
    // Already registered.
    return;
  }
  // Validate action type and event name.
  assert(ACTION_REG.test(actionType) && ACTION_REG.test(eventName));
  if (!actions[actionType]) {
    actions[actionType] = { action, actionInfo };
  }
  eventActionMap[eventName] = actionType;
}

export { registerLocale } from './locale';

function registerLayout(priority, layoutTask) {
  normalizeRegister(visualFuncs, priority, layoutTask, PRIORITY_VISUAL_LAYOUT, 'layout');
}

function registerVisual(priority, visualTask) {
  normalizeRegister(visualFuncs, priority, visualTask, PRIORITY_VISUAL_CHART, 'visual');
}

export { registerLayout, registerVisual };
const registeredTasks = [];

function normalizeRegister(targetList, priority, fn, defaultPriority, visualType) {
  if (isFunction(priority) || isObject(priority)) {
    fn = priority;
    priority = defaultPriority;
  }
  // eslint-disable-next-line no-undef
  if (self.__DEV__) {
    if (isNaN(priority) || priority == null) {
      throw new Error('Illegal priority');
    }
    // Check duplicate
    each(targetList, (wrap) => {
      assert(wrap.__raw !== fn);
    });
  }
  // Already registered
  if (indexOf(registeredTasks, fn) >= 0) {
    return;
  }
  registeredTasks.push(fn);
  var stageHandler = Scheduler.wrapStageHandler(fn, visualType);
  stageHandler.__prio = priority;
  stageHandler.__raw = fn;
  targetList.push(stageHandler);
}

export function registerLoading(name, loadingFx) {
  loadingEffects[name] = loadingFx;
}

/**
 * ZRender need a canvas context to do measureText.
 * But in node environment canvas may be created by node-canvas.
 * So we need to specify how to create a canvas instead of using document.createElement('canvas')
 *
 *
 * @deprecated use setPlatformAPI({ createCanvas }) instead.
 *
 * @example
 *     let Canvas = require('canvas');
 *     let echarts = require('echarts');
 *     echarts.setCanvasCreator(function () {
 *         // Small size is enough.
 *         return new Canvas(32, 32);
 *     });
 */
export function setCanvasCreator(creator) {
  // eslint-disable-next-line no-undef
  if (self.__DEV__) {
    deprecateLog('setCanvasCreator is deprecated. Use setPlatformAPI({ createCanvas }) instead.');
  }
  // setPlatformAPI({
  //   createCanvas: creator
  // });
}

/**
 * The parameters and usage: see `geoSourceManager.registerMap`.
 * Compatible with previous `echarts.registerMap`.
 */
export function registerMap(mapName, geoJson, specialAreas) {
  var registerMap = getImpl('registerMap');
  registerMap && registerMap(mapName, geoJson, specialAreas);
}

export function registerCoordinateSystem(type, coordSysCreator) {
  CoordinateSystemManager.register(type, coordSysCreator);
}

/**
 * Get dimensions of specified coordinate system.
 * @param {string} type
 * @return {Array.<string|Object>}
 */
export function getCoordinateSystemDimensions(type) {
  var coordSysCreator = CoordinateSystemManager.get(type);
  if (coordSysCreator) {
    return coordSysCreator.getDimensionsInfo
      ? coordSysCreator.getDimensionsInfo()
      : coordSysCreator.dimensions.slice();
  }
}

export function getMap(mapName) {
  var getMap = getImpl('getMap');
  return getMap && getMap(mapName);
}

export const registerTransform = registerExternalTransform;
/**
 * Globa dispatchAction to a specified chart instance.
 */
// export function dispatchAction(payload: { chartId: string } & Payload, opt?: Parameters<ECharts['dispatchAction']>[1]) {
//     if (!payload || !payload.chartId) {
//         // Must have chartId to find chart
//         return;
//     }
//     const chart = instances[payload.chartId];
//     if (chart) {
//         chart.dispatchAction(payload, opt);
//     }
// }
// Builtin global visual
registerVisual(PRIORITY_VISUAL_GLOBAL, seriesStyleTask);
registerVisual(PRIORITY_VISUAL_CHART_DATA_CUSTOM, dataStyleTask);
registerVisual(PRIORITY_VISUAL_CHART_DATA_CUSTOM, dataColorPaletteTask);
registerVisual(PRIORITY_VISUAL_GLOBAL, seriesSymbolTask);
registerVisual(PRIORITY_VISUAL_CHART_DATA_CUSTOM, dataSymbolTask);
registerVisual(PRIORITY_VISUAL_DECAL, decal);

registerPreprocessor(backwardCompat);
registerProcessor(PRIORITY_PROCESSOR_DATASTACK, dataStack);
// Default actions
registerAction({
  type: HIGHLIGHT_ACTION_TYPE,
  event: HIGHLIGHT_ACTION_TYPE,
  update: HIGHLIGHT_ACTION_TYPE
}, noop);
registerAction({
  type: DOWNPLAY_ACTION_TYPE,
  event: DOWNPLAY_ACTION_TYPE,
  update: DOWNPLAY_ACTION_TYPE
}, noop);
registerAction({
  type: SELECT_ACTION_TYPE,
  event: SELECT_ACTION_TYPE,
  update: SELECT_ACTION_TYPE
}, noop);
registerAction({
  type: UNSELECT_ACTION_TYPE,
  event: UNSELECT_ACTION_TYPE,
  update: UNSELECT_ACTION_TYPE
}, noop);
registerAction({
  type: TOGGLE_SELECT_ACTION_TYPE,
  event: TOGGLE_SELECT_ACTION_TYPE,
  update: TOGGLE_SELECT_ACTION_TYPE
}, noop);
// Default theme
registerTheme('light', lightTheme);
registerTheme('dark', darkTheme);
// For backward compatibility, where the namespace `dataTool` will
// be mounted on `echarts` is the extension `dataTool` is imported.
export const dataTool = {};
