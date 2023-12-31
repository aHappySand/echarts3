import { Shape } from 'three';

export function buildPath(_shape) {
  var x = _shape.x;
  var y = _shape.y;
  var width = _shape.width;
  var height = _shape.height;
  var r = _shape.r;
  var r1;
  var r2;
  var r3;
  var r4;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  if (typeof r === 'number') {
    r1 = r2 = r3 = r4 = r;
  } else if (r instanceof Array) {
    if (r.length === 1) {
      r1 = r2 = r3 = r4 = r[0];
    } else if (r.length === 2) {
      r1 = r3 = r[0];
      r2 = r4 = r[1];
    } else if (r.length === 3) {
      r1 = r[0];
      r2 = r4 = r[1];
      r3 = r[2];
    } else {
      r1 = r[0];
      r2 = r[1];
      r3 = r[2];
      r4 = r[3];
    }
  } else {
    r1 = r2 = r3 = r4 = 0;
  }
  var total;
  if (r1 + r2 > width) {
    total = r1 + r2;
    r1 *= width / total;
    r2 *= width / total;
  }
  if (r3 + r4 > width) {
    total = r3 + r4;
    r3 *= width / total;
    r4 *= width / total;
  }
  if (r2 + r3 > height) {
    total = r2 + r3;
    r2 *= height / total;
    r3 *= height / total;
  }
  if (r1 + r4 > height) {
    total = r1 + r4;
    r1 *= height / total;
    r4 *= height / total;
  }

  const nshape = new Shape();

  nshape.moveTo(x + r1, y);
  nshape.lineTo(x + width - r2, y);
  r2 !== 0 && nshape.arc(x + width - r2, y + r2, r2, -Math.PI / 2, 0);
  nshape.lineTo(x + width, y + height - r3);
  r3 !== 0 && nshape.arc(x + width - r3, y + height - r3, r3, 0, Math.PI / 2);
  nshape.lineTo(x + r4, y + height);
  r4 !== 0 && nshape.arc(x + r4, y + height - r4, r4, Math.PI / 2, Math.PI);
  nshape.lineTo(x, y + r1);
  r1 !== 0 && nshape.arc(x + r1, y + r1, r1, Math.PI, Math.PI * 1.5);

  return nshape;
}
