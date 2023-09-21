<template>
  <div class="fill">
    <div class="fill touch-container" ref="container"></div>
  </div>
</template>

<script>
import { cloneDom, cloneEvent } from './virtual';

const emitType = {
  MOUSE_MOVE_INFO: 'onMousemoveInfo',
  CLICK: 'onClick',
  AREA_SELECT: 'onSelectArea',
  AREA_SELECT_END: 'onSelectAreaEnd',
  RESIZE: 'onResize',
  SCALE: 'onScale',
  RESET: 'onReset',
  TRANSFORM: 'onTransform',

  ORBIT_CONTROLS: 'onOrbitControls',
  DOM_PROPERTY: 'onDom',
};
export default {
  name: 'container',
  mounted() {
    this.addEvent();
  },
  methods: {
    addEvent() {
      const $el = this.$refs.container;
      const pointers = [];

      function addPointer(event) {
        pointers.push(event);
      }

      function removePointer(event) {
        for (let i = 0; i < pointers.length; i++) {
          if (pointers[i].pointerId == event.pointerId) {
            pointers.splice(i, 1);
            return;
          }
        }
      }

      this.onContextMenu = (e) => {
        e.preventDefault();
        this.$emit(emitType.ORBIT_CONTROLS, { type: 'contextmenu', event: this._cloneEvent(e) });
      };

      let hasCtrl = false;
      this.onPointerDown = (e) => {
        hasCtrl = e.ctrlKey;
        if (!hasCtrl) {
          this.$emit(emitType.ORBIT_CONTROLS, { type: 'pointerdown', event: this._cloneEvent(e) });
        }
        if (pointers.length === 0) {
          $el.setPointerCapture(e.pointerId);

          $el.addEventListener('pointermove', this.onPointerMove);
          $el.addEventListener('pointerup', this.onPointerUp);
        }

        addPointer(e);
      };

      this.onPointerMove = (e) => {
        this.$emit(emitType.ORBIT_CONTROLS, { type: 'pointermove', event: this._cloneEvent(e) });
      };

      this.onPointerUp = (e) => {
        if (!hasCtrl) {
          this.$emit(emitType.ORBIT_CONTROLS, { type: 'pointerup', event: this._cloneEvent(e) });
        }
        hasCtrl = false;
        removePointer(e);
        if (pointers.length === 0) {
          $el.releasePointerCapture(e.pointerId);
          $el.removeEventListener('pointermove', this.onPointerMove);
          $el.removeEventListener('pointerup', this.onPointerUp);
        }
      };

      this.onMouseWheel = (e) => {
        e.preventDefault();
        this.$emit(emitType.ORBIT_CONTROLS, { type: 'wheel', event: this._cloneEvent(e) });
      };

      this.onMouseMove = (e) => {
        if (this.onMouseMove.timeout) {
          clearTimeout(this.onMouseMove.timeout);
        }
        this.onMouseMove.timeout = setTimeout(() => {
          if (pointers.length === 0) {
            this.$emit(emitType.MOUSE_MOVE_INFO, { type: 'mousemove', event: this._cloneEvent(e) });
          }
        }, 100);
      };

      $el.addEventListener('contextmenu', this.onContextMenu);
      $el.addEventListener('pointerdown', this.onPointerDown);
      $el.addEventListener('pointercancel', this.onPointerUp);
      $el.addEventListener('pointermove', this.onMouseMove);
      $el.addEventListener('wheel', this.onMouseWheel, { passive: false });
    },
    emitDom() {
      this.$emit(emitType.DOM_PROPERTY, this._cloneDom());
    },
    removeEvent() {
      const $el = this.$refs.container;
      $el.removeEventListener('contextmenu', this.onContextMenu);
      $el.removeEventListener('pointerdown', this.onPointerDown);
      $el.removeEventListener('pointercancel', this.onPointerUp);
      $el.removeEventListener('wheel', this.onMouseWheel, { passive: false });
      $el.removeEventListener('pointermove', this.onPointerMove);
      $el.removeEventListener('pointerup', this.onPointerUp);
      $el.removeEventListener('pointermove', this.onMouseMove);
    },
    _cloneEvent(e) {
      const rect = this.$refs.container.getBoundingClientRect();
      const event = cloneEvent(e);
      event.ndcX = ((e.x - rect.x) / rect.width) * 2 - 1;
      event.ndcY = -((e.y - rect.y) / rect.height) * 2 + 1;
      return event;
    },
    _cloneDom() {
      const dom = this.$refs.container;
      return cloneDom(dom);
    }
  },
  beforeDestroy() {
    this.removeEvent();
  }
};
</script>

<style lang="less" scoped>
  .touch-container {
    touch-action: none;
  }
</style>
