<template>
  <div class="zp-left" :class="{
    unfold: asideShowMode === 2,
    fold: asideShowMode === 1,
    hide: asideShowMode === 0,
  }">
    <div class="logo-box">
    </div>
    <el-menu
      class="menu-list"
      :default-active="activeMenu"
      :collapse="asideShowMode === 1"
      :collapse-transition="false"
      text-color="#fff"
      active-text-color="#fff"
      background-color="#2F3646"
      :menu-trigger="'click'"
    >
      <template v-for="(menu, index) in secondMenus">
        <MenuItem :menu="menu" :key="`${menu.id}`"></MenuItem>
      </template>
    </el-menu>
  </div>
</template>

<script>
import { Vuex } from 'examples/config';
import { removeUrlAnchor } from '@/utils';
import MenuItem from './MenuItem.vue';

const { mapState } = Vuex;

export default {
  name: 'Left',
  components: {
    MenuItem
  },
  provide() {
    return {
      toPage: this.handleClickMenu2,
    };
  },
  computed: {
    ...mapState('app', ['asideShowMode', 'secondMenus', 'setAside']),
    activeMenu() {
      return decodeURIComponent(removeUrlAnchor(this.$route.fullPath));
    }
  },
  data() {
    return {
    };
  },
  methods: {
    handleClickMenu2(menu) {
      const params = menu.params || {};
      const query = menu.query || {};
      const route = {
        name: 'demo',
        query: {
          ...query,
          name: menu.path,
          title: menu.title,
        },
        params: {
          ...params,
          id: menu.id,

        },
      };
      this.$router.push(route);
      return false;
    }
  }
};
</script>

<style lang="scss" scoped>
.zp-left {
  box-shadow: 1px 0px 4px 0px #ccc;
  transition: width 0.5s;

  .logo-box {
    display: flex;
    height: 40px;
    background-color: #2f3646;
    align-items: center;
    justify-content: center;

    img {
      object-fit: contain;
      max-width: 100%;
      max-height: 100%;
    }
  }

  &.unfold {
    width: 260px;
  }

  &.fold {
    width: 64px;
  }

  &.hide {
    width: 0;
  }

  ::v-deep .el-menu--collapse {
    .el-submenu__title span {
      display: inline-block;
      width: 0;
      height: 0;
      visibility: hidden;
    }

    .el-submenu__icon-arrow {
      visibility: hidden;
    }
  }
}
</style>
