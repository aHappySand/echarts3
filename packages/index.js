import Echarts3 from './src/index';

/* istanbul ignore next */
Echarts3.install = function install(Vue) {
  Vue.component(Echarts3.name, Echarts3);
};

export default Echarts3;
