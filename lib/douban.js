/*
* Douban API v2 helper
*/
var util = require('util');
var querystring = require('querystring');
var EventEmitter = require('events').EventEmitter;
var URL = require('url');

var API_BASE = 'https://api.douban.com';
var SEVEN_DAYS = 60 * 60 * 24 * 7;


function OAuth2(clientId, clientSecret, customHeaders) {
  this._clientId= clientId;
  this._clientSecret= clientSecret;
  this._baseSite= 'https://www.douban.com';
  this._authorizeUrl= "/service/auth2/auth";
  this._accessTokenUrl= "/service/auth2/token";
  this._accessTokenName= "access_token";
  this._authMethod= "Bearer";
  this._customHeaders = {};
}
util.inherits(OAuth2, require('oauth').OAuth2);

OAuth2.prototype.on = EventEmitter.prototype.on;
OAuth2.prototype.emit = EventEmitter.prototype.emit;

OAuth2.prototype.clientFromToken = function(token, ident) {
  var client = new Client(token, ident, this);
  return client;
};

OAuth2.prototype.getToken = function(code, params, callback) {
  this.getOAuthAccessToken(code, params, function(err, access_token, refresh_token, results) {
    if (err) return callback(err);
    results = results || {};
    results.access_token = access_token;
    results.refresh_token = refresh_token;
    // 30 seconds is time gap of douban server and local server
    results.expire_date = new Date(+new Date() + ((results.expires_in || SEVEN_DAYS) - 30) * 1000);
    return callback(null, results);
  });
};

/*
* A client binded with some token
*/
function Client(token, ident, oauth2) {
  this.oauth2 = oauth2;

  this._base_url = API_BASE;
  this._accessTokenName = 'access_token';
  this._customHeaders = {};
  this._ident = ident;

  this.init(token);
}
util.inherits(Client, EventEmitter);

Client.prototype.init = function(token) {
  token = token || {};

  this.access_token = token.access_token;
  this.refresh_token = token.refresh_token;
  this.user_id = token.douban_user_id;
  this.expire_date = token.expire_date;
};

Client.prototype._request = OAuth2.prototype._request;
Client.prototype._executeRequest = OAuth2.prototype._executeRequest;

Client.prototype._auth_headers = function() {
  if (!this.access_token) return {};
  return {
    'Authorization': 'Bearer ' + this.access_token
  };
};

Client.prototype.isExpired = function() {
  return this.dead || this.expire_date < new Date();
};

Client.prototype.request = function(method, url, data, callback) {
  var self = this;

  if (typeof data === 'function') {
    callback = data;
    data = '';
  }

  function run() {

    if (url[0] != '/') url = '/' + url;

    var parsed_url = URL.parse(self._base_url + url);

    var headers = self._auth_headers();
    var qs = parsed_url.query || {};

    method = method.toUpperCase();

    if (method === 'GET' && data) {
      for (var k in data) {
        qs[k] = data[k];
      }
      data = '';
    } else if (typeof data === 'object') {
      data = querystring.stringify(data);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    parsed_url.query = qs;

    self.oauth2._request(method, URL.format(parsed_url), headers,
     data, self.access_token || '', function(err, body, res) {
      var ret;
      if (err) {
        if (err.statusCode >= 300) {
          return callback(err);
        }
        ret = {
          statusCode: err.statusCode
        };
        err = null;
      } else {
        try {
          ret = JSON.parse(body);
        } catch (e) {
          throw new Error('Parse api response failedd');
        }
      }
      callback(err, ret, res);
    });
  }

  if (!self.isExpired()) return run();

  // if has expired, refresh it
  self.refresh(function(err, new_token) {
    self.init(new_token);
    run();
  });
};

Client.prototype.refresh = function(cb) {
  var self = this;
  self.oauth2.getToken(self.refresh_token, {
    grant_type: 'refresh_token',
  }, function(err, new_token) {
    if (err) {
      self.emit('refresh_error', err);
      self.oauth2.emit('token_refresh_failed', self._ident, err);
    } else {
      self.emit('refreshed', new_token);
      self.oauth2.emit('token_refreshed', self._ident, new_token);
    }
    return cb(err, new_token);
  });
};

Client.prototype.toString = function() {
  return JSON.stringify({
    ident: self._ident,
    access_token: self.access_token,
    refresh_token: self.refresh_token,
    expired_date: self.expired_date,
    douban_user_id: self.user_id,
  });
};

['get', 'remove', 'head'].forEach(function(item) {
  var method = item.toUpperCase();;
  if (item === 'remove') {
    method = 'DELETE';
  }
  Client.prototype[item] = function(url, data, callback) {
    if (typeof data == 'function') {
      callback = data;
      data = '';
    }
    this.request(method, url, data, callback);
  };
});
['post', 'put'].forEach(function(item) {
  Client.prototype[item] = function(url, data, callback) {
    this.request(item, url, data, callback);
  };
});



module.exports = function(clientId, clientSecret) {
  clientId = clientId;
  clientSecret = clientSecret;
  return new OAuth2(clientId, clientSecret);
};

module.exports.Client = Client;
module.exports.OAuth2 = OAuth2;
