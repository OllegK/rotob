'use strict';

module.exports = (ctx, next) => {
  console.log('status route is invoked');
  ctx.body = {starttime: "starttime", status: "running", nr: "nr"};
};
