import { Vue } from 'examples/config';

import {
} from 'main/index';

const components = [
];


components.forEach((component) => {
  Vue.use(component);
});
