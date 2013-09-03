# Douban API v2

A nodejs douban api v2 sdk.


## Quick Start

```javascript

var DOUBAN_CLIENT_ID = '';
var DOUBAN_CLIENT_SECRET = '';

var oauth2 = require('douban-api')(DOUBAN_CLIENT_ID, DOUBAN_CLIENT_SECRET);

// set how to store the new token got from `refresh_token`,
// in case an existing token is expired.
oauth2.on('token_refreshed', function(ident, new_token) {
  User.get(ident).update({
    douban_token: new_token
  });
};


var user = User.get('test1');

var api = oauth2.clientFromToken(user.douban_token);

api.get('/v2/event/user_participated/ahbei', function(err, result) {
  // do your thing
});

api.post('/shuo/v2/statuses/', {
  text: '这是一条测试我说'
}, function(err, result) {
});

```

For complete api v2 referrence, goto [douban developers site](http://developers.douban.com/wiki/?title=api_v2).
