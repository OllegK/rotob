'use strict';

const Koa = require('koa');
const serve = require('koa-static');
const app = new Koa();
const opn = require('opn');
const router = require('koa-router')();
const cors = require('koa-cors');

router.get('/api/test', require('./ROUTES/test'));

app
    .use(cors())
    .use (serve(__dirname + '../vue/dist'))
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(3000);
console.log('The app is listening. Port 3000');
opn('http://localhost:3000');


