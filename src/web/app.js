'use strict';

var Koa = require('koa');
var app = new Koa();

app.use(function * () {
  this.body = 'Hello World';
});

app.listen(3000);
console.log('The app is listening. Port 3000');
