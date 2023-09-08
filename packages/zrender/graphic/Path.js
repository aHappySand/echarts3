import { DEFAULT_COMMON_STYLE, DEFAULT_COMMON_ANIMATION_PROPS } from './Displayable.js';
import { defaults } from '../core/util.js';
import { TRANSFORMABLE_PROPS } from '../core/Transformable.js';

export const DEFAULT_PATH_STYLE = defaults({
  fill: '#000',
  stroke: null,
  strokePercent: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  lineDashOffset: 0,
  lineWidth: 1,
  lineCap: 'butt',
  miterLimit: 10,
  strokeNoScale: false,
  strokeFirst: false
}, DEFAULT_COMMON_STYLE);

export const DEFAULT_PATH_ANIMATION_PROPS = {
  style: defaults({
    fill: true,
    stroke: true,
    strokePercent: true,
    fillOpacity: true,
    strokeOpacity: true,
    lineDashOffset: true,
    lineWidth: true,
    miterLimit: true
  }, DEFAULT_COMMON_ANIMATION_PROPS.style)
};
const pathCopyParams = TRANSFORMABLE_PROPS.concat(['invisible',
  'culling', 'z', 'z2', 'zlevel', 'parent'
]);
