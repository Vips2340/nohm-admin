var Cookie = require('request/vendor/cookie/index.js');
var async = require('async');
var json = require('async');

module.exports.setJson = function (new_json) {
  json = new_json;
};

var createDummies = module.exports.createDummies = function (json, password, callback) {
  var creates = [];
  var creator = function (name) {
    return function (next) {
      post(json, '/User/', {
        name: name,
        password: password
      }, function (err, res, body) {
        var error;
        if (body.result !== 'success') {
          console.log(body);
          error = new Error('failed to create dummy user');
        }
        next(error);
      });
    };
  };
  
  for (var i = 1, len = 10; i <= len; i++) {
    creates.push(creator('test_user'+i));
  }
  
  async.series(creates, callback);
};


var getCookie = module.exports.getCookie = function (res, key) {
  // todo req cookies alreadyd set?
  
  return res.headers['set-cookie'].reduce(function (value, item) {
    var cookie = new Cookie(item);
    if (cookie.name === key) {
      return cookie;
    } else {
      return value;
    }
  }, false);
};

var getCsrf = module.exports.getCsrf  = function (json, callback) {
  json.get(json.base_url+'/Util/csrf', function (err, res, body) {
    var token = getCookie(res, body.data)[body.data];
    callback(token);
  });
};

var putPostDel = function (method, json, uri, data, callback) {
  getCsrf(json, function(token) {
    data["csrf-token"] = token
    json[method]({
        uri: json.base_url+uri,
        body: JSON.stringify(data)
      }, callback);
  });
};

var post = module.exports.post = function (json, uri, data, callback) {
  putPostDel('post', json, uri, data, callback);
};

var put = module.exports.put = function (json, uri, data, callback) {
  putPostDel('put', json, uri, data, callback);
};

var del = module.exports.del = function (json, uri, data, callback) {
  putPostDel('del', json, uri, data, callback);
};

var testError = module.exports.testError = function (t, result, name, msg) {
  var should = {
    result: "error",
    data: {
      error: {
        name: name,
        msg: msg
      }
    }
  };
  t.deepEqual(result, should, 'Error was incorrect');
};

module.exports.needsLogin = function (t, result) {
  testError(t, result, 'AuthError', 'need_login');
};

module.exports.notFound = function (t, result) {
  testError(t, result, 'Error', 'Resource not available with given METHOD and URL.');
};

module.exports.testNohmError = function (t, result, errors) {
  var should = {
    result: "error",
    data: {
      error: 'invalid',
      fields: errors
    }
  };
  t.deepEqual(result, should, 'Error was incorrect');
};

var testSuccess = module.exports.testSuccess = function (t, result, data) {
  var should = {
    result: "success",
    data: data
  };
  t.deepEqual(result, should, 'Successful request was incorrect');
};



var login = module.exports.login = function (name, pw, callback) {
  if (typeof(name) === 'function') {
    callback = name;
    name = 'test_user1';
    pw = 'test_pw';
  }
  logout(function () {
    post(json, '/User/login', {
       name: name,
       password: pw
      }, function (err, res, body) {
      if (body.result !== 'success') {
        console.log('login failed', body);
        process.exit();
      }
      callback(err, res, body);
    });
  });
};

var logout = module.exports.logout = function (callback) {
  json.get(json.base_url+'/User/logout', function (err, res, body) {
    if (body.result !== 'success') {
      console.log(body);
      process.exit();
    }
    callback();
  });
};

