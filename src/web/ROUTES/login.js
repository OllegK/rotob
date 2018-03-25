'use strict';

module.exports = (ctx, next) => {
  console.log('test');
  ctx.body = '{id_token: "id_token", access_token: "access_token"}';

  /*JSON.stringify({
    id_token: id_token,
    access_token: access_token
  })*/
};
