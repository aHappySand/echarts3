const STYLE_MAGIC_KEY = `__zr_style_${Math.round((Math.random() * 10))}`;
export const DEFAULT_COMMON_STYLE = {
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowColor: '#000',
  opacity: 1,
  blend: 'source-over'
};
export const DEFAULT_COMMON_ANIMATION_PROPS = {
  style: {
    shadowBlur: true,
    shadowOffsetX: true,
    shadowOffsetY: true,
    shadowColor: true,
    opacity: true
  }
};
DEFAULT_COMMON_STYLE[STYLE_MAGIC_KEY] = true;
