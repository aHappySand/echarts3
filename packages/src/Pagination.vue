<template>
  <div class="z-pagination z-pagination--small">
    <span class="z-pagination__total">共 {{total}} 条</span>
    <button type="button" class="btn-prev" :disabled="internalCurrentPage === 1" @click="handlePrev">
      <i class="z-icon z-icon-arrow-left"></i>
    </button>
    <button type="button" class="btn-next" :disabled="internalCurrentPage === totalPage" @click="handleNext">
      <i class="z-icon z-icon-arrow-right"></i>
    </button>
    <span class="z-pagination__jump">前往
      <div class="z-input z-pagination__editor">
        <input type="number" autocomplete="off" v-model="inputVal" min="1" max="4" @change="handleInput" class="z-input__inner">
      </div>页 / 共 {{totalPage}} 页
    </span>
  </div>
</template>

<script>
export default {
  name: 'Pagination',
  props: {
    pageSize: {
      type: Number,
      default: 1,
    },
    total: {
      type: Number,
      default: 0,
    },
    currentPage: {
      type: Number,
      default: 1,
    }
  },
  data() {
    return {
      internalCurrentPage: this.currentPage,
      inputVal: this.currentPage,
    };
  },
  computed: {
    totalPage() {
      return Math.ceil(this.total / this.pageSize);
    },
  },
  watch: {
    currentPage(val) {
      const old = this.internalCurrentPage;
      this.internalCurrentPage = this.getValidCurrentPage(val);
      if (old !== this.internalCurrentPage) {
        this.inputVal = this.internalCurrentPage;
      }
    },
    internalCurrentPage(val) {
      this.$emit('update:currentPage', val);
    },
  },
  methods: {
    handlePrev() {
      if (this.internalCurrentPage <= 1) {
        return false;
      }
      this.internalCurrentPage--;
      this.emitChange();
    },
    handleNext() {
      if (this.internalCurrentPage >= this.totalPage) {
        return false;
      }
      this.internalCurrentPage++;
      this.emitChange();
    },
    handleInput() {
      const old = this.internalCurrentPage;
      this.internalCurrentPage = this.getValidCurrentPage(this.inputVal);
      if (old !== this.internalCurrentPage) {
        this.emitChange();
      } else {
        this.inputVal = this.internalCurrentPage;
      }
    },
    getValidCurrentPage(value) {
      value = parseInt(value, 10);

      const havePageCount = typeof this.totalPage === 'number';

      let resetValue;
      if (!havePageCount) {
        if (isNaN(value) || value < 1) resetValue = 1;
      } else {
        if (value < 1) {
          resetValue = 1;
        } else if (value > this.totalPage) {
          resetValue = this.totalPage;
        }
      }

      if (resetValue === undefined && isNaN(value)) {
        resetValue = 1;
      }

      return resetValue === undefined ? value : resetValue;
    },
    emitChange() {
      this.inputVal = this.internalCurrentPage;
      this.$nextTick(() => {
        this.$emit('current-change', this.internalCurrentPage);
      });
    }
  }
};
</script>

<style lang="less" scoped>
  .z-pagination {
    white-space: nowrap;
    padding: 2px 5px;
    color: #303133;

    &::after, &::before {
      display: table;
      content: "";
    }

    &::after {
      clear: both;
    }

    .z-pagination__total {
      margin-right: 10px;
      font-weight: 400;
      color: #606266;
    }

    span:not([class*=suffix]) {
      display: inline-block;
      font-size: 13px;
      min-width: 35.5px;
      height: 28px;
      line-height: 28px;
      vertical-align: top;
      -webkit-box-sizing: border-box;
      box-sizing: border-box;
    }

    .btn-prev,.btn-next {
      background: center center no-repeat #FFF;
      background-size: 16px;
      cursor: pointer;
      margin: 0;
      color: #303133;

    }

    .z-icon {
        /* 用border值来控制箭头粗细 */
        border: 3px solid black;
        /* 上、右、下、左  四个边框的宽度 */
        border-width: 0px 1px 1px 0px;
        display: inline-block;
        /* padding值控制箭头大小 */
        padding: 4px;
    }

    .btn-prev {
      padding-right: 12px;

      i {
        transform: rotate(135deg);
        -webkit-transform: rotate(135deg);
      }
    }

    .btn-next {
      padding-left: 12px;
      i {
        transform: rotate(-45deg);
        -webkit-transform: rotate(-45deg);
      }
    }


    .z-pagination__jump {
      margin-left: 24px;
      font-weight: 400;
      color: #606266;


      .z-pagination__editor{
        height: 27px;
        display: inline-block;
        line-height: 18px;
        padding: 0 2px;
        text-align: center;
        margin: 0 2px;
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
        border-radius: 3px;

      }

      /deep/ .z-input__inner {
        padding: 0 3px;
        text-align: center;
        line-height: normal;
        background-color: #FFF;
        background-image: none;
        border-radius: 4px;
        border: 1px solid #DCDFE6;
        box-sizing: border-box;
        color: #606266;
        display: inline-block;
        height: 40px;
        outline: 0;
        -webkit-transition: border-color .2s cubic-bezier(.645,.045,.355,1);
        transition: border-color .2s cubic-bezier(.645,.045,.355,1);
        width: 100%;
      }
    }

    .z-input {
      position: relative;
      font-size: 14px;
    }

    /* 去除webkit中input的type="number"时出现的上下图标 */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }

    input[type="number"] {
      -moz-appearance: textfield;
    }

    button:disabled {
      color: #C0C4CC;
      background-color: #FFF;
      cursor: not-allowed;

      i {
        border-color: #C0C4CC;
      }
    }
  }

  .z-pagination--small {
    span:not([class*=suffix]) {
      height: 22px;
      line-height: 22px;
    }

    .btn-prev, .btn-next {
      border-color: transparent;
      font-size: 12px;
      line-height: 22px;
      height: 22px;
      min-width: 22px;
    }

    .z-pagination__editor.z-input{
      height: 22px;
      .z-input__inner {
        height: 22px;
        width: 70px;
      }
    }
  }
</style>
