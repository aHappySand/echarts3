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
import { use } from './extension';
// ----------------------------------------------
// All of the modules that are allowed to be
// imported are listed below.
//
// Users MUST NOT import other modules that are
// not included in this list.
// ----------------------------------------------
import { ScatterChart } from './export/charts';
import { GridComponent, TitleComponent, TooltipComponent } from './export/components';

if (typeof window === 'object') {
  // eslint-disable-next-line no-global-assign
  self = window;
}
self.__DEV__ = true;

export * from './export/core';

// ----------------
// Charts (series)
// ----------------
// All of the series types, for example:
// chart.setOption({
//     series: [{
//         type: 'line' // or 'bar', 'pie', ...
//     }]
// });
use([
  ScatterChart,
]);
// -------------------
// Coordinate systems
// -------------------
// All of the axis modules have been included in the
// coordinate system module below, do not need to
// make extra import.
// `cartesian` coordinate system. For some historical
// reasons, it is named as grid, for example:
// chart.setOption({
//     grid: {...},
//     xAxis: {...},
//     yAxis: {...},
//     series: [{...}]
// });
use(GridComponent);

// `title` component, for example:
// chart.setOption({
//     title: {...}
// });
use(TitleComponent);
use(TooltipComponent);
