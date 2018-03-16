var koa = require ('koa');
var app = new koa();

app.use (function * () {
    this.body = 'Hello World'
})

app.listen(3000);
console.log('The app is listening. Port 3000');
