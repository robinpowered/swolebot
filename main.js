var koa = require('koa');
var app = koa();

app.use(function *(){
	this.body = 'Its alive!';
});

app.listen(process.ENV.port || 3000);
