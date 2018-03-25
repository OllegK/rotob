'use strict';

module.exports = (ctx, next) => {
  console.log('status route is invoked');
  ctx.body = require('../../symbols').symbols;
};
