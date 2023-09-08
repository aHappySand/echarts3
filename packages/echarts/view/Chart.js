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
import { each } from '../../zrender/core/util';
import Group from '../../zrender/graphic/Group';
import * as componentUtil from '../util/component';
import * as clazzUtil from '../util/clazz';
import * as modelUtil from '../util/model';
import { enterEmphasis, leaveEmphasis, getHighlightDigit, isHighDownDispatcher } from '../util/states';
import { createTask } from '../core/task';
import { traverseElements } from '../util/graphic';
import { error } from '../util/log';

const inner = modelUtil.makeInner();
const ChartView = /** @class */ (function () {
  function ChartView() {
    this.group = new Group();
    this.uid = componentUtil.getUID('viewChart');
    this.renderTask = createTask({
      plan: null,
      reset: renderTaskReset
    });
    this.renderTask.context = { view: this };
  }

  ChartView.prototype.init = function (ecModel, api) {
  };
  ChartView.prototype.render = function (seriesModel, ecModel, api, payload) {
    if (__DEV__) {
      throw new Error('render method must been implemented');
    }
  };
  /**
   * Highlight series or specified data item.
   */
  ChartView.prototype.highlight = function (seriesModel, ecModel, api, payload) {
    var data = seriesModel.getData(payload && payload.dataType);
    if (!data) {
      if (__DEV__) {
        error(`Unknown dataType ${payload.dataType}`);
      }
      return;
    }
    toggleHighlight(data, payload, 'emphasis');
  };
  /**
   * Downplay series or specified data item.
   */
  ChartView.prototype.downplay = function (seriesModel, ecModel, api, payload) {
    var data = seriesModel.getData(payload && payload.dataType);
    if (!data) {
      if (__DEV__) {
        error(`Unknown dataType ${payload.dataType}`);
      }
      return;
    }
    toggleHighlight(data, payload, 'normal');
  };
  /**
   * Remove self.
   */
  ChartView.prototype.remove = function (ecModel, api) {
    this.group.removeAll();
  };
  /**
   * Dispose self.
   */
  ChartView.prototype.dispose = function (ecModel, api) {
  };
  ChartView.prototype.updateView = function (seriesModel, ecModel, api, payload) {
    this.render(seriesModel, ecModel, api, payload);
  };
  // FIXME never used?
  ChartView.prototype.updateLayout = function (seriesModel, ecModel, api, payload) {
    this.render(seriesModel, ecModel, api, payload);
  };
  // FIXME never used?
  ChartView.prototype.updateVisual = function (seriesModel, ecModel, api, payload) {
    this.render(seriesModel, ecModel, api, payload);
  };
  /**
   * Traverse the new rendered elements.
   *
   * It will traverse the new added element in progressive rendering.
   * And traverse all in normal rendering.
   */
  ChartView.prototype.eachRendered = function (cb) {
    traverseElements(this.group, cb);
  };
  ChartView.markUpdateMethod = function (payload, methodName) {
    inner(payload).updateMethod = methodName;
  };
  ChartView.protoInitialize = (function () {
    var proto = ChartView.prototype;
    proto.type = 'chart';
  }());
  return ChartView;
}());


/**
 * Set state of single element
 */
function elSetState(el, state, highlightDigit) {
  if (el && isHighDownDispatcher(el)) {
    (state === 'emphasis' ? enterEmphasis : leaveEmphasis)(el, highlightDigit);
  }
}

function toggleHighlight(data, payload, state) {
  var dataIndex = modelUtil.queryDataIndex(data, payload);
  var highlightDigit = (payload && payload.highlightKey != null)
    ? getHighlightDigit(payload.highlightKey)
    : null;
  if (dataIndex != null) {
    each(modelUtil.normalizeToArray(dataIndex), (dataIdx) => {
      elSetState(data.getItemGraphicEl(dataIdx), state, highlightDigit);
    });
  } else {
    data.eachItemGraphicEl((el) => {
      elSetState(el, state, highlightDigit);
    });
  }
}

clazzUtil.enableClassExtend(ChartView, ['dispose']);
clazzUtil.enableClassManagement(ChartView);

function renderTaskReset(context) {
  var seriesModel = context.model;
  var ecModel = context.ecModel;
  var api = context.api;
  var payload = context.payload;
  // FIXME: remove updateView updateVisual
  var progressiveRender = seriesModel.pipelineContext.progressiveRender;
  var view = context.view;
  var updateMethod = payload && inner(payload).updateMethod;
  var methodName = progressiveRender
    ? 'incrementalPrepareRender'
    : (updateMethod && view[updateMethod])
      ? updateMethod
      // `appendData` is also supported when data amount
      // is less than progressive threshold.
      : 'render';
  if (methodName !== 'render') {
    view[methodName](seriesModel, ecModel, api, payload);
  }
  return progressMethodMap[methodName];
}

const progressMethodMap = {
  incrementalPrepareRender: {
    progress(params, context) {
      context.view.incrementalRender(params, context.model, context.ecModel, context.api, context.payload);
    }
  },
  render: {
    // Put view.render in `progress` to support appendData. But in this case
    // view.render should not be called in reset, otherwise it will be called
    // twise. Use `forceFirstProgress` to make sure that view.render is called
    // in any cases.
    forceFirstProgress: true,
    progress(params, context) {
      context.view.render(context.model, context.ecModel, context.api, context.payload);
    }
  }
};
export default ChartView;
