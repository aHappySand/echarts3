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
import { Group3D } from '../util/graphic';
import * as componentUtil from '../util/component';
import * as clazzUtil from '../util/clazz';

const ComponentView = /** @class */ (function () {
  function ComponentView() {
    this.group = new Group3D();
    this.uid = componentUtil.getUID('viewComponent');
    return this;
  }

  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.init = function (ecModel, api) {
  };
  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.render = function (model, ecModel, api, payload) {
  };
  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.dispose = function (ecModel, api) {
  };
  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.updateView = function (model, ecModel, api, payload) {
    // Do nothing;
  };
  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.updateLayout = function (model, ecModel, api, payload) {
    // Do nothing;
  };
  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.updateVisual = function (model, ecModel, api, payload) {
    // Do nothing;
  };
  /**
   * Hook for toggle blur target series.
   * Can be used in marker for blur or leave blur the markers
   */
  // eslint-disable-next-line no-unused-vars
  ComponentView.prototype.toggleBlurSeries = function (seriesModels, isBlur, ecModel) {
    // Do nothing;
  };
  /**
   * Traverse the new rendered elements.
   *
   * It will traverse the new added element in progressive rendering.
   * And traverse all in normal rendering.
   */
  ComponentView.prototype.eachRendered = function (cb) {
    var group = this.group;
    if (group) {
      group.traverse(cb);
    }
  };
  return ComponentView;
}());

clazzUtil.enableClassExtend(ComponentView);
clazzUtil.enableClassManagement(ComponentView);
export default ComponentView;
