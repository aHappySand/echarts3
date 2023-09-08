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
// These APIs are for more advanced usages
// For example extend charts and components, creating graphic elements, formatting.
import ComponentModel from '../model/Component';
import ComponentView from '../view/Component';
import SeriesModel from '../model/Series';
import ChartView from '../view/Chart';
import SeriesData from '../data/SeriesData';

import * as zrUtil_1 from '../../zrender/core/util';
import * as color_1 from '../../zrender/tool/color';
// --------------------- Helper Methods ---------------------
import * as number_1 from './api/number';
import * as time_1 from './api/time';
import * as graphic_1 from './api/graphic';
import * as format_1 from './api/format';
import * as util_1 from './api/util';

export { zrUtil_1 as zrUtil };

export { color_1 as color };
export { throttle } from '../util/throttle';

export { use } from '../extension';
export { setPlatformAPI } from '../../zrender/core/platform';

export { number_1 as number };

export { time_1 as time };

export { graphic_1 as graphic };

export { format_1 as format };

export { util_1 as util };
export { default as env } from '../../zrender/core/env';
// --------------------- Export for Extension Usage ---------------------
// export {SeriesData};
export { SeriesData as List }; // TODO: Compatitable with exists echarts-gl code
export { default as Model } from '../model/Model';

export { ComponentModel, ComponentView, SeriesModel, ChartView };
// Only for GL
// --------------------- Deprecated Extension Methods ---------------------
// Should use `ComponentModel.extend` or `class XXXX extend ComponentModel` to create class.
// Then use `registerComponentModel` in `install` parameter when `use` this extension. For example:
// class Bar3DModel extends ComponentModel {}
// export function install(registers) { registers.registerComponentModel(Bar3DModel); }
// echarts.use(install);
export function extendComponentModel(proto) {
  var Model = ComponentModel.extend(proto);
  ComponentModel.registerClass(Model);
  return Model;
}

export function extendComponentView(proto) {
  var View = ComponentView.extend(proto);
  ComponentView.registerClass(View);
  return View;
}

export function extendSeriesModel(proto) {
  var Model = SeriesModel.extend(proto);
  SeriesModel.registerClass(Model);
  return Model;
}

export function extendChartView(proto) {
  var View = ChartView.extend(proto);
  ChartView.registerClass(View);
  return View;
}
