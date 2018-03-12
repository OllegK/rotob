'use strict';

var axios = require('axios');
var instance = axios.create();
console.log(instance.defaults.timeout);
