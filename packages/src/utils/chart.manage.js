import {
  RenderManager,

} from './chart.render.js';

import { VirtualDom } from '../virtual';

import * as echarts from '../../echarts/index.js';


const postMsg = self.postMessage;


function Container({ gridData, props }) {
  this.gridData = gridData;

  this.setProps(props);

  this.render = new RenderManager(this.props);
  this.splitCanvas(gridData);

  Object.defineProperty(this, 'inited', {
    get() {
      return true;
    }
  });
}

Container.prototype = {
  setProps(props) {
    const defaultOptions = {
      row: 1,
      col: 1,
      page: 1,
      canBoxChoose: 1, // 0不可以，1单次框选，2多次框选
      canSingleChoose: true,
    };
    props.virtualCanvas = VirtualDom(props.virtualCanvas);
    this.props = Object.assign(this.props || {}, defaultOptions, props);
  },
  get row() {
    return this.props.row;
  },
  get col() {
    return this.props.col;
  },
  get width() {
    return this.props.width;
  },
  get height() {
    return this.props.height - (this.gridData.length > 1 ? 32 : 0);
  },
  get page() {
    return this.props.page;
  },
  get preNum() {
    return (this.page - 1) * this.gridSize;
  },
  get gridSize() {
    return this.row * this.col;
  },
  splitCanvas(gridData) {
    const total = gridData.length;
    const pageNum = Math.ceil(total / this.gridSize);
    const grid = [];
    // eslint-disable-next-line no-labels
    for_one:
    for (let p = 1; p <= pageNum; p++) {
      for (let r = 0; r < this.row; r++) {
        for (let c = 0; c < this.col; c++) {
          const index = (p - 1) * this.gridSize + r * this.row + c;
          const gData = gridData[index];
          if (gData) {
            const objGrid = new GridManager({
              index,
              container: this,
              data: gData,
            });
            grid.push(objGrid);
          } else {
            // eslint-disable-next-line no-labels
            break for_one;
          }
        }
      }
    }
    this.grid = grid;
    return this;
  },
  toJson() {
    return {
      split: (this.grid || []).map(gManager => gManager.toJson()),
    };
  },
  directDraw({ items, theme, chartOpts }) {
    const scenes = [];
    items.forEach(({ dom, index }) => {
      const grid = this.grid[index];
      grid.createScene(dom, theme, chartOpts);
      grid.directDraw();
      scenes.push(grid.chart);
    });
    this.render.render(scenes);
    postMsg({ type: 'drawed' });
  },
  directDrawCurrent() {
    const size = this.row * this.col;
    const start = (this.page - 1) * size;
    const scenes = [];

    for (let i = start, last = this.page * size; i < last; i++) {
      const grid = this.grid[i];
      if (grid) {
        scenes.push(grid.scene);
      } else {
        break;
      }
    }
    scenes.length && this.render.render(scenes);
  },
  getGridByIndex(index) {
    return this.grid[index];
  },
  destroy() {
    this.gridData = null;
    this.render.destroy();
  }
};

/**
 * 每个grid的管理
 * @param options
 * @constructor
 */
let gridId = 0;
function GridManager(options) {
  const defaultOpt = {
    id: gridId++,
    scale: 1,
    chart: null,
    data: {},
  };

  options = Object.assign({}, defaultOpt, options);
  for (const key in options) {
    this[key] = options[key];
  }
  this.init();
}


GridManager.prototype = {
  createScene(dom, theme, opts) {
    if (!this.chart) {
      dom = VirtualDom(dom);

      const { render } = this.container;
      opts = opts || {};
      opts.render = render;
      this.chart = echarts.init(dom, theme, opts);
      this.addEvent();
    } else {
      const vDom = this.chart._dom;
      vDom.cloneDom(dom);
      // this.chart.updateCamera();
    }
    return this;
  },
  init() {

  },
  addEvent() {
    // this.chart.on('mouseover', (e) => {
    //   const handleType = e.event.handleType;
    //   switch (handleType) {
    //     case 'showInfo': {
    //
    //     }
    //   }
    // });
  },
  directDraw() {
    this.chart.setOption(this.data.option);
  },
  trigger(eventName, event) {
    this.container.render.trigger(eventName, event);
  },
  toJson() {
    const data = {
      // option: this.data.option,
    };

    return {
      id: this.id,
      index: this.index,
      key: this.data.key,
      data,
    };
  },
  normalEvent(event) {
    event.pickedObject = this.chart.scene.getPickedObject({ x: event.ndcX, y: event.ndcY });
  },
  handleShowInfo(event) {
    this.normalEvent(event);
    if (event.pickedObject) {
      this.hasShowInfo = true;
      event.handleType = 'showInfo';

      this.container.render.virtualCanvas.dispatchEvent(event);
    } else if (this.hasShowInfo) {
      this.hasShowInfo = false;
      postMsg({ type: this.type, index: this.index });
    }
  },
  handleOrbitControls(data) {
    this.chart.vDom.dispatchEvent(data);
  }
};


export default function () {
  return {
    /**
     * @param container {Container}
     */
    container: null,
    init(e) {
      const { options, props } = e.data;
      this.container = new Container({ gridData: options, props });
      postMsg({ type: 'init', data: this.container.toJson() });
      return this;
    },
    getGrid(e) {
      const { index, type } = e.data;
      const grid = this.container.getGridByIndex(index);
      grid.type = type;
      return grid;
    },
    draw(e) {
      this.container.directDraw(e.data);
    },

    transform(e) {
      const { transform } = e.data;
      const grid = this.getGrid(e);
      grid.scene.handleTransform(transform);
      grid.container.directDrawCurrent();
    },

    getList() {
      return { type: 'init', data: this.container.toJson() };
    },

    mousemoveInfo(e) {
      const { event } = e.data;
      const grid = this.getGrid(e);
      event.msgType = grid.type;
      grid.handleShowInfo(event);
    },

    orbitControls(e) {
      const { data } = e.data;
      const grid = this.getGrid(e);
      grid.handleOrbitControls(data);
    },

    destroy() {
      this.container.destroy();
      postMsg({ type: 'destroy' });
    }
  };
}
