<template>
  <div class="fill" ref="container">
    <svg ref="svg" class="fill"></svg>
  </div>
</template>

<script>
import * as d3 from 'd3';
import Vue from 'vue';

import ChartTip from './ChartTip.js';

Vue.use(ChartTip);

const emitType = {
  MOUSE_MOVE_INFO: 'onMousemoveInfo',
  CLICK: 'onClick',
  AREA_SELECT: 'onSelectArea',
  AREA_SELECT_END: 'onSelectAreaEnd',
  RESIZE: 'onResize',
  SCALE: 'onScale',
  RESET: 'onReset',
  TRANSFORM: 'onTransform',
};
export default {
  name: 'container',
  mounted() {
    this.addEvent();
  },
  methods: {
    addEvent() {
      const $el = this.$refs.container;
      const { width, height } = $el.getBoundingClientRect();

      const svg = d3.select(this.$refs.svg);

      let zoom;

      const g = svg.append('g');
      g.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'transparent')
      ;


      // Add X axis
      // var x = d3.scaleLinear()
      //   .domain([0, 10])
      //   .range([40, width - 40]);

      // var x = d3.scaleOrdinal()
      //   .domain((new Array(100)).fill('').map((v, i) => `中文x${i}`))
      //   .range(d3.ticks(40, width , 100));
      // const axisX = d3.axisBottom(x);
      //
      // var xAxis = svg.append("g")
      //   .attr("transform", "translate(0," + (height - 30) + ")")
      //   .call(axisX);


      const isInit = false;
      let lastMouseE = null;

      this.lastTransform = { x: 0, y: 0, };


      function changeTransform(transform) {
        const backTransform = d3.zoomTransform(0);
        backTransform.translate(transform.x, transform.y);
        backTransform.scale(transform.k);
        zoom.transform(svg, backTransform);
      }

      this.emitZoom = (e) => {
        if (this.emitZoom.timeout) {
          clearTimeout(this.emitZoom.timeout);
        }
        this.emitZoom.timeout = setTimeout(() => {
          this.hideDieInfo();
          const transform = e.transform;
          transform.deltaY = e.sourceEvent.deltaY;

          if (transform.x > 0 || transform.y > 0) {
            console.log(transform);

            transform.x = transform.x > 0 ? 0 : transform.x;
            transform.y = transform.y > 0 ? 0 : transform.y;
            changeTransform(transform);
            return;
          }

          const rect = $el.getBoundingClientRect();

          const maxLeft = rect.width * (1 - transform.k);
          const maxTop = rect.height * (1 - transform.k);

          if (transform.x < maxLeft || transform.y < maxTop) {
            console.log(transform);
            transform.x = transform.x < maxLeft ? maxLeft : transform.x;
            transform.y = transform.y < maxTop ? maxTop : transform.y;
            changeTransform(transform);
            return;
          }


          transform.offsetLeft = lastMouseE.offsetX;
          transform.offsetTop = lastMouseE.offsetY;

          transform.wx = transform.offsetLeft / rect.width * 2 - 1;
          transform.wy = -transform.offsetTop / rect.height * 2 + 1;

          transform.xDirection = transform.x - this.lastTransform.x;
          transform.yDirection = transform.y - this.lastTransform.y;
          this.$emit(emitType.TRANSFORM, transform);
          console.log(transform);
          this.lastTransform = transform;

          g.attr('transform', e.transform);

          console.log(transform);
          // // recover the new scale
          // var newX = e.transform.rescaleX(x);
          // // update axes with these new boundaries
          // xAxis.call(d3.axisBottom(newX));
        }, 100);
      };

      this.emitMousemove = (e) => {
        if (this.emitMousemove.timeout) {
          clearTimeout(this.emitMousemove.timeout);
        }
        lastMouseE = e;
        this.emitMousemove.timeout = setTimeout(() => {
          if (!this.isZoom) {
            this.mouseEvent = e;
            this.showView = false;
            const mouse = { x: 0, y: 0 };
            this.position = [e.x - 20, e.y + 10];
            if (g) {
              const rect = $el.getBoundingClientRect();
              mouse.x = ((e.x - rect.x) / rect.width) * 2 - 1;
              mouse.y = -((e.y - rect.y) / rect.height) * 2 + 1;
              this.$emit(emitType.MOUSE_MOVE_INFO, mouse);
            }
          }
        }, 150);
      };

      zoom = d3.zoom()
        .scaleExtent([1, 40])
        .on('start', (e) => {
          this.isZoom = true;
          this.showView = false;
        })
        .on('zoom', e => {
          console.log(e);
          this.emitZoom(e);
        })
        .on('end', () => this.isZoom = false);

      svg.call(zoom)
        .on('click', e => {
          console.log(e);
          // const mouse = {x: 0, y: 0}
          // const rect = $el.getBoundingClientRect()
          // mouse.x = ( (e.x - rect.x) / rect.width ) * 2 - 1;
          // mouse.y = -( (e.y - rect.y) / rect.height ) * 2 + 1;
          // this.$emit(emitType.CLICK, mouse);
        })
        .on('contextmenu', e => e.returnValue = false)
        .on('mousemove', (e) => {
          this.emitMousemove(e);
        })
        .on('mouseout', () => {
          this.showView = false;
        });
    },

    getContainerPosition() {
      const { $el } = this;
      const {
        width,
        height,
        top,
        right,
        bottom,
        left
      } = $el.getBoundingClientRect();

      return {
        width,
        height,
        top,
        right,
        bottom,
        left,
        offsetLeft: $el.offsetLeft,
        offsetTop: $el.offsetTop,
        // target: $el,
      };
    },
    hideDieInfo() {
      this.$chartTip.close();
    },
    mousemoveInfo(info) {
      if (info && this.mouseEvent) {
        this.showDieInfo({ data: info, e: this.mouseEvent });
      } else {
        this.hideDieInfo();
      }
    },
    showDieInfo({ data, e }) {
      this.$chartTip({
        tips: data,
        position: {
          left: e.pageX,
          top: e.pageY,
        }
      });
    },
    cloneEvent(e) {
      const propertys = ['isTrusted',
        'altKey',
        'altitudeAngle',
        'azimuthAngle',
        'bubbles',
        'button',
        'buttons',
        'cancelBubble',
        'cancelable',
        'clientX',
        'clientY',
        'composed',
        'ctrlKey',
        'currentTarget',
        'defaultPrevented',
        'detail',
        'eventPhase',
        'fromElement',
        'height',
        'isPrimary',
        'layerX',
        'layerY',
        'metaKey',
        'movementX',
        'movementY',
        'offsetX',
        'offsetY',
        'pageX',
        'pageY',
        'pointerId',
        'pointerType',
        'pressure',
        'relatedTarget',
        'returnValue',
        'screenX',
        'screenY',
        'shiftKey',
        'tangentialPressure',
        'tiltX',
        'tiltY',
        'timeStamp',
        'twist',
        'type',
        'which',
        'width',
        'x',
        'y',];
      const event = {};
      propertys.forEach(field => {
        event[field] = e[field];
      });
      return event;
    },
    cloneDom(dom) {
      const propertys = [
        'clientHeight',
        'clientLeft',
        'clientWidth',
        'clientTop',
      ];

      const { bottom, height, left, top, right, width, x, y } = dom.getBoundingClientRect();

      const elem = {
        rect: { bottom, height, left, top, right, width, x, y }
      };
      propertys.forEach(field => {
        elem[field] = dom[field];
      });

      return elem;
    }
  }
};
</script>

<style scoped>

</style>
