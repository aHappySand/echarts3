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
import { __extends } from 'tslib';
import ComponentModel from '../../model/Component';
import ComponentView from '../../view/Component';

const TitleModel = /** @class */ (function (_super) {
  __extends(TitleModel, _super);

  function TitleModel() {
    var _this = _super !== null && _super.apply(this, arguments) || this;
    _this.type = TitleModel.type;
    _this.layoutMode = { type: 'box', ignoreSize: true };
    return _this;
  }

  TitleModel.type = 'title';
  TitleModel.defaultOption = {
    // zlevel: 0,
    z: 6,
    show: true,
    text: '',
    target: 'blank',
    subtext: '',
    subtarget: 'blank',
    left: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0)',
    borderColor: '#ccc',
    borderWidth: 0,
    padding: 5,
    itemGap: 10,
    textStyle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#464646'
    },
    subtextStyle: {
      fontSize: 12,
      color: '#6E7079'
    }
  };
  return TitleModel;
}(ComponentModel));
// View
const TitleView = /** @class */ (function (_super) {
  __extends(TitleView, _super);

  function TitleView() {
    var _this = _super !== null && _super.apply(this, arguments) || this;
    _this.type = TitleView.type;
    return _this;
  }

  TitleView.prototype.render = function (titleModel, ecModel, api) {

  };
  TitleView.type = 'title';
  return TitleView;
}(ComponentView));

export function install(registers) {
  registers.registerComponentModel(TitleModel);
  registers.registerComponentView(TitleView);
}
