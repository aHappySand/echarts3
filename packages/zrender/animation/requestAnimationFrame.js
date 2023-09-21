const _requestAnimationFrame = requestAnimationFrame || function (func) {
  return setTimeout(func, 16);
};
export default _requestAnimationFrame;
