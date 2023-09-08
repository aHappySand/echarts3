import env from './core/env';

let dpr = 1;
if (env.hasGlobalWindow) {
  dpr = Math.max(window.devicePixelRatio ||
    (window.screen && window.screen.deviceXDPI / window.screen.logicalXDPI) ||
    1, 1);
}
export const debugMode = 0;
export const devicePixelRatio = dpr;
export const DARK_MODE_THRESHOLD = 0.4;
export const DARK_LABEL_COLOR = '#333';
export const LIGHT_LABEL_COLOR = '#ccc';
export const LIGHTER_LABEL_COLOR = '#eee';
