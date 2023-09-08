import { cubicSubdivide } from '../core/curve.js';
import PathProxy from '../core/PathProxy.js';

const CMD = PathProxy.CMD;

function aroundEqual(a, b) {
  return Math.abs(a - b) < 1e-5;
}

export function pathToBezierCurves(path) {
  const data = path.data;
  const len = path.len();
  const bezierArrayGroups = [];
  let currentSubpath;
  let xi = 0;
  let yi = 0;
  let x0 = 0;
  let y0 = 0;

  function createNewSubpath(x, y) {
    if (currentSubpath && currentSubpath.length > 2) {
      bezierArrayGroups.push(currentSubpath);
    }
    currentSubpath = [x, y];
  }

  // eslint-disable-next-line no-shadow
  function addLine(x0, y0, x1, y1) {
    if (!(aroundEqual(x0, x1) && aroundEqual(y0, y1))) {
      currentSubpath.push(x0, y0, x1, y1, x1, y1);
    }
  }

  function addArc(startAngle, endAngle, cx, cy, rx, ry) {
    const delta = Math.abs(endAngle - startAngle);
    const len = Math.tan(delta / 4) * 4 / 3;
    const dir = endAngle < startAngle ? -1 : 1;
    const c1 = Math.cos(startAngle);
    const s1 = Math.sin(startAngle);
    const c2 = Math.cos(endAngle);
    const s2 = Math.sin(endAngle);
    const x1 = c1 * rx + cx;
    const y1 = s1 * ry + cy;
    const x4 = c2 * rx + cx;
    const y4 = s2 * ry + cy;
    const hx = rx * len * dir;
    const hy = ry * len * dir;
    currentSubpath.push(x1 - hx * s1, y1 + hy * c1, x4 + hx * s2, y4 - hy * c2, x4, y4);
  }

  let x1;
  let y1;
  let x2;
  let y2;
  for (let i = 0; i < len;) {
    const cmd = data[i++];
    const isFirst = i === 1;
    if (isFirst) {
      xi = data[i];
      yi = data[i + 1];
      x0 = xi;
      y0 = yi;
      if (cmd === CMD.L || cmd === CMD.C || cmd === CMD.Q) {
        currentSubpath = [x0, y0];
      }
    }
    switch (cmd) {
      case CMD.M:
        xi = x0 = data[i++];
        yi = y0 = data[i++];
        createNewSubpath(x0, y0);
        break;
      case CMD.L:
        x1 = data[i++];
        y1 = data[i++];
        addLine(xi, yi, x1, y1);
        xi = x1;
        yi = y1;
        break;
      case CMD.C:
        currentSubpath.push(data[i++], data[i++], data[i++], data[i++], xi = data[i++], yi = data[i++]);
        break;
      case CMD.Q:
        x1 = data[i++];
        y1 = data[i++];
        x2 = data[i++];
        y2 = data[i++];
        currentSubpath.push(xi + 2 / 3 * (x1 - xi), yi + 2 / 3 * (y1 - yi), x2 + 2 / 3 * (x1 - x2), y2 + 2 / 3 * (y1 - y2), x2, y2);
        xi = x2;
        yi = y2;
        break;
      case CMD.A:
        var cx = data[i++];
        var cy = data[i++];
        var rx = data[i++];
        var ry = data[i++];
        var startAngle = data[i++];
        var endAngle = data[i++] + startAngle;
        i += 1;
        var anticlockwise = !data[i++];
        x1 = Math.cos(startAngle) * rx + cx;
        y1 = Math.sin(startAngle) * ry + cy;
        if (isFirst) {
          x0 = x1;
          y0 = y1;
          createNewSubpath(x0, y0);
        } else {
          addLine(xi, yi, x1, y1);
        }
        xi = Math.cos(endAngle) * rx + cx;
        yi = Math.sin(endAngle) * ry + cy;
        var step = (anticlockwise ? -1 : 1) * Math.PI / 2;
        for (let angle = startAngle; anticlockwise ? angle > endAngle : angle < endAngle; angle += step) {
          const nextAngle = anticlockwise ? Math.max(angle + step, endAngle)
            : Math.min(angle + step, endAngle);
          addArc(angle, nextAngle, cx, cy, rx, ry);
        }
        break;
      case CMD.R:
        x0 = xi = data[i++];
        y0 = yi = data[i++];
        x1 = x0 + data[i++];
        y1 = y0 + data[i++];
        createNewSubpath(x1, y0);
        addLine(x1, y0, x1, y1);
        addLine(x1, y1, x0, y1);
        addLine(x0, y1, x0, y0);
        addLine(x0, y0, x1, y0);
        break;
      case CMD.Z:
        currentSubpath && addLine(xi, yi, x0, y0);
        xi = x0;
        yi = y0;
        break;
    }
  }
  if (currentSubpath && currentSubpath.length > 2) {
    bezierArrayGroups.push(currentSubpath);
  }
  return bezierArrayGroups;
}

function adpativeBezier(x0, y0, x1, y1, x2, y2, x3, y3, out, scale) {
  if (aroundEqual(x0, x1) && aroundEqual(y0, y1) && aroundEqual(x2, x3) && aroundEqual(y2, y3)) {
    out.push(x3, y3);
    return;
  }
  const PIXEL_DISTANCE = 2 / scale;
  const PIXEL_DISTANCE_SQR = PIXEL_DISTANCE * PIXEL_DISTANCE;
  let dx = x3 - x0;
  let dy = y3 - y0;
  const d = Math.sqrt(dx * dx + dy * dy);
  dx /= d;
  dy /= d;
  const dx1 = x1 - x0;
  const dy1 = y1 - y0;
  const dx2 = x2 - x3;
  const dy2 = y2 - y3;
  const cp1LenSqr = dx1 * dx1 + dy1 * dy1;
  const cp2LenSqr = dx2 * dx2 + dy2 * dy2;
  if (cp1LenSqr < PIXEL_DISTANCE_SQR && cp2LenSqr < PIXEL_DISTANCE_SQR) {
    out.push(x3, y3);
    return;
  }
  const projLen1 = dx * dx1 + dy * dy1;
  const projLen2 = -dx * dx2 - dy * dy2;
  const d1Sqr = cp1LenSqr - projLen1 * projLen1;
  const d2Sqr = cp2LenSqr - projLen2 * projLen2;
  if (d1Sqr < PIXEL_DISTANCE_SQR && projLen1 >= 0 &&
    d2Sqr < PIXEL_DISTANCE_SQR && projLen2 >= 0) {
    out.push(x3, y3);
    return;
  }
  const tmpSegX = [];
  const tmpSegY = [];
  cubicSubdivide(x0, x1, x2, x3, 0.5, tmpSegX);
  cubicSubdivide(y0, y1, y2, y3, 0.5, tmpSegY);
  adpativeBezier(tmpSegX[0], tmpSegY[0], tmpSegX[1], tmpSegY[1], tmpSegX[2], tmpSegY[2], tmpSegX[3], tmpSegY[3], out, scale);
  adpativeBezier(tmpSegX[4], tmpSegY[4], tmpSegX[5], tmpSegY[5], tmpSegX[6], tmpSegY[6], tmpSegX[7], tmpSegY[7], out, scale);
}

export function pathToPolygons(path, scale) {
  const bezierArrayGroups = pathToBezierCurves(path);
  const polygons = [];
  scale = scale || 1;
  for (let i = 0; i < bezierArrayGroups.length; i++) {
    const beziers = bezierArrayGroups[i];
    const polygon = [];
    let x0 = beziers[0];
    let y0 = beziers[1];
    polygon.push(x0, y0);
    for (let k = 2; k < beziers.length;) {
      const x1 = beziers[k++];
      const y1 = beziers[k++];
      const x2 = beziers[k++];
      const y2 = beziers[k++];
      const x3 = beziers[k++];
      const y3 = beziers[k++];
      adpativeBezier(x0, y0, x1, y1, x2, y2, x3, y3, polygon, scale);
      x0 = x3;
      y0 = y3;
    }
    polygons.push(polygon);
  }
  return polygons;
}
