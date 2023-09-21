import { Vue } from 'examples/config';

import {
  Echarts3
} from 'main/index';

const components = [
  Echarts3
];


components.forEach((component) => {
  Vue.use(component);
});
