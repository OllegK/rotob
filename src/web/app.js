'use strict';

const botutil = require('../botutil');

const fs = require('fs');
const https = require('https');
const Koa = require('koa');
const serve = require('koa-static');
const opn = require('opn');
const router = require('koa-router')();
const cors = require('koa-cors');
const enforceHttps = require('koa-sslify');
const json = require('koa-json');

var app = new Koa();

router.get('/api/test', require('./ROUTES/test'));
router.get('/api/status', require('./ROUTES/status'));
router.get('/api/login', require('./ROUTES/login'));
router.get('/api/symbols', require('./ROUTES/symbols'));

app
  .use(cors())
  .use(json())
  .use(enforceHttps())
  .use(serve(__dirname + '/vue/dist'))
 // .use(serve(__dirname + '/vue/index.html'))
  .use(router.routes())
  .use(router.allowedMethods());

const port = process.env.HTTP_PORT || 3000;

const options = {
  key: fs.readFileSync('./src/web/ssl/node-selfsigned.key', 'utf8'),
  cert: fs.readFileSync('./src/web/ssl/node-selfsigned.crt', 'utf8'),
};

var address = botutil.getIpAddress();

https.createServer(options, app.callback()).listen(port, address);
// app.listen(port, address);

console.log(`The app is listening. Address ${address}. Port ${port}`);

if (process.env.NODE_ENV !== 'production') {
  opn(`https://${address}:${port}`);
};

