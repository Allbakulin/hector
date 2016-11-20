(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Root reference for iframes.
 */

var root;
if (typeof window !== 'undefined') { // Browser window
  root = window;
} else if (typeof self !== 'undefined') { // Web Worker
  root = self;
} else { // Other environments
  console.warn("Using browser-only version of superagent in non-browser environment");
  root = this;
}

var Emitter = require('emitter');
var requestBase = require('./request-base');
var isObject = require('./is-object');

/**
 * Noop.
 */

function noop(){};

/**
 * Expose `request`.
 */

var request = module.exports = require('./request').bind(null, Request);

/**
 * Determine XHR.
 */

request.getXHR = function () {
  if (root.XMLHttpRequest
      && (!root.location || 'file:' != root.location.protocol
          || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  throw Error("Browser-only verison of superagent could not find XHR");
};

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    pushEncodedKeyValuePair(pairs, key, obj[key]);
  }
  return pairs.join('&');
}

/**
 * Helps 'serialize' with serializing arrays.
 * Mutates the pairs array.
 *
 * @param {Array} pairs
 * @param {String} key
 * @param {Mixed} val
 */

function pushEncodedKeyValuePair(pairs, key, val) {
  if (val != null) {
    if (Array.isArray(val)) {
      val.forEach(function(v) {
        pushEncodedKeyValuePair(pairs, key, v);
      });
    } else if (isObject(val)) {
      for(var subkey in val) {
        pushEncodedKeyValuePair(pairs, key + '[' + subkey + ']', val[subkey]);
      }
    } else {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(val));
    }
  } else if (val === null) {
    pairs.push(encodeURIComponent(key));
  }
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var pair;
  var pos;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    pos = pair.indexOf('=');
    if (pos == -1) {
      obj[decodeURIComponent(pair)] = '';
    } else {
      obj[decodeURIComponent(pair.slice(0, pos))] =
        decodeURIComponent(pair.slice(pos + 1));
    }
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Check if `mime` is json or has +json structured syntax suffix.
 *
 * @param {String} mime
 * @return {Boolean}
 * @api private
 */

function isJSON(mime) {
  return /[\/+]json\b/.test(mime);
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return str.split(/ *; */).reduce(function(obj, str){
    var parts = str.split(/ *= */),
        key = parts.shift(),
        val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  // responseText is accessible only if responseType is '' or 'text' and on older browsers
  this.text = ((this.req.method !='HEAD' && (this.xhr.responseType === '' || this.xhr.responseType === 'text')) || typeof this.xhr.responseType === 'undefined')
     ? this.xhr.responseText
     : null;
  this.statusText = this.req.xhr.statusText;
  this._setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this._setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this._parseBody(this.text ? this.text : this.xhr.response)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype._setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype._parseBody = function(str){
  var parse = request.parse[this.type];
  if (!parse && isJSON(this.type)) {
    parse = request.parse['application/json'];
  }
  return parse && str && (str.length || str instanceof Object)
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype._setStatusProperties = function(status){
  // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
  if (status === 1223) {
    status = 204;
  }

  var type = status / 100 | 0;

  // status / class
  this.status = this.statusCode = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var url = req.url;

  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.url = url;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {}; // preserves header name case
  this._header = {}; // coerces header names to lowercase
  this.on('end', function(){
    var err = null;
    var res = null;

    try {
      res = new Response(self);
    } catch(e) {
      err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
      // issue #675: return the raw response if the response parsing fails
      err.rawResponse = self.xhr && self.xhr.responseText ? self.xhr.responseText : null;
      // issue #876: return the http status code if the response parsing fails
      err.statusCode = self.xhr && self.xhr.status ? self.xhr.status : null;
      return self.callback(err);
    }

    self.emit('response', res);

    var new_err;
    try {
      if (res.status < 200 || res.status >= 300) {
        new_err = new Error(res.statusText || 'Unsuccessful HTTP response');
        new_err.original = err;
        new_err.response = res;
        new_err.status = res.status;
      }
    } catch(e) {
      new_err = e; // #985 touching res may cause INVALID_STATE_ERR on old Android
    }

    // #1000 don't catch errors from the callback to avoid double calling it
    if (new_err) {
      self.callback(new_err, res);
    } else {
      self.callback(null, res);
    }
  });
}

/**
 * Mixin `Emitter` and `requestBase`.
 */

Emitter(Request.prototype);
for (var key in requestBase) {
  Request.prototype[key] = requestBase[key];
}

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set responseType to `val`. Presently valid responseTypes are 'blob' and
 * 'arraybuffer'.
 *
 * Examples:
 *
 *      req.get('/')
 *        .responseType('blob')
 *        .end(callback);
 *
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.responseType = function(val){
  this._responseType = val;
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @param {Object} options with 'type' property 'auto' or 'basic' (default 'basic')
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass, options){
  if (!options) {
    options = {
      type: 'basic'
    }
  }

  switch (options.type) {
    case 'basic':
      var str = btoa(user + ':' + pass);
      this.set('Authorization', 'Basic ' + str);
    break;

    case 'auto':
      this.username = user;
      this.password = pass;
    break;
  }
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Queue the given `file` as an attachment to the specified `field`,
 * with optional `filename`.
 *
 * ``` js
 * request.post('/upload')
 *   .attach('content', new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
 *   .end(callback);
 * ```
 *
 * @param {String} field
 * @param {Blob|File} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(field, file, filename){
  this._getFormData().append(field, file, filename || file.name);
  return this;
};

Request.prototype._getFormData = function(){
  if (!this._formData) {
    this._formData = new root.FormData();
  }
  return this._formData;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  this.clearTimeout();
  fn(err, res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Request has been terminated\nPossible causes: the network is offline, Origin is not allowed by Access-Control-Allow-Origin, the page is being unloaded, etc.');
  err.crossDomain = true;

  err.status = this.status;
  err.method = this.method;
  err.url = this.url;

  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype._timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Compose querystring to append to req.url
 *
 * @api private
 */

Request.prototype._appendQueryString = function(){
  var query = this._query.join('&');
  if (query) {
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = request.getXHR();
  var timeout = this._timeout;
  var data = this._formData || this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;

    // In IE9, reads to any property (e.g. status) off of an aborted XHR will
    // result in the error "Could not complete the operation due to error c00c023f"
    var status;
    try { status = xhr.status } catch(e) { status = 0; }

    if (0 == status) {
      if (self.timedout) return self._timeoutError();
      if (self._aborted) return;
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  var handleProgress = function(direction, e) {
    if (e.total > 0) {
      e.percent = e.loaded / e.total * 100;
    }
    e.direction = direction;
    self.emit('progress', e);
  }
  if (this.hasListeners('progress')) {
    try {
      xhr.onprogress = handleProgress.bind(null, 'download');
      if (xhr.upload) {
        xhr.upload.onprogress = handleProgress.bind(null, 'upload');
      }
    } catch(e) {
      // Accessing xhr.upload fails in IE from a web worker, so just pretend it doesn't exist.
      // Reported here:
      // https://connect.microsoft.com/IE/feedback/details/837245/xmlhttprequest-upload-throws-invalid-argument-when-used-from-web-worker-context
    }
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.timedout = true;
      self.abort();
    }, timeout);
  }

  // querystring
  this._appendQueryString();

  // initiate request
  if (this.username && this.password) {
    xhr.open(this.method, this.url, true, this.username, this.password);
  } else {
    xhr.open(this.method, this.url, true);
  }

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !this._isHost(data)) {
    // serialize stuff
    var contentType = this._header['content-type'];
    var serialize = this._serializer || request.serialize[contentType ? contentType.split(';')[0] : ''];
    if (!serialize && isJSON(contentType)) serialize = request.serialize['application/json'];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  if (this._responseType) {
    xhr.responseType = this._responseType;
  }

  // send stuff
  this.emit('request', this);

  // IE11 xhr.send(undefined) sends 'undefined' string as POST payload (instead of nothing)
  // We need null here if data is undefined
  xhr.send(typeof data !== 'undefined' ? data : null);
  return this;
};


/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} [data] or fn
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} [data] or fn
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * OPTIONS query to `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} [data] or fn
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

request.options = function(url, data, fn){
  var req = request('OPTIONS', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

function del(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

request['del'] = del;
request['delete'] = del;

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} [data]
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} [data]
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} [data] or fn
 * @param {Function} [fn]
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

},{"./is-object":2,"./request":4,"./request-base":3,"emitter":5}],2:[function(require,module,exports){
/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return null !== obj && 'object' === typeof obj;
}

module.exports = isObject;

},{}],3:[function(require,module,exports){
/**
 * Module of mixed-in functions shared between node and client code
 */
var isObject = require('./is-object');

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

exports.clearTimeout = function _clearTimeout(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Override default response body parser
 *
 * This function will be called to convert incoming data into request.body
 *
 * @param {Function}
 * @api public
 */

exports.parse = function parse(fn){
  this._parser = fn;
  return this;
};

/**
 * Override default request body serializer
 *
 * This function will be called to convert data set via .send or .attach into payload to send
 *
 * @param {Function}
 * @api public
 */

exports.serialize = function serialize(fn){
  this._serializer = fn;
  return this;
};

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

exports.timeout = function timeout(ms){
  this._timeout = ms;
  return this;
};

/**
 * Promise support
 *
 * @param {Function} resolve
 * @param {Function} reject
 * @return {Request}
 */

exports.then = function then(resolve, reject) {
  if (!this._fullfilledPromise) {
    var self = this;
    this._fullfilledPromise = new Promise(function(innerResolve, innerReject){
      self.end(function(err, res){
        if (err) innerReject(err); else innerResolve(res);
      });
    });
  }
  return this._fullfilledPromise.then(resolve, reject);
}

exports.catch = function(cb) {
  return this.then(undefined, cb);
};

/**
 * Allow for extension
 */

exports.use = function use(fn) {
  fn(this);
  return this;
}


/**
 * Get request header `field`.
 * Case-insensitive.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

exports.get = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Get case-insensitive header `field` value.
 * This is a deprecated internal API. Use `.get(field)` instead.
 *
 * (getHeader is no longer used internally by the superagent code base)
 *
 * @param {String} field
 * @return {String}
 * @api private
 * @deprecated
 */

exports.getHeader = exports.get;

/**
 * Set header `field` to `val`, or multiple fields with one object.
 * Case-insensitive.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

exports.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Remove header `field`.
 * Case-insensitive.
 *
 * Example:
 *
 *      req.get('/')
 *        .unset('User-Agent')
 *        .end(callback);
 *
 * @param {String} field
 */
exports.unset = function(field){
  delete this._header[field.toLowerCase()];
  delete this.header[field];
  return this;
};

/**
 * Write the field `name` and `val`, or multiple fields with one object
 * for "multipart/form-data" request bodies.
 *
 * ``` js
 * request.post('/upload')
 *   .field('foo', 'bar')
 *   .end(callback);
 *
 * request.post('/upload')
 *   .field({ foo: 'bar', baz: 'qux' })
 *   .end(callback);
 * ```
 *
 * @param {String|Object} name
 * @param {String|Blob|File|Buffer|fs.ReadStream} val
 * @return {Request} for chaining
 * @api public
 */
exports.field = function(name, val) {

  // name should be either a string or an object.
  if (null === name ||  undefined === name) {
    throw new Error('.field(name, val) name can not be empty');
  }

  if (isObject(name)) {
    for (var key in name) {
      this.field(key, name[key]);
    }
    return this;
  }

  // val should be defined now
  if (null === val || undefined === val) {
    throw new Error('.field(name, val) val can not be empty');
  }
  this._getFormData().append(name, val);
  return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */
exports.abort = function(){
  if (this._aborted) {
    return this;
  }
  this._aborted = true;
  this.xhr && this.xhr.abort(); // browser
  this.req && this.req.abort(); // node
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

exports.withCredentials = function(){
  // This is browser-only functionality. Node side is no-op.
  this._withCredentials = true;
  return this;
};

/**
 * Set the max redirects to `n`. Does noting in browser XHR implementation.
 *
 * @param {Number} n
 * @return {Request} for chaining
 * @api public
 */

exports.redirects = function(n){
  this._maxRedirects = n;
  return this;
};

/**
 * Convert to a plain javascript object (not JSON string) of scalar properties.
 * Note as this method is designed to return a useful non-this value,
 * it cannot be chained.
 *
 * @return {Object} describing method, url, and data of this request
 * @api public
 */

exports.toJSON = function(){
  return {
    method: this.method,
    url: this.url,
    data: this._data,
    headers: this._header
  };
};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

exports._isHost = function _isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Send `data` as the request body, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"}')
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
 *      request.post('/user')
 *        .send('name=tobi')
 *        .send('species=ferret')
 *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

exports.send = function(data){
  var obj = isObject(data);
  var type = this._header['content-type'];

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    // default to x-www-form-urlencoded
    if (!type) this.type('form');
    type = this._header['content-type'];
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj || this._isHost(data)) return this;

  // default to json
  if (!type) this.type('json');
  return this;
};

},{"./is-object":2}],4:[function(require,module,exports){
// The node and browser modules expose versions of this with the
// appropriate constructor function bound as first argument
/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(RequestConstructor, method, url) {
  // callback
  if ('function' == typeof url) {
    return new RequestConstructor('GET', method).end(url);
  }

  // url first
  if (2 == arguments.length) {
    return new RequestConstructor('GET', method);
  }

  return new RequestConstructor(method, url);
}

module.exports = request;

},{}],5:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

if (typeof module !== 'undefined') {
  module.exports = Emitter;
}

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],6:[function(require,module,exports){
module.exports = "<section class=\"section-1\">\n\n\t\n\t<div class=\"squares-container\"></div>\n\n\t<div class=\"content\">\n\t\t<div class=\"mask pic\">\n\t\t\t<img src=\"{{ ASSETS ~ background }}\">\n\t\t</div>\n\n\t\t<div class=\"mobile-background\">\n\t\t\t<img src=\"{{ ASSETS ~ mobileBackground }}\">\n\t\t</div>\n\n\t\t<div class=\"mask logo-container no-transition\">{{ icon('hector-logo') }}</div>\n\t\t<h1><span class=\"mask\">{{ title }}</span></h1>\n\t\t<h2><span class=\"mask\">{{ text }}</span></h2>\n\t</div>\n</section>\n";

},{}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _HomeSection2 = require('./../../libs/HomeSection');

var _HomeSection3 = _interopRequireDefault(_HomeSection2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomeSection1 = function (_HomeSection) {
	_inherits(HomeSection1, _HomeSection);

	function HomeSection1(data) {
		_classCallCheck(this, HomeSection1);

		var _this = _possibleConstructorReturn(this, (HomeSection1.__proto__ || Object.getPrototypeOf(HomeSection1)).call(this, data));

		var template = require('./index.html.twig');

		_this._render(template);

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(HomeSection1, [{
		key: '_initContent',
		value: function _initContent() {

			_get(HomeSection1.prototype.__proto__ || Object.getPrototypeOf(HomeSection1.prototype), '_initContent', this).call(this);

			this.$logoContainer = this.$container.find('.logo-container');
		}

		// --------------------------------------------------------------o Listeners


		// --------------------------------------------------------------o Public

	}, {
		key: 'show',
		value: function show() {

			_get(HomeSection1.prototype.__proto__ || Object.getPrototypeOf(HomeSection1.prototype), 'show', this).call(this);

			if (this.alreadyDisplayed === true) {
				return;
			}

			this.alreadyDisplayed = true;

			this.$logoContainer[0].offsetHeight;
			this.$logoContainer.removeClass('no-transition');
		}
	}]);

	return HomeSection1;
}(_HomeSection3.default);

exports.default = HomeSection1;

},{"./../../libs/HomeSection":37,"./index.html.twig":6}],8:[function(require,module,exports){
module.exports = "<section class=\"section-2\">\n\n\t<img src=\"{{ ASSETS ~ background }}\" class=\"background\" >\n\n\t<div class=\"squares-container\"></div>\n\t\n\t<div class=\"content\">\n\n\t\t<div class=\"box-border\">\n\t\t\t<span></span>\n\t\t</div>\n\n\t\t<header class=\"align-right\">\n\t\t\t<p class=\"title\"><span class=\"mask\">{{ title }}</span></p>\n\t\t</header>\n\n\t\t<nav>\n\t\t\t<div class=\"numbers-container\">\n\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t<ul>\n\t\t\t\t\t\t{% for item in slider %}\n\t\t\t\t\t\t<li class=\"slider-nav-item\">\n\t\t\t\t\t\t\t<span>{{ '0' ~ loop.index }}</span>\n\t\t\t\t\t\t\t<b></b>\n\t\t\t\t\t\t\t<p>{{ item.title }}</p>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t\t{% endfor %}\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t<div class=\"slider-nav-item slider-prev\"><span class=\"arrow dir-left\"></span></div>\n\t\t\t<div class=\"slider-nav-item slider-next\"><span class=\"arrow dir-right\"></span></div>\n\t\t</nav>\n\n\n\n\t\t<div class=\"slider-container\">\n\t\t\t<ul class=\"slider mask\">\n\t\t\t\t{% for item in slider %}\n\t\t\t\t<li class=\"slide\">\n\t\t\t\t\t<div class=\"content-box\">\n\t\t\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t\t\t<p class=\"title\">{{ item.title }}</p>\n\t\t\t\t\t\t\t<p class=\"text\">{{ item.text }}</p>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\n\t\t\t\t\t<div class=\"background-box box-purple\"></div>\n\t\t\t\t\t<div class=\"background-box box-grey\"></div>\n\t\t\t\t</li>\n\t\t\t\t{% endfor %}\n\t\t\t</ul>\n\n\t\t\t<div class=\"close-icon\">\n\t\t\t\t<div class=\"bar\">\n\t\t\t\t\t<span></span>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"bar\">\n\t\t\t\t\t<span></span>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\n\t</div>\n</section>\n";

},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Events = require('./../../core/Events');

var _Viewport = require('./../../core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _HomeSection2 = require('./../../libs/HomeSection');

var _HomeSection3 = _interopRequireDefault(_HomeSection2);

var _Slider = require('./../Slider');

var _Slider2 = _interopRequireDefault(_Slider);

var _MainHeader = require('./../MainHeader');

var _MainHeader2 = _interopRequireDefault(_MainHeader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomeSection2 = function (_HomeSection) {
	_inherits(HomeSection2, _HomeSection);

	function HomeSection2(data) {
		_classCallCheck(this, HomeSection2);

		var _this = _possibleConstructorReturn(this, (HomeSection2.__proto__ || Object.getPrototypeOf(HomeSection2)).call(this, data));

		var template = require('./index.html.twig');

		_this.isMobile = false;

		_this._render(template);

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(HomeSection2, [{
		key: '_initContent',
		value: function _initContent() {

			_get(HomeSection2.prototype.__proto__ || Object.getPrototypeOf(HomeSection2.prototype), '_initContent', this).call(this);

			this.$sliderContainer = this.$container.find('.slider-container');
			this.$closeIcon = this.$container.find('.close-icon');

			this.slider = new _Slider2.default({
				container: this.$container.find('.slider'),
				nav: this.$container.find('nav'),
				loop: true
			});

			this.$nav = this.$container.find('nav');
			this.$navNumbs = this.$nav.find('li');

			this._onConvictionsSliderChange();
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(HomeSection2.prototype.__proto__ || Object.getPrototypeOf(HomeSection2.prototype), '_initEvents', this).call(this);

			this.slider.on(_Slider2.default.CHANGE, this._onConvictionsSliderChange.bind(this));

			this.$closeIcon.on(_Events.MouseEvent.CLICK, this._onCloseIconClick.bind(this));
		}

		// --------------------------------------------------------------o Listeners


	}, {
		key: '_onConvictionsSliderChange',
		value: function _onConvictionsSliderChange() {

			if (this.isMobile) {

				this.$sliderContainer.addClass('displayed');
				this.$closeIcon.addClass('displayed');
				this.slider.$slides.eq(this.slider.currentIndex).addClass('active');

				this.$container.addClass('hidden');
				this.$scrollButton.addClass('hidden');

				_MainHeader2.default.hideUI();
			}

			//this.$navNumbs.eq(this.slider.currentIndex).addClass('active').siblings().removeClass('active');
		}
	}, {
		key: '_onCloseIconClick',
		value: function _onCloseIconClick() {

			if (this.isMobile) {

				this.$sliderContainer.removeClass('displayed');
				this.$closeIcon.removeClass('displayed');
				this.slider.$slides.eq(this.slider.currentIndex).removeClass('active');

				this.$container.removeClass('hidden');
				this.$scrollButton.removeClass('hidden');

				_MainHeader2.default.showUI();
			}
		}
	}, {
		key: '_onKeyLeft',
		value: function _onKeyLeft() {

			if (this.isActive === false) {
				return;
			}

			this.slider.prev();
		}
	}, {
		key: '_onKeyRight',
		value: function _onKeyRight() {

			if (this.isActive === false) {
				return;
			}

			this.slider.next();
		}
	}, {
		key: '_onResize',
		value: function _onResize() {

			if (_Viewport2.default.width < 500 && this.isMobile === false) {
				this.isMobile = true;
				this.slider.deactivate();
			} else if (_Viewport2.default.width >= 500 && this.isMobile === true) {
				this.isMobile = false;
				this.slider.activate();
			}
		}

		// --------------------------------------------------------------o Public

	}]);

	return HomeSection2;
}(_HomeSection3.default);

exports.default = HomeSection2;

},{"./../../core/Events":23,"./../../core/Viewport":31,"./../../libs/HomeSection":37,"./../MainHeader":19,"./../Slider":20,"./index.html.twig":8,"jquery":"jquery"}],10:[function(require,module,exports){
module.exports = "<section class=\"section-3\">\n\n\t<img src=\"{{ ASSETS ~ background }}\" class=\"background\">\n\n\t<div class=\"squares-container\"></div>\n\t\n\t<div class=\"content\">\n\t\t<header class=\"align-left\">\n\t\t\t<p class=\"title\"><span class=\"mask\">{{ title }}</span></p>\n\t\t\t<p class=\"subtitle\"><span class=\"mask\">{{ subtitle }}</span></p>\n\n\t\t\t<div class=\"buttons\">\n\t\t\t{% for button in buttons %}\n\t\t\t\t<div class=\"button\" data-form=\"{{ button.form }}\"><span class=\"mask\">{{ button.text }}</span></div>\n\t\t\t{% endfor %}\n\t\t\t</div>\n\t\t</header>\n\t</div>\n\n\t<div class=\"popins-links align-right\">\n\t\t<div class=\"mask\">\n\t\t\t<ul>\n\t\t\t\t{% for item in items %}\n\t\t\t\t<li><span class=\"arrow dir-right\"></span>{{ item.push }}</li>\n\t\t\t\t{% endfor %}\n\t\t\t</ul>\n\t\t</div>\n\t</div>\n\n\t<div class=\"popins\">\n\t\t{% for item in items %}\n\t\t{% if item.title %}\n\t\t<div class=\"content-box-container popin\">\n\t\t\t<div class=\"content-box align-right\">\n\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t<p class=\"title\">{{ item.textTitle }}</p>\n\t\t\t\t\t<p class=\"text\">{{ item.text }}</p>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t<div class=\"push\">\n\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t<p>{{ item.title }}</p>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t<div class=\"box-border\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\n\t\t\t<div class=\"background-box box-purple\"></div>\n\t\t\t<div class=\"background-box box-grey\"></div>\n\t\t\t\n\t\t</div>\n\t\t{% endif %}\n\t\t{% endfor %}\n\n\t\t<div class=\"close-icon\">\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\n</section>\n";

},{}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _HomeSection2 = require('./../../libs/HomeSection');

var _HomeSection3 = _interopRequireDefault(_HomeSection2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomeSection3 = function (_HomeSection) {
	_inherits(HomeSection3, _HomeSection);

	function HomeSection3(data) {
		_classCallCheck(this, HomeSection3);

		var _this = _possibleConstructorReturn(this, (HomeSection3.__proto__ || Object.getPrototypeOf(HomeSection3)).call(this, data));

		var template = require('./index.html.twig');

		_this._render(template);

		return _this;
	}

	// --------------------------------------------------------------o Private


	// --------------------------------------------------------------o Listeners


	// --------------------------------------------------------------o Public

	return HomeSection3;
}(_HomeSection3.default);

exports.default = HomeSection3;

},{"./../../libs/HomeSection":37,"./index.html.twig":10}],12:[function(require,module,exports){
module.exports = "<section class=\"section-4\">\n\n\t<img src=\"{{ ASSETS ~ background }}\" class=\"background\">\n\n\t<div class=\"squares-container\"></div>\n\t\n\t<div class=\"content\">\n\t\t<header class=\"align-right\">\n\t\t\t<p class=\"title\"><span class=\"mask\">{{ title }}</span></p>\n\t\t\t<p class=\"subtitle\"><span class=\"mask\">{{ subtitle }}</span></p>\n\n\t\t\t<div class=\"buttons\">\n\t\t\t{% for button in buttons %}\n\t\t\t\t{% if button.href %}\n\t\t\t\t<div class=\"button\"><a href=\"{{ button.href }}\" class=\"mask\" target=\"_blank\">{{ button.text }}</a></div>\n\t\t\t\t{% else %}\n\t\t\t\t<div class=\"button\" data-form=\"{{ button.form }}\"><span class=\"mask\">{{ button.text }}</span></div>\n\t\t\t\t{% endif %}\n\t\t\t{% endfor %}\n\t\t\t</div>\n\t\t</header>\n\t</div>\n\n\t<div class=\"popins-links align-left\">\n\t\t<div class=\"mask\">\n\t\t\t<ul>\n\t\t\t\t{% for item in items %}\n\t\t\t\t<li><span class=\"arrow dir-right\"></span>{{ item.push }}</li>\n\t\t\t\t{% endfor %}\n\t\t\t</ul>\n\t\t</div>\n\t</div>\n\n\t<div class=\"popins\">\n\n\t\t{# ---o Jobs container #}\n\t\t<div class=\"jobs-container popin\">\n\t\t\t<p class=\"title\"><span class=\"mask\">{{ jobs.title }}</span></p>\n\n\t\t\t<div class=\"mask mask-outer\">\n\t\t\t\t<div class=\"mask mask-inner\">\n\t\t\t\t\t<ul class=\"jobs-list slider\">\n\t\t\t\t\t\t{% for job in jobs.items %}\n\t\t\t\t\t\t<li>\n\t\t\t\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t\t\t\t<p class=\"name\">{{ job.name }}</p>\n\t\t\t\t\t\t\t\t<ul>\n\t\t\t\t\t\t\t\t\t{% for item in job.info %}\n\t\t\t\t\t\t\t\t\t<li>{{ item }}</li>\n\t\t\t\t\t\t\t\t\t{% endfor %}\n\t\t\t\t\t\t\t\t</ul>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t\t{% endfor %}\n\t\t\t\t\t</ul>\n\n\t\t\t\t\t<nav class=\"jobs-list-nav\">\n\t\t\t\t\t\t<div class=\"slider-nav-item slider-prev\">\n\t\t\t\t\t\t\t<span class=\"arrow dir-left\"></span>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class=\"slider-nav-item slider-next\">\n\t\t\t\t\t\t\t<span class=\"arrow dir-right\"></span>\n\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t<ul>\n\t\t\t\t\t\t\t{% for job in jobs.items %}\n\t\t\t\t\t\t\t<li class=\"slider-nav-item\"><span></span></li>\n\t\t\t\t\t\t\t{% endfor %}\n\t\t\t\t\t\t</ul>\n\t\t\t\t\t</nav>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t\n\t\t</div>\n\n\t\t{# ---o Other popin #}\n\t\t{% for item in items %}\n\t\t{% if item.title %}\n\t\t<div class=\"content-box-container popin\">\n\n\t\t\t<div class=\"content-box align-left\">\n\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t<p class=\"title\">{{ item.textTitle }}</p>\n\t\t\t\t\t<p class=\"text\">{{ item.text }}</p>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t<div class=\"push\">\n\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t<p>{{ item.title }}</p>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t<div class=\"box-border\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\n\t\t\t<div class=\"background-box box-purple\"></div>\n\t\t\t<div class=\"background-box box-grey\"></div>\n\t\t\t\n\t\t</div>\n\t\t{% endif %}\n\t\t{% endfor %}\t\t\t\n\n\t\t<div class=\"close-icon\">\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\n</section>\n";

},{}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _HomeSection2 = require('./../../libs/HomeSection');

var _HomeSection3 = _interopRequireDefault(_HomeSection2);

var _Slider = require('./../Slider');

var _Slider2 = _interopRequireDefault(_Slider);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomeSection4 = function (_HomeSection) {
	_inherits(HomeSection4, _HomeSection);

	function HomeSection4(data) {
		_classCallCheck(this, HomeSection4);

		var _this = _possibleConstructorReturn(this, (HomeSection4.__proto__ || Object.getPrototypeOf(HomeSection4)).call(this, data));

		var template = require('./index.html.twig');

		_this._render(template);

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(HomeSection4, [{
		key: '_initContent',
		value: function _initContent() {

			_get(HomeSection4.prototype.__proto__ || Object.getPrototypeOf(HomeSection4.prototype), '_initContent', this).call(this);

			this.slider = new _Slider2.default({
				container: this.$container.find('.jobs-list'),
				loop: true,
				nav: this.$container.find('.jobs-list-nav')
			});
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(HomeSection4.prototype.__proto__ || Object.getPrototypeOf(HomeSection4.prototype), '_initEvents', this).call(this);

			this.slider.on(_Slider2.default.CHANGE, this._onSliderChange.bind(this));
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onSliderChange',
		value: function _onSliderChange() {

			//console.log(this.slider.currentIndex);

		}
	}, {
		key: '_onKeyLeft',
		value: function _onKeyLeft() {

			if (this.isActive !== true || this.currentPopinIndex !== 0) {
				return;
			}

			this.slider.prev();
		}
	}, {
		key: '_onKeyRight',
		value: function _onKeyRight() {

			if (this.isActive !== true || this.currentPopinIndex !== 0) {
				return;
			}

			this.slider.next();
		}

		// --------------------------------------------------------------o Public

	}]);

	return HomeSection4;
}(_HomeSection3.default);

exports.default = HomeSection4;

},{"./../../libs/HomeSection":37,"./../Slider":20,"./index.html.twig":12}],14:[function(require,module,exports){
module.exports = "<section class=\"section-5\">\n\t\t\n\t<div class=\"backgrounds\">\n\t\t<img src=\"/assets/medias/section-3-background.jpg\" />\n\t\t<img src=\"/assets/medias/section-2-background.jpg\" />\n\t</div>\n\n\t<div class=\"squares-container\"></div>\n\n\t<div class=\"content\">\n\t\t<header class=\"align-left\">\n\t\t\t<p class=\"title\"><span class=\"mask\">{{ title }}</span></p>\n\t\t</header>\n\n\t\t<div class=\"push\">\n\t\t\t<div class=\"mask\">\n\t\t\t\t<div>\n\t\t\t\t\t{{ push }}\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\n\t\t<div class=\"buttons\">\n\t\t\t{% for button in buttons %}\n\t\t\t<div class=\"button-box\">\n\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t<div class=\"button-background\">\n\t\t\t\t\t\t<img src=\"{{ ROOT_PATH ~ ASSETS ~ button.background }}\" />\n\t\t\t\t\t</div>\n\t\t\t\t\t<p>{{ button.text }}</p>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t{% endfor %}\n\t\t</div>\n\t</div>\n\n\t<div class=\"popins\">\n\n\t\t{% for i in 0..2 %}\n\t\t<div class=\"popin\">\n\n\t\t\t<form action=\"/email\" data-to=\"{{ buttons[i].email }}\">\n\t\t\t\t<fieldset>\n\t\t\t\t\t<div class=\"input\">\n\t\t\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t\t\t<div class=\"inner\">\n\t\t\t\t\t\t\t\t<input type=\"email\" name=\"email\" id=\"email\" placeholder=\"Email*\" />\n\t\t\t\t\t\t\t\t<span class=\"error-message\">non conforme</span>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\n\t\t\t\t\t<div class=\"dropdown-list\">\n\t\t\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t\t\t<div class=\"inner\">\n\t\t\t\t\t\t\t\t<p class=\"value\">Objet*</p>\n\t\t\t\t\t\t\t\t<ul>\n\t\t\t\t\t\t\t\t\t{% for object in buttons[i].object %}\n\t\t\t\t\t\t\t\t\t<li>{{ object }}</li>\n\t\t\t\t\t\t\t\t\t{% endfor %}\n\t\t\t\t\t\t\t\t</ul>\n\t\t\t\t\t\t\t\t<input type=\"hidden\" id=\"object\" name=\"object\" />\n\t\t\t\t\t\t\t\t<span class=\"error-message\">choisir un objet</span>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\n\t\t\t\t\t<div class=\"textarea\">\n\t\t\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t\t\t<div class=\"inner\">\n\t\t\t\t\t\t\t\t<textarea id=\"message\" name=\"message\" placeholder=\"Message*\"></textarea>\n\t\t\t\t\t\t\t\t<span class=\"error-message\">tapper votre message</span>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\n\t\t\t\t\t<p class=\"info\">* Ces champs sont obligatoires</p>\n\n\t\t\t\t</fieldset>\n\n\t\t\t\t<div class=\"submit-button\">\n\t\t\t\t\t<div class=\"mask\">\n\t\t\t\t\t\t<span class=\"arrow dir-right\"></span>\n\t\t\t\t\t\tEnvoyer\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\n\t\t\t\t<div class=\"success-message\">\n\t\t\t\t\t<p>\n\t\t\t\t\t\t<strong>Merci pour votre message</strong>\n\t\t\t\t\t\t<span>On revient vers vous au plus tôt !</span>\n\t\t\t\t\t</p>\n\t\t\t\t</div>\n\n\t\t\t</form>\n\n\t\t</div>\n\t\t{% endfor %}\t\t\t\n\n\t\t<div class=\"close-icon\">\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\n</section>\n";

},{}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _ImageUtils = require('./../../core/ImageUtils');

var _ImageUtils2 = _interopRequireDefault(_ImageUtils);

var _Viewport = require('./../../core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _HomeSection2 = require('./../../libs/HomeSection');

var _HomeSection3 = _interopRequireDefault(_HomeSection2);

var _Form = require('./../../libs/Form');

var _Form2 = _interopRequireDefault(_Form);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomeSection5 = function (_HomeSection) {
	_inherits(HomeSection5, _HomeSection);

	function HomeSection5(data) {
		_classCallCheck(this, HomeSection5);

		var _this = _possibleConstructorReturn(this, (HomeSection5.__proto__ || Object.getPrototypeOf(HomeSection5)).call(this, data));

		var template = require('./index.html.twig');

		_this._render(template);

		//this._openPopin(0);


		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(HomeSection5, [{
		key: '_initContent',
		value: function _initContent() {

			_get(HomeSection5.prototype.__proto__ || Object.getPrototypeOf(HomeSection5.prototype), '_initContent', this).call(this);

			var $forms = this.$container.find('form');

			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = $forms[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var $form = _step.value;

					new _Form2.default({
						container: (0, _jquery2.default)($form)
					});
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}

			this.$backgrounds = this.$container.find('.backgrounds img');

			this.$popinLinks = this.$container.find('.content .button-box');

			this.$push = this.$container.find('.push');
			this.$pushTexts = this.$push.find('span');
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(HomeSection5.prototype.__proto__ || Object.getPrototypeOf(HomeSection5.prototype), '_initEvents', this).call(this);

			this.$backgrounds.on('load', this._onBackgroundLoad.bind(this));
		}
	}, {
		key: '_resizeBackground',
		value: function _resizeBackground($item) {

			if ($item[0].complete !== true) {
				return;
			}

			var dims = _ImageUtils2.default.getCoverSizeImage($item[0].naturalWidth, $item[0].naturalHeight, _Viewport2.default.width, _Viewport2.default.height);

			$item.css(dims);
		}
	}, {
		key: '_openPopin',
		value: function _openPopin(index) {

			this.$backgrounds.eq(index).addClass('active');

			this.$push.addClass('active');
			this.$pushTexts.eq(index + 1).addClass('active');

			_get(HomeSection5.prototype.__proto__ || Object.getPrototypeOf(HomeSection5.prototype), '_openPopin', this).call(this, index);
		}
	}, {
		key: '_closePopin',
		value: function _closePopin() {

			this.$backgrounds.eq(this.currentPopinIndex).removeClass('active');

			this.$push.removeClass('active');
			this.$pushTexts.eq(this.currentPopinIndex + 1).removeClass('active');

			_get(HomeSection5.prototype.__proto__ || Object.getPrototypeOf(HomeSection5.prototype), '_closePopin', this).call(this);
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onBackgroundLoad',
		value: function _onBackgroundLoad(e) {

			this._resizeBackground((0, _jquery2.default)(e.currentTarget));
		}
	}, {
		key: '_onResize',
		value: function _onResize() {

			_get(HomeSection5.prototype.__proto__ || Object.getPrototypeOf(HomeSection5.prototype), '_onResize', this).call(this);

			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = this.$backgrounds[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var $background = _step2.value;

					this._resizeBackground((0, _jquery2.default)($background));
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'openForm',
		value: function openForm(index) {

			this._openPopin(index);
		}
	}]);

	return HomeSection5;
}(_HomeSection3.default);

exports.default = HomeSection5;

},{"./../../core/ImageUtils":24,"./../../core/Viewport":31,"./../../libs/Form":36,"./../../libs/HomeSection":37,"./index.html.twig":14,"jquery":"jquery"}],16:[function(require,module,exports){
module.exports = "<div class=\"main-footer\">\n\t<ul>\n\t\t<li class=\"social-icon\"><a href=\"https://twitter.com/Hector_HR16\" target=\"_blank\">{{ icon('twitter-icon') }}</a></li>\n\t\t<li class=\"social-icon\"><a href=\" https://www.linkedin.com/company/cabinet-hector/analytics?trk=top_nav_analytics\" target=\"_blank\">{{ icon('linkedin-icon') }}</a></li>\n\t\t<li class=\"social-icon\"><a href=\" https://www.facebook.com/Hector-1620012621624401\" target=\"_blank\">{{ icon('facebook-icon') }}</a></li>\n\t\t<li class=\"social-icon\"><a href=\"\" target=\"_blank\">{{ icon('google-plus-icon') }}</a></li>\n\t\t<li class=\"terms-link\"><span>Mentions légales</span></li>\n\t</ul>\n\n\t<div class=\"scroll-button\">\n\t\t<div class=\"box\">\n\t\t\t<span class=\"arrow simple small dir-bottom\"></span>\n\t\t</div>\n\t\t<strong>Scroll</strong>\n\t</div>\n\n\t<div class=\"popin popin-terms\">\n\t\t<div class=\"content\">\n\t\t\t<div class=\"title\"><p class=\"mask\">{{ terms.title }}</p></div>\n\t\t\t<div class=\"text\">{{ terms.text }}</div>\n\t\t</div>\n\n\t\t<div class=\"close-icon\">\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t\t<div class=\"bar\">\n\t\t\t\t<span></span>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n</div>";

},{}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Component2 = require('./../../core/Component');

var _Component3 = _interopRequireDefault(_Component2);

var _Events = require('./../../core/Events');

var _Viewport = require('./../../core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _Normalize = require('./../../core/Normalize');

var _Normalize2 = _interopRequireDefault(_Normalize);

var _data = require('./../../data/data.json');

var _data2 = _interopRequireDefault(_data);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MainFooter = function (_Component) {
	_inherits(MainFooter, _Component);

	function MainFooter(data) {
		_classCallCheck(this, MainFooter);

		var template = require('./index.html.twig');
		data = _data2.default.home;

		var _this = _possibleConstructorReturn(this, (MainFooter.__proto__ || Object.getPrototypeOf(MainFooter)).call(this, data, template));

		_this.SCROLL_BUTTON_CLICK = 'footer:scrollbuttonclick';


		_this._render(template);

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(MainFooter, [{
		key: '_initContent',
		value: function _initContent() {

			this.$scrollButton = this.$container.find('.scroll-button');
			this.$termsLink = this.$container.find('.terms-link');
			this.$popinTerms = this.$container.find('.popin-terms');

			this.isCloseButtonDisplayed = false;

			this.isMobile = false;

			this.pos = {};
			this.pos.x = {};
			this.pos.y = {};
			this.pos.x.curr = 0;
			this.pos.x.dest = 0;
			this.pos.x.prev = 0;
			this.pos.y.curr = 0;
			this.pos.y.dest = 0;
			this.pos.y.prev = 0;
			this.pos.ease = 0.05;
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(MainFooter.prototype.__proto__ || Object.getPrototypeOf(MainFooter.prototype), '_initEvents', this).call(this);

			this.$scrollButton.on(_Events.MouseEvent.CLICK, this._onScrolLButtonClick.bind(this));

			this.$termsLink.on(_Events.MouseEvent.CLICK, this._onTermsLinkClick.bind(this));
		}
	}, {
		key: '_showCloseIcon',
		value: function _showCloseIcon() {

			if (this.isCloseButtonDisplayed === true) {
				return;
			}

			this.isCloseButtonDisplayed = true;

			this.$popinCloseButton.addClass('displayed');

			if (this.isMobile === false) {
				_Viewport2.default.$body.addClass('no-cursor');
			}
		}
	}, {
		key: '_hideCloseIcon',
		value: function _hideCloseIcon() {

			if (this.isCloseButtonDisplayed === false) {
				return;
			}

			this.isCloseButtonDisplayed = false;

			this.$popinCloseButton.removeClass('displayed');
			_Viewport2.default.$body.removeClass('no-cursor');
		}
	}, {
		key: '_openPopin',
		value: function _openPopin() {
			var _this2 = this;

			this.$popinTerms.addClass('displayed');
			this.$popinCloseButton = this.$popinTerms.find('.close-icon');

			this._showCloseIcon();

			if (_Viewport2.default.isUAMobile) {
				this.$popinCloseButton.on(_Events.MouseEvent.CLICK, this._onPopinCloseButtonClick.bind(this));
				return;
			}

			setTimeout(function () {
				_Viewport2.default.$body.on(_Events.MouseEvent.MOVE + '.popin', _this2._onMouseMove.bind(_this2)).on(_Events.MouseEvent.CLICK + '.popin', _this2._onMouseClick.bind(_this2));
			}, 10);
		}
	}, {
		key: '_closePopin',
		value: function _closePopin() {

			if (this.$popinCloseButton === undefined) {
				return;
			}

			this.$popinCloseButton.removeClass('displayed');
			this.$popinTerms.removeClass('displayed');

			this._hideCloseIcon();
			this.$popinCloseButton = undefined;

			this._hideCloseIcon();

			if (_Viewport2.default.isUAMobile) {
				this.$popinCloseButton.off(_Events.MouseEvent.CLICK);
				return;
			}

			_Viewport2.default.$body.off(_Events.MouseEvent.MOVE + '.popin').off(_Events.MouseEvent.CLICK + '.popin');
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onScrolLButtonClick',
		value: function _onScrolLButtonClick() {

			this.dispatch(this.SCROLL_BUTTON_CLICK);
		}
	}, {
		key: '_onTermsLinkClick',
		value: function _onTermsLinkClick() {

			if (this.$popinCloseButton !== undefined) {
				this._closePopin();
			} else {
				this._openPopin();
			}
		}
	}, {
		key: '_onMouseMove',
		value: function _onMouseMove(e) {

			var $target = (0, _jquery2.default)(e.target);
			var klass = $target.attr('class') || '';

			this.pos.x.dest = e.pageX;
			this.pos.y.dest = e.pageY;

			if ($target.parents('.popin-terms').length > 0 || !klass.match('popin-terms')) {
				this._hideCloseIcon();
			} else {
				this._showCloseIcon();
			}
		}
	}, {
		key: '_onMouseClick',
		value: function _onMouseClick(e) {

			var $target = (0, _jquery2.default)(e.target);

			if ($target.parents('.popins').length > 0) {
				return;
			}

			this._closePopin();
		}
	}, {
		key: '_onPopinCloseButtonClick',
		value: function _onPopinCloseButtonClick() {

			this._closePopin();
		}
	}, {
		key: '_onResize',
		value: function _onResize() {

			if (_Viewport2.default.width < 500 && this.isMobile === false || _Viewport2.default.isUAMobile === true) {
				if (this.$popinCloseButton !== undefined) {
					_Normalize2.default.transform(this.$popinCloseButton[0], '');
				}
				this.isMobile = true;
			} else if (_Viewport2.default.width >= 500 && this.isMobile === true) {
				this.isMobile = false;
			}
		}
	}, {
		key: '_onUpdate',
		value: function _onUpdate() {

			//return;

			if (this.isMobile === true || _Viewport2.default.isUAMobile === true) {
				return;
			}

			this.pos.x.curr += (this.pos.x.dest - this.pos.x.curr) * this.pos.ease;
			this.pos.y.curr += (this.pos.y.dest - this.pos.y.curr) * this.pos.ease;

			if (this.$popinCloseButton !== undefined) {
				var x = this.pos.x.curr * 0.02 * -1;
				var y = this.pos.y.curr * 0.02 * -1;

				_Normalize2.default.transform(this.$popinCloseButton[0], 'translate3d(' + this.pos.x.dest + 'px, ' + this.pos.y.dest + 'px, 0)');
			}
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'display',
		value: function display() {

			this.$container.addClass('displayed');
		}
	}]);

	return MainFooter;
}(_Component3.default);

exports.default = new MainFooter();

},{"./../../core/Component":21,"./../../core/Events":23,"./../../core/Normalize":26,"./../../core/Viewport":31,"./../../data/data.json":33,"./index.html.twig":16,"jquery":"jquery"}],18:[function(require,module,exports){
module.exports = "<header class=\"main-header\">\n\t\n\t<span class=\"main-logo\">{{ icon('hector-logo') }}</span>\n\n\t<nav class=\"main-nav\">\n\t\t<ul>\n\t\t\t<li><span>Hello</span></li>\n\t\t\t<li><span>Nos convictions</span></li>\n\t\t\t<li><span>Vous recrutez ?</span></li>\n\t\t\t<li><span>Vous cherchez un job ?</span></li>\n\t\t\t<li><span>Rencontrons-nous</span></li>\n\t\t</ul>\n\t\t<div class=\"bar-container\">\n\t\t\t<div class=\"bar\"></div>\n\t\t</div>\n\t</nav>\n\n\t<div class=\"menu-button\">\n\t\t<span></span>\n\t\t<span></span>\n\t\t<span></span>\n\t\t<span></span>\n\t</div>\n\n</header>\n";

},{}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Component2 = require('./../../core/Component');

var _Component3 = _interopRequireDefault(_Component2);

var _Viewport = require('./../../core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _Events = require('./../../core/Events');

var _Normalize = require('./../../core/Normalize');

var _Normalize2 = _interopRequireDefault(_Normalize);

var _data = require('../../data/data.json');

var _data2 = _interopRequireDefault(_data);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MainHeader = function (_Component) {
	_inherits(MainHeader, _Component);

	// --------------------------------------------------------------o Private

	function MainHeader(data) {
		_classCallCheck(this, MainHeader);

		var _this = _possibleConstructorReturn(this, (MainHeader.__proto__ || Object.getPrototypeOf(MainHeader)).call(this, data));

		_this.NAV_ITEM_CLICK = 'mainheader:navitemclick';


		_this.template = require('./index.html.twig');
		_this._render();

		_this.initialized = false;
		_this.logoDisplayed = false;
		_this.isOpened = false;

		setTimeout(function () {
			_this.initialized = true;
			_this.activeItem(_this.currentItemIndex);
		}, 1000);

		return _this;
	}

	_createClass(MainHeader, [{
		key: '_initContent',
		value: function _initContent() {

			this.$mainLogo = this.$container.find('.main-logo');

			this.$nav = this.$container.find('nav');
			this.$navItems = this.$nav.find('li');

			this.$bar = this.$container.find('.bar');
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			this.$mainLogo.on(_Events.MouseEvent.CLICK, this._onMainLogoClick.bind(this));

			this.$navItems.on(_Events.MouseEvent.CLICK, this._onNavItemClick.bind(this));

			_Viewport2.default.on(_Events.Event.RESIZE, this._onResize.bind(this));

			this.$container.find('.menu-button').on(_Events.MouseEvent.CLICK, this._onMenuButtonClick.bind(this));
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onMainLogoClick',
		value: function _onMainLogoClick() {

			this.dispatch(this.NAV_ITEM_CLICK, 0);
		}
	}, {
		key: '_onNavItemClick',
		value: function _onNavItemClick(e) {

			var $this = (0, _jquery2.default)(e.currentTarget);
			var index = $this.index();

			$this.addClass('active').siblings().removeClass('active');
			this.$container.removeClass('opened');

			this.dispatch(this.NAV_ITEM_CLICK, index);
		}
	}, {
		key: '_onMenuButtonClick',
		value: function _onMenuButtonClick() {

			if (this.isOpened === true) {
				this.$container.removeClass('opened');
				this.isOpened = false;
			} else {
				this.$container.addClass('opened');
				this.isOpened = true;
			}
		}
	}, {
		key: '_onResize',
		value: function _onResize() {}

		// --------------------------------------------------------------o Public

	}, {
		key: 'activeItem',
		value: function activeItem(index) {

			this.currentItemIndex = index;

			if (this.initialized === false || index === undefined) {
				return;
			}

			var $navItem = this.$navItems.eq(index).children();
			var width = $navItem.width();
			var left = $navItem.position().left;
			var scale = width / 100;

			_Normalize2.default.transform(this.$bar[0], 'translate3d(' + left + 'px, 0, 0) scaleX(' + scale + ')');

			if (index === 0) {
				this.hideLogo();
			} else {
				this.showLogo();
			}
		}
	}, {
		key: 'display',
		value: function display() {

			this.$container.addClass('displayed');
		}
	}, {
		key: 'showLogo',
		value: function showLogo() {

			if (this.logoDisplayed === true) {
				return;
			}

			this.logoDisplayed = true;

			this.$container.addClass('logo-displayed');
		}
	}, {
		key: 'hideLogo',
		value: function hideLogo() {

			if (this.logoDisplayed === false) {
				return;
			}

			this.logoDisplayed = false;

			this.$container.removeClass('logo-displayed');
		}
	}, {
		key: 'showUI',
		value: function showUI() {

			this.$container.removeClass('ui-hidden');
		}
	}, {
		key: 'hideUI',
		value: function hideUI() {

			this.$container.addClass('ui-hidden');
		}
	}]);

	return MainHeader;
}(_Component3.default);

exports.default = new MainHeader();

},{"../../data/data.json":33,"./../../core/Component":21,"./../../core/Events":23,"./../../core/Normalize":26,"./../../core/Viewport":31,"./index.html.twig":18,"jquery":"jquery"}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Component2 = require('./../../core/Component');

var _Component3 = _interopRequireDefault(_Component2);

var _Events = require('./../../core/Events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Slider = function (_Component) {
	_inherits(Slider, _Component);

	function Slider(data) {
		_classCallCheck(this, Slider);

		var _this = _possibleConstructorReturn(this, (Slider.__proto__ || Object.getPrototypeOf(Slider)).call(this));

		_this.data = data;

		_this._initContent();
		_this._initEvents();

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(Slider, [{
		key: '_initContent',
		value: function _initContent() {

			_get(Slider.prototype.__proto__ || Object.getPrototypeOf(Slider.prototype), '_initContent', this).call(this);

			this.$container = this.data.container;

			this.$slides = this.$container.children('li');

			this.$nav = this.data.nav;

			if (this.$nav) {
				this.$navItems = this.$nav.find('.slider-nav-item');
			}

			this.loop = this.data.loop === undefined ? true : this.data.loop;

			this.prevIndex = undefined;
			this.currIndex = undefined;
			this.slidesLength = this.$slides.length;

			this.activated = true;

			this.$slides.addClass('no-transition next');

			this._goToSlide(0);
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(Slider.prototype.__proto__ || Object.getPrototypeOf(Slider.prototype), '_initEvents', this).call(this);

			if (this.$nav) {
				this.$navItems.on(_Events.MouseEvent.CLICK, this._onNavItemClick.bind(this));
			}
		}
	}, {
		key: '_prevSlide',
		value: function _prevSlide() {

			var index = this.currIndex - 1;
			var noStateChange = false;

			if (index < 0) {
				if (this.loop === false) {
					return;
				}

				index = this.$slides.length - 1;
				noStateChange = true;
			}

			this._goToSlide(index, noStateChange);
		}
	}, {
		key: '_nextSlide',
		value: function _nextSlide() {

			var index = this.currIndex + 1;
			var noStateChange = false;

			if (index > this.slidesLength - 1) {
				if (this.loop === false) {
					return;
				}

				index = 0;
				noStateChange = true;
			}

			this._goToSlide(index, noStateChange);
		}
	}, {
		key: '_goToSlide',
		value: function _goToSlide(index, noStateChange) {

			if (index === this.currIndex && this.activated === true) {
				return;
			}

			this.states = ['prev', 'next'];

			this.prevIndex = this.currIndex;
			this.currIndex = index;

			if (this.prevIndex > this.currIndex) {
				this.states.reverse();
			}

			if (noStateChange == true) {
				this.states.reverse();
			}

			if (this.activated === true) {
				this.$slides.eq(this.prevIndex).removeClass(this.states[1]).addClass(this.states[0]);

				var currentSlide = this.$slides.eq(this.currIndex);

				currentSlide.addClass(this.states[1] + ' no-transition').removeClass(this.states[0]);
				currentSlide[0].offsetHeight;
				currentSlide.removeClass(this.states[1] + ' no-transition');

				if (this.$navItems !== undefined && this.$navItems.filter('li').length > 0) {
					this.$navItems.filter('li').eq(this.currentIndex).addClass('active');
					this.$navItems.filter('li').eq(this.prevIndex).removeClass('active');
				}
			}

			this.dispatch(Slider.CHANGE, noStateChange);
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onNavItemClick',
		value: function _onNavItemClick(e) {

			var $this = (0, _jquery2.default)(e.currentTarget);
			var klass = $this.attr('class') || '';

			if (klass.match('slider-prev')) {
				this._prevSlide();
			} else if (klass.match('slider-next')) {
				this._nextSlide();
			} else {
				this.goTo($this.index());
			}
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'goTo',
		value: function goTo(index, noStateChange) {

			this._goToSlide(index, noStateChange);
		}
	}, {
		key: 'next',
		value: function next() {

			this._nextSlide();
		}
	}, {
		key: 'prev',
		value: function prev() {

			this._prevSlide();
		}
	}, {
		key: 'activate',
		value: function activate() {

			this.$slides.addClass('next no-transition');
			this.activated = true;
			this._goToSlide(0);
		}
	}, {
		key: 'deactivate',
		value: function deactivate() {

			this.activated = false;

			this.$slides.removeClass('next prev no-transition');
			this.$navItems.removeClass('active');
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'currentIndex',
		get: function get() {

			return this.currIndex;
		}
	}]);

	return Slider;
}(_Component3.default);

Slider.CHANGE = 'slider:change';
exports.default = Slider;

},{"./../../core/Component":21,"./../../core/Events":23,"jquery":"jquery"}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _EventDispatcher2 = require('./EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _TemplateRenderer = require('./TemplateRenderer');

var _TemplateRenderer2 = _interopRequireDefault(_TemplateRenderer);

var _Viewport = require('./Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _Events = require('./Events');

var _data = require('./../data/data.json');

var _data2 = _interopRequireDefault(_data);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Component = function (_EventDispatcher) {
	_inherits(Component, _EventDispatcher);

	function Component(data) {
		_classCallCheck(this, Component);

		var _this = _possibleConstructorReturn(this, (Component.__proto__ || Object.getPrototypeOf(Component)).call(this));

		_this.data = data || {};

		_this._addGlobalData();

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(Component, [{
		key: '_render',
		value: function _render(template) {

			// Convert string template into template string (need to find a better way than eval)

			if (template) {
				this.template = template;
			}

			var output = _TemplateRenderer2.default.render(this.template, this.data);
			this.$container = (0, _jquery2.default)(output);

			this._initContent();
			this._initEvents();
		}
	}, {
		key: '_addGlobalData',
		value: function _addGlobalData() {

			// Add all global variables
			for (var key in _data2.default) {
				if (key === key.toUpperCase()) {
					this.data[key] = _data2.default[key];
				}
			}
		}
	}, {
		key: '_initContent',
		value: function _initContent() {}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			if (this._onResize) {

				_Viewport2.default.on(_Events.Event.RESIZE, this._onResize.bind(this));
			}

			// ---o Only launch the ticker when the page needs it
			if (this._onUpdate) {
				TweenMax.ticker.addEventListener("tick", this._onUpdate.bind(this));
			}
		}

		// --------------------------------------------------------------o Listeners

		// --------------------------------------------------------------o Public


	}]);

	return Component;
}(_EventDispatcher3.default);

exports.default = Component;

},{"./../data/data.json":33,"./EventDispatcher":22,"./Events":23,"./TemplateRenderer":29,"./Viewport":31,"jquery":"jquery"}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EventDispatcher = function () {
	function EventDispatcher() {
		_classCallCheck(this, EventDispatcher);

		this.events = {};
	}

	_createClass(EventDispatcher, [{
		key: "on",
		value: function on(name, callback, ctx) {

			if (this.events[name] === undefined) {
				this.events[name] = [];
			}

			this.events[name].push({
				fn: callback,
				ctx: ctx
			});

			return this;
		}
	}, {
		key: "off",
		value: function off(name, callback, ctx) {

			var events = this.events[name];
			var liveEvents = [];

			if (events !== undefined && callback !== undefined) {
				var _iteratorNormalCompletion = true;
				var _didIteratorError = false;
				var _iteratorError = undefined;

				try {
					for (var _iterator = events[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
						var event = _step.value;

						if (event.fn !== callback && event.fn._ !== callback) {
							liveEvents.push(event);
						}
					}
				} catch (err) {
					_didIteratorError = true;
					_iteratorError = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion && _iterator.return) {
							_iterator.return();
						}
					} finally {
						if (_didIteratorError) {
							throw _iteratorError;
						}
					}
				}
			}

			if (liveEvents.length > 0) {
				this.events[name] = liveEvents;
			} else if (this.events[name]) {
				delete this.events[name];
			}

			return this;
		}
	}, {
		key: "dispatch",
		value: function dispatch(name) {

			var data = [].slice.call(arguments, 1);

			if (this.events[name] === undefined) {
				return this;
			}

			var events = this.events[name].slice();

			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = events[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var event = _step2.value;

					event.fn.apply(event.ctx, data);
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			return this;
		}
	}]);

	return EventDispatcher;
}();

exports.default = EventDispatcher;

},{}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
var touch = false;
var mousedown = '';
var mouseup = '';
var mousemove = '';

if ('onmousedown' in window) {
	touch = true;
	mousedown += ' mousedown';
	mouseup += ' mouseup';
	mousemove += ' mousemove';
}

if ('ontouchstart' in window) {
	touch = true;
	mousedown += ' touchstart';
	mouseup += ' touchend';
	mousemove += ' touchmove';
}

var Event = exports.Event = {
	RESIZE: 'resize',
	RAF: 'requestAnimationFrame',

	SCROLL: 'scroll',

	KEYDOWN: 'keydown',
	KEYUP: 'keyup',

	COMPLETE: 'complete',
	EACH: 'each',

	CHANGE: 'change',
	BLUR: 'blur',
	FOCUS: 'focus'
};

var MouseEvent = exports.MouseEvent = {
	MOVE: mousemove,
	DOWN: mousedown,
	UP: mouseup,
	WHEEL: 'mousewheel',
	ENTER: 'mouseenter',
	LEAVE: 'mouseleave',
	CLICK: 'click'
};

var KeyboardEvent = exports.KeyboardEvent = {

	KEYDOWN: 'keydown',
	KEYUP: 'keyup',
	KEYPRESS: 'keypress'

};

var Tab = exports.Tab = {

	ENTER: 'tab:enter',
	LEAVE: 'tab:leave'

};

},{}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ImageUtils = function () {
	function ImageUtils() {
		_classCallCheck(this, ImageUtils);
	}

	_createClass(ImageUtils, [{
		key: 'getCoverSizeImage',
		value: function getCoverSizeImage(picWidth, picHeight, containerWidth, containerHeight) {

			var pw = picWidth,
			    ph = picHeight,
			    cw = containerWidth || window.screenWidth,
			    ch = containerHeight || window.screenHeight,
			    pr = pw / ph,
			    cr = cw / ch;

			if (cr < pr) {
				return {
					'width': ch * pr,
					'height': ch,
					'top': 0,
					'left': -(ch * pr - cw) * 0.5
				};
			} else {
				return {
					'width': cw,
					'height': cw / pr,
					'top': -(cw / pr - ch) * 0.5,
					'left': 0
				};
			}
		}
	}]);

	return ImageUtils;
}();

exports.default = new ImageUtils();

},{}],25:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventDispatcher2 = require('./EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _Viewport = require('./Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _Events = require('./Events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Keyboard = function (_EventDispatcher) {
	_inherits(Keyboard, _EventDispatcher);

	function Keyboard() {
		_classCallCheck(this, Keyboard);

		var _this = _possibleConstructorReturn(this, (Keyboard.__proto__ || Object.getPrototypeOf(Keyboard)).call(this));

		_this.keycode_names = {
			91: 'cmd',
			17: 'ctrl',
			32: 'space',
			16: 'shift',
			18: 'alt',
			20: 'caps',
			9: 'tab',
			13: 'enter',
			8: 'backspace',
			38: 'up',
			39: 'right',
			40: 'down',
			37: 'left',
			27: 'esc'
		};

		_this.downs = [];

		_this._initEvents();
		_this._generateEvents();

		return _this;
	}

	_createClass(Keyboard, [{
		key: '_initEvents',
		value: function _initEvents() {

			_Viewport2.default.document.on(_Events.KeyboardEvent.KEYDOWN, this._onKeyDown.bind(this)).on(_Events.KeyboardEvent.KEYUP, this._onKeyUp.bind(this));
		}
	}, {
		key: '_onKeyUp',
		value: function _onKeyUp(e) {

			if (this.downs.includes(e.keyCode)) {

				var index = this.downs.indexOf(e.keyCode);
				var character = this._keycodeToCharacter(e.keyCode);

				this.dispatch(_Events.KeyboardEvent[character.toUpperCase()]);

				this.downs.splice(index, 1);
			}
		}
	}, {
		key: '_onKeyDown',
		value: function _onKeyDown(e) {

			this.downs.push(e.keyCode);
		}
	}, {
		key: '_generateEvents',
		value: function _generateEvents() {

			for (var i = 0; i < 130; i++) {

				var character = this._keycodeToCharacter(i);

				if (character !== '') {
					_Events.KeyboardEvent[character.toUpperCase()] = 'keypressed:' + character;
				}
			}
		}
	}, {
		key: '_keycodeToCharacter',
		value: function _keycodeToCharacter(keycode) {

			var output = this.keycode_names[keycode];

			if (!output) {
				output = String.fromCharCode(keycode).toLowerCase();
			}

			return output;
		}
	}]);

	return Keyboard;
}(_EventDispatcher3.default);

exports.default = new Keyboard();

},{"./EventDispatcher":22,"./Events":23,"./Viewport":31}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Normalize = function () {
	function Normalize() {
		_classCallCheck(this, Normalize);
	}

	_createClass(Normalize, [{
		key: "transform",
		value: function transform(elm, _transform) {

			if (elm) {
				elm.style.transform = _transform;
				elm.style.webkitTransform = _transform;
				elm.style.mozTransform = _transform;
			}
		}
	}, {
		key: "transformOrigin",
		value: function transformOrigin(elm, _transformOrigin) {

			if (elm) {
				elm.style.transformOrigin = _transformOrigin;
				elm.style.webkitTransformOrigin = _transformOrigin;
				elm.style.mozTransformOrigin = _transformOrigin;
			}
		}
	}]);

	return Normalize;
}();

exports.default = new Normalize();

},{}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventDispatcher2 = require('./EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _TemplateRenderer = require('./TemplateRenderer');

var _TemplateRenderer2 = _interopRequireDefault(_TemplateRenderer);

var _Viewport = require('./Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _Events = require('./Events');

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Page = function (_EventDispatcher) {
	_inherits(Page, _EventDispatcher);

	function Page(data, template) {
		_classCallCheck(this, Page);

		var _this = _possibleConstructorReturn(this, (Page.__proto__ || Object.getPrototypeOf(Page)).call(this));

		_this.data = data;
		_this.template = template;

		_this._render();

		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(Page, [{
		key: '_render',
		value: function _render() {

			var data = this.data;

			// Convert string template into template string (need to find a better way than eval)

			var output = _TemplateRenderer2.default.render(this.template, data);
			this.$container = (0, _jquery2.default)(output);
			(0, _jquery2.default)('.page-container').html(this.$container);

			this._initContent();
			this._initEvents();
		}
	}, {
		key: '_initContent',
		value: function _initContent() {}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			if (this._onResize) {
				_Viewport2.default.on(_Events.Event.RESIZE, this._onResize.bind(this));
			}

			// ---o Only launch the ticker when the page needs it
			if (this._onUpdate) {
				TweenMax.ticker.addEventListener("tick", this._onUpdate.bind(this));
			}
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onResize',
		value: function _onResize() {}

		// --------------------------------------------------------------o Public

	}, {
		key: 'enter',
		value: function enter() {}
	}, {
		key: 'exit',
		value: function exit() {}
	}, {
		key: 'destroy',
		value: function destroy() {

			_Viewport2.default.off(_Events.Event.RESIZE + '.page');
		}
	}]);

	return Page;
}(_EventDispatcher3.default);

exports.default = Page;

},{"./EventDispatcher":22,"./Events":23,"./TemplateRenderer":29,"./Viewport":31,"jquery":"jquery"}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventDispatcher2 = require('./EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _page = require('page');

var _page2 = _interopRequireDefault(_page);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _data = require('./../data/data.json');

var _data2 = _interopRequireDefault(_data);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Router = function (_EventDispatcher) {
	_inherits(Router, _EventDispatcher);

	function Router() {
		var _ref;

		var _temp, _this, _ret;

		_classCallCheck(this, Router);

		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = Router.__proto__ || Object.getPrototypeOf(Router)).call.apply(_ref, [this].concat(args))), _this), _this.REQUEST_START = 'router:request_start', _this.REQUEST_END = 'router:request_end', _this.REQUEST_PENDING = 'router:request_pending', _temp), _possibleConstructorReturn(_this, _ret);
	}

	_createClass(Router, [{
		key: 'init',
		value: function init() {
			var _this2 = this;

			this.firstRequest = false;
			this.currentRoute = undefined;

			var routes = _data2.default._routes;

			var _loop = function _loop(path) {

				var route = routes[path];

				(0, _page2.default)(ROOT_PATH + path, function (ctx) {

					if (typeof route !== 'string') {
						if (route.redirect) {
							(0, _page2.default)(route.redirect);
							return;
						}
					}

					_this2.prevRoute = _this2.currentRoute;

					_this2.currentRoute = {
						routePath: path,
						path: ctx.path,
						params: ctx.params,
						class: route
					};

					_this2.dispatch(_this2.REQUEST_START, _this2.currentRoute);

					if (_data2.default.ajaxEnabled === true && _this2.firstRequest === true) {

						_this2.request(ctx.path);

						return;
					}

					_this2.firstRequest = true;

					_this2.dispatch(_this2.REQUEST_END);
				});
			};

			for (var path in routes) {
				_loop(path);
			};

			(0, _page2.default)();
		}

		// --------------------------o Private

		// --------------------------o Public

	}, {
		key: 'request',
		value: function request(url) {
			var _this3 = this;

			_superagent2.default.get(url).set('X-Requested-With', 'XMLHttpRequest').end(function (err, response) {

				if (err !== null) {

					return;
				}

				_this3.dispatch(_this3.REQUEST_END, response);
			});
		}
	}, {
		key: 'pushURL',
		value: function pushURL(path) {

			window.history.pushState({ 'path': path }, '', path, '');
		}
	}, {
		key: 'replaceURL',
		value: function replaceURL(path) {

			window.history.replaceState({ 'path': path }, '', path, '');
		}
	}]);

	return Router;
}(_EventDispatcher3.default);

exports.default = new Router();

},{"./../data/data.json":33,"./EventDispatcher":22,"jquery":"jquery","page":"page","superagent":1}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _twig = require('twig');

var _twig2 = _interopRequireDefault(_twig);

var _TextUtils = require('./TextUtils');

var _TextUtils2 = _interopRequireDefault(_TextUtils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TemplateRenderer = function () {
	function TemplateRenderer() {
		_classCallCheck(this, TemplateRenderer);

		this.engine = _twig.twig;

		var filters = {
			'icon': this.icon,
			'handleize': this.handleize
		};

		for (var filterName in filters) {
			_twig2.default.extendFunction(filterName, filters[filterName]);
		}
	}

	_createClass(TemplateRenderer, [{
		key: 'render',
		value: function render(template, data) {

			if (typeof template !== 'string') {
				throw 'HM Error: Please provide a template';
				return '';
			}

			if (!data) {
				data = {};
			}

			template = (0, _twig.twig)({
				data: template
			});

			var output = template.render(data);

			return output;
		}
	}, {
		key: 'handleize',
		value: function handleize(str) {

			return _TextUtils2.default.handleize(str);
		}

		// ----------------------------------------o Filters

	}, {
		key: 'icon',
		value: function icon(_icon) {

			return '\n\t\t\t<svg class="icon ' + _icon + '">\n\t\t\t\t<use xlink:href="#' + _icon + '""></use>\n\t\t\t</svg>\n\t\t';
		}
	}]);

	return TemplateRenderer;
}();

exports.default = new TemplateRenderer();

},{"./TextUtils":30,"twig":"twig"}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TextUtils = function () {
	function TextUtils() {
		_classCallCheck(this, TextUtils);
	}

	_createClass(TextUtils, [{
		key: 'handleize',
		value: function handleize(str) {

			return str.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
		}
	}, {
		key: 'isEmpty',
		value: function isEmpty(str) {

			return str.length === 0;
		}
	}, {
		key: 'isEmail',
		value: function isEmail(str) {

			var reg = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
			return reg.test(str);
		}
	}]);

	return TextUtils;
}();

exports.default = new TextUtils();

},{}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventDispatcher2 = require('./EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _Events = require('./Events');

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Viewport = function (_EventDispatcher) {
	_inherits(Viewport, _EventDispatcher);

	function Viewport() {
		_classCallCheck(this, Viewport);

		var _this = _possibleConstructorReturn(this, (Viewport.__proto__ || Object.getPrototypeOf(Viewport)).call(this));

		_this.$window = (0, _jquery2.default)(window);
		_this.$body = (0, _jquery2.default)('body');
		_this.document = (0, _jquery2.default)(document);

		_this.width = _this.$window.width();
		_this.height = _this.$window.height();
		_this.screenWidth = screen.width;
		_this.screenHeight = screen.height;

		_this.tabLeft = false;
		_this.isBodyFixed = false;
		_this.savedScroll = 0;

		_this.isUAMobile = false;
		if (navigator.userAgent.toLowerCase().match('android|iphone|ipad')) {
			_this.isUAMobile = true;
		}

		_this._initContent();
		_this._initEvents();

		return _this;
	}

	// ------------------------------------------------------------o Private

	_createClass(Viewport, [{
		key: '_initContent',
		value: function _initContent() {

			this._onResize();
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			this.$window.on('load resize', this._onResize.bind(this)).on('blur', this._onWindowBlur.bind(this)).on('focus', this._onWindowFocus.bind(this));
		}

		// ------------------------------------------------------------o Listeners

	}, {
		key: '_onResize',
		value: function _onResize() {

			this.width = this.$window.width();
			this.height = this.$window.height();
			this.screenWidth = screen.width;
			this.screenHeight = screen.height;

			this.isMobile = false;

			if (this.width < 500) {
				this.isMobile = true;
			}

			this.dispatch(_Events.Event.RESIZE);
		}
	}, {
		key: '_onWindowBlur',
		value: function _onWindowBlur() {

			this.tabLeft = true;

			this.dispatch(_Events.Tab.LEAVE);
		}
	}, {
		key: '_onWindowFocus',
		value: function _onWindowFocus() {

			this.tabLeft - false;

			this.dispatch(_Events.Tab.ENTER);
		}

		// ------------------------------------------------------------o Public

	}, {
		key: 'fixBody',
		value: function fixBody() {

			if (this.isBodyFixed === true) {
				return;
			}

			this.savedScroll = this.$window.scrollTop();
			this.isBodyFixed = true;
			this.$body.addClass('fixed');

			//TweenMax.set(this.$body, {'y': - this.savedScroll});
		}
	}, {
		key: 'unfixBody',
		value: function unfixBody() {

			if (this.isBodyFixed === false) {
				return;
			}

			this.isBodyFixed = false;
			this.$body.removeClass('fixed');

			this.$window.scrollTop(this.savedScroll);

			//TweenMax.set(this.$body, {'y': 0});
		}
	}]);

	return Viewport;
}(_EventDispatcher3.default);

exports.default = new Viewport();

},{"./EventDispatcher":22,"./Events":23,"jquery":"jquery"}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventDispatcher2 = require('./EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _Router = require('./Router');

var _Router2 = _interopRequireDefault(_Router);

var _Page = require('./Page');

var _Page2 = _interopRequireDefault(_Page);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _data = require('./../data/data.json');

var _data2 = _interopRequireDefault(_data);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
	Create new object only for template data
*/

var ViewsManager = function (_EventDispatcher) {
	_inherits(ViewsManager, _EventDispatcher);

	function ViewsManager() {
		var _ref;

		var _temp, _this, _ret;

		_classCallCheck(this, ViewsManager);

		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = ViewsManager.__proto__ || Object.getPrototypeOf(ViewsManager)).call.apply(_ref, [this].concat(args))), _this), _this.REQUEST_START = 'router:request_start', _this.REQUEST_END = 'router:request_end', _temp), _possibleConstructorReturn(_this, _ret);
	}

	_createClass(ViewsManager, [{
		key: 'init',
		value: function init(pages) {

			this.pages = pages;

			this.currentClass = undefined;
			this.prevClass = undefined;

			this.pageContainer = (0, _jquery2.default)('.page-container');

			this._initEvents();
		}

		// --------------------------------------------------------------o Private

	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_Router2.default.on(_Router2.default.REQUEST_START, this._onRouterStart.bind(this)).on(_Router2.default.REQUEST_END, this._onRouterEnd.bind(this));
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onRouterStart',
		value: function _onRouterStart(res) {

			var pageSlug = res.class.toLowerCase();

			if (this.currentClass && pageSlug === this.currentClass.slug) {
				if (this.currentClass.shouldStayOnSamePage(res) === true) {
					this.dispatch(this.REQUEST_START, res);
					this.samePage = true;
					return;
				}
			}

			// ---o Handle last page
			var prevSlug = undefined;
			if (this.currentClass !== undefined) {
				this.prevClass = this.currentClass;
				prevSlug = this.prevClass.slug;
			}

			// ---o Handle new page
			var page = this.pages[pageSlug];
			this.currentClass = new page.class(pageSlug, prevSlug);

			// ---o Exit prev class
			if (this.prevClass) {
				this.prevClass.on(this.prevClass.EXITED, this._onPageExited.bind(this));
				this.prevClass.exit();
			}

			this.dispatch(this.REQUEST_START);
		}
	}, {
		key: '_onRouterEnd',
		value: function _onRouterEnd(response) {

			if (this.samePage === true) {
				this.samePage = false;
				return;
			}

			if (_Router2.default.currentRoute.class === undefined) {
				throw 'HM Error: Class doesn\'t exist. Please create one or check the URL.';
				return;
			}

			if (response) {
				this.currentClass.template = response.text;
			}
			this.currentClass.loaded = true;

			this.dispatch(this.REQUEST_END);
		}
	}, {
		key: '_onPagePreEntered',
		value: function _onPagePreEntered() {}
	}, {
		key: '_onPageEntered',
		value: function _onPageEntered() {}
	}, {
		key: '_onPageExited',
		value: function _onPageExited() {

			this.prevClass.off(_Page2.default.EXITED);

			this.currentClass.enter();
		}
	}]);

	return ViewsManager;
}(_EventDispatcher3.default);

exports.default = new ViewsManager();

},{"./../data/data.json":33,"./EventDispatcher":22,"./Page":27,"./Router":28,"jquery":"jquery"}],33:[function(require,module,exports){
module.exports={"ROOT_WEB":"http://hector.paris","ROOT_PATH":"","ASSETS":"/assets","MEDIAS":"/medias","_routes":{"/":"Home"},"analyticsId":"UA-86958192-1","metas":{"title":"Hector","description":"Hector"},"home":{"metas":{"title":"Hector - Les RH ont évolué, nous aussi.","description":"Hector est le cabinet de recrutement dédié aux  métiers RH. Nos méthodes et l’expertise de nos consultants sur le secteur nous permettent de constituer les meilleures équipes en ressources humaines chez nos partenaires."},"sections":[{"title":"Les RH ont évolué, nous aussi.","background":"/medias/section-0-background.jpg","mobileBackground":"/medias/section-0-background-mobile.jpg","text":"Hector est le cabinet de recrutement dédié aux  métiers RH. Nos méthodes et l’expertise de nos consultants sur le secteur nous permettent de constituer les meilleures équipes en ressources humaines chez nos partenaires."},{"title":"Nos <br> convictions","background":"/medias/section-1-background.jpg","slider":[{"title":"Rester a l’ecoute Des hommes et des nouvelles methodes rh","text":"Le monde du travail est en perpétuel changement. Aujourd’hui, les spécialistes RH et les méthodes de recrutement digitales se concurrencent. Plutôt que d’y voir une opposition, nous préférons y voir une complémentarité gage de réactivité et d’efficience."},{"title":"Partager notre processus <br/>de recrutement","text":"Pour que candidats et entreprises s’y retrouvent. Nous sommes transparents sur nos méthodes et actions car persuadés que tout bon recrutement est le fruit d’un véritable partenariat entre nous et les acteurs que nous accompagnons."},{"title":"Transmettre <br/>notre savoir-faire","text":"À ceux qui sauront l’exploiter. Véritables experts des ressources humaines, nos consultants connaissent le marché sur le bout des doigts ce qui leur permet de mettre en contact des entreprises et des candidats qui se correspondent réellement."},{"title":"Comprendre l’humain","text":"Pour recruter une personnalité avant tout. L’expérience de notre équipe cumulée à nos méthodes rigoureuses de qualification (tests psychologique, prise de références systématiques etc…) une fois les compétences métier validées nous assurent de contruire des relations long terme entre entreprises et candidats embauchés."}]},{"title":"Vous <br/>recrutez ?","background":"/medias/section-2-background.jpg","subtitle":"besoin de trouver le profil ideal pour mon equipe ?","buttons":[{"form":1,"text":"Rencontrons-nous"}],"items":[{"push":"Une relation unique entre un spécialiste rh et une entreprise","title":"Une relation unique","textTitle":"parce que chaque recrutement est specifique,","text":"nous dédions un interlocuteur spécialisé à chacun de nos clients. Une embauche réussie, c’est avant tout une collaboration réussie : nous privilégions la proximité et l’adaptation pour trouver le profil qui correspond à votre entreprise et à aucune autre."},{"push":"Une méthode minutieuse qui allie réactivité et rigueur","title":"Une méthode minutieuse","textTitle":"Nos resultats sont l’alliance d’une recherche approfondie,","text":"entre les bases de données de nos spécialistes, les nouvelles méthodes de sourcing digital et un process de recrutement consciencieux qui révèle la véritable valeur des candidats."}]},{"title":"Vous cherchez un job ?","background":"/medias/section-3-background.jpg","subtitle":"Envie de rejoindre une entreprise qui me ressemble","buttons":[{"text":"Nos offres","href":"https://www.linkedin.com/company/cabinet-hector/analytics?trk=top_nav_analytics"},{"form":0,"text":"Rencontrons-nous"}],"items":[{"push":"Découvrir nos métiers"},{"push":"Un réseau dense & actif","title":"Un réseau dense et actif","textTitle":"Vous n'êtes pas seul","text":"Bénéficiez de contacts dans tous les domaines d’activités grâce aux réseaux de nos experts RH. Chacun de nos partenaires est soigneusement sélectionné pour vous offrir les meilleures perspectives professionnelles possibles."},{"push":"Des experts RH, comme vous","title":"Des experts rh, comme vous","textTitle":"Qui de mieux que des specialistes RH","text":"pour recruter des spécialistes RH ? Conscients des problématiques de ce milieu et de vos attentes, nos consultants offrent à chaque profil l’attention qu’il mérite."}],"jobs":{"title":"Nos métiers","items":[{"name":"Généraliste RH","info":["Assistant RH","Chargé RH","Gestionnaire RH","Responsable RH / RRH","Human Resource Business Partner","Directeur RH / DRH"]},{"name":"Développement RH","info":["Recrutement","Formation","GPEC","Mobilité","Mobilité International","Relations écoles","Communication interne"]},{"name":"Droit Social / Relations Sociales","info":["Juriste Droit Social","Chargée des relations sociales","Responsable relations sociales","Directeur relations sociales"]},{"name":"Paie et ADP","info":["Assistant Paie","Gestionnaire Paie et Administration du Personnel","Responsable Paie et Administration du Personnel","Assistant Administration du personnel","Directeur Paie"]},{"name":"SIRH","info":["Chargé SIRH","Consultant SIRH","Responsable SIRH"]},{"name":"Rémunération et avantages sociaux","info":["Contrôleur de gestion sociale","Chargé de rémunération","Responsable C&B","Directeur C&B"]}]}},{"title":"Rencontrons <br/>nous","push":"<p>Vous cherchez<span>...</span><span>Un job</span><span>Un talent</span></p>","buttons":[{"text":"Un job","background":"/medias/section-5-pic-1.jpg","email":"jeremy@hector.paris, boris@urbanlinker.com","object":["Candidature","Autre"]},{"text":"Un talent","background":"/medias/section-5-pic-2.jpg","email":"jeremy@hector.paris, eleonore@hector.paris","object":["Je recrute","Autre"]}]}],"terms":{"title":"Mentions légales","text":"<p>Le présent site internet (ci-après le Site Web) est accessible à l’adresse <a href=\"http://www.hector.paris\" target=\"_blank\">http://www.hector.paris/</a></p><p>L’éditeur du Site Web est : La société HECTOR - SAS au capital de 5 000,00 euros, inscrite au RCS de PARIS sous le n° (en cours d’immatriculation), dont le siège social est situé10 rue du Faubourg Poissonnière - 75010 PARIS</p><p>Numéro de téléphone : 01 82 83 07 71Adresse email : <a href=\"mailto:contact@hector.paris\" target=\"_blank\">contact@hector.paris</a></p><p>Le responsable de la publication du Site Web est :<br/>Monsieur Boris de Chalvron</p><p>L’infogérance du Site Web est assurée par :<br/>La société Sweet Punk<br/>Dont le siège est 63 rue de Lancry - 75010 Paris - France<br/>Site internet : <a href=\"http://www.sweetpunk.com\" target=\"_blank\">www.sweetpunk.com</a><br/>Numéro de téléphone : +33 (0) 1 85 08 55 59</p><p>L’hébergement du Site Web est assuré par :<br/>La société OVH<br/>Dont le siège est 2 rue Kellermann - 59100 Roubaix - France<br/>Site internet : <a href=\"http://ovh.com\" target=\"_blank\">www.ovh.com</a></p>"}}}
},{}],34:[function(require,module,exports){
'use strict';

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _gsap = require('gsap');

var _MainHeader = require('./components/MainHeader');

var _MainHeader2 = _interopRequireDefault(_MainHeader);

var _MainFooter = require('./components/MainFooter');

var _MainFooter2 = _interopRequireDefault(_MainFooter);

var _Viewport = require('./core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _ViewsManager = require('./core/ViewsManager');

var _ViewsManager2 = _interopRequireDefault(_ViewsManager);

var _Router = require('./core/Router');

var _Router2 = _interopRequireDefault(_Router);

var _data = require('./data/data.json');

var _data2 = _interopRequireDefault(_data);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Import views


// ---o Init the rest of the core


// ---o Init header: has to be before the ViewsManager
// ---o Core
var requiredPages = {'index': require('./views/home/index.js')};
var requiredTemplates = {'index.html': require('./views/home/index.html.twig')};

var pages = {};
for (var key in requiredPages) {
	var page = requiredPages[key].default;
	var pageName = key.split('/')[0];

	// When only one template created
	if (pageName === 'index') {
		pageName = 'home';
	}

	pages[pageName] = {
		class: page,
		template: requiredTemplates[key]
	};
}

// ---o Order init for cycling thing
_ViewsManager2.default.init(pages);

_Viewport2.default.$body.prepend(_MainHeader2.default.$container);
_Viewport2.default.$body.append(_MainFooter2.default.$container);

_Router2.default.init();

},{"./components/MainFooter":17,"./components/MainHeader":19,"./core/Router":28,"./core/Viewport":31,"./core/ViewsManager":32,"./data/data.json":33,"./views/home/index.html.twig":38,"./views/home/index.js":39,"gsap":"gsap","jquery":"jquery"}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Component2 = require('./../core/Component');

var _Component3 = _interopRequireDefault(_Component2);

var _Events = require('./../core/Events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DropdownList = function (_Component) {
	_inherits(DropdownList, _Component);

	function DropdownList(data) {
		_classCallCheck(this, DropdownList);

		var _this = _possibleConstructorReturn(this, (DropdownList.__proto__ || Object.getPrototypeOf(DropdownList)).call(this, data));

		_this.$container = data.container;
		_this._initContent();
		_this._initEvents();
		return _this;
	}

	// --------------------------------------------------------------o Private

	_createClass(DropdownList, [{
		key: '_initContent',
		value: function _initContent() {

			this._isOpened = false;
			this._currentIndex = 0;

			this.$value = this.$container.find('.value');
			this.$items = this.$container.find('li');
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			this.$container.on(_Events.MouseEvent.CLICK, this._onClick.bind(this));
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onClick',
		value: function _onClick(e) {

			if (this._isOpened === true) {

				var $this = (0, _jquery2.default)(e.target);

				if ($this.is('li') === false) {
					$this = $this.parents('li');
				}
				var index = $this.index();

				this.displayItemAtIndex(index);

				this.close();
			} else {
				this.open();
			}
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'open',
		value: function open() {

			this._isOpened = true;

			this.$container.addClass('opened');
		}
	}, {
		key: 'close',
		value: function close() {

			this._isOpened = false;

			this.$container.removeClass('opened');
		}
	}, {
		key: 'displayItemAtIndex',
		value: function displayItemAtIndex(index) {

			var $item = this.$items.eq(index);

			this._currentIndex = index;

			$item.addClass('active').siblings().removeClass('active');

			this.$value.text($item.text());

			this.dispatch(DropdownList.CHANGE, this, $item);
		}
	}, {
		key: 'getCurrentIndex',
		value: function getCurrentIndex() {

			return this._currentIndex;
		}
	}]);

	return DropdownList;
}(_Component3.default);

DropdownList.CHANGE = 'dropdownlist:change';
exports.default = DropdownList;

},{"./../core/Component":21,"./../core/Events":23,"jquery":"jquery"}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _EventDispatcher2 = require('./../core/EventDispatcher');

var _EventDispatcher3 = _interopRequireDefault(_EventDispatcher2);

var _Events = require('./../core/Events');

var _TextUtils = require('./../core/TextUtils');

var _TextUtils2 = _interopRequireDefault(_TextUtils);

var _DropdownList = require('./DropdownList');

var _DropdownList2 = _interopRequireDefault(_DropdownList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Form = function (_EventDispatcher) {
	_inherits(Form, _EventDispatcher);

	function Form(options) {
		_classCallCheck(this, Form);

		var _this = _possibleConstructorReturn(this, (Form.__proto__ || Object.getPrototypeOf(Form)).call(this));

		_this.$container = options.container;

		_this._initContent();
		_this._initEvents();

		return _this;
	}

	_createClass(Form, [{
		key: '_initContent',
		value: function _initContent() {

			this.$fieldsets = this.$container.find('fieldset');
			this.$inputs = this.$container.find('input');

			this.$successMessage = this.$container.find('.success-message');

			this.$submitButton = this.$container.find('.submit-button');

			this._initDropdownLists();
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			this.$submitButton.on(_Events.MouseEvent.CLICK, this._onSubmitButtonClick.bind(this));

			this.$container.on('submit', this._onFormSubmit.bind(this));

			this.$container.find('.input, .textarea, .dropdown-list').on(_Events.MouseEvent.CLICK, this._onItemClick.bind(this));

			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = this.dropdownLists[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var dropdownList = _step.value;

					dropdownList.on(_DropdownList2.default.CHANGE, this._onDropdownListChange);
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}
		}
	}, {
		key: '_initDropdownLists',
		value: function _initDropdownLists() {

			var $dropdownLists = this.$container.find('.dropdown-list');
			this.dropdownLists = [];

			for (var i = 0; i < $dropdownLists.length; i++) {
				var $elm = $dropdownLists.eq(i);
				var item = new _DropdownList2.default({
					container: $elm
				});
				this.dropdownLists.push(item);
			}
		}
	}, {
		key: '_preSubmit',
		value: function _preSubmit() {

			var fields = [this.$container.find('input[type="email"]'), this.$container.find('input[type="hidden"]'), this.$container.find('textarea')];

			var isValid = true;
			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = fields[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var field = _step2.value;

					var val = field.val();

					if (val === '') {
						isValid = false;
						field.parents('.dropdown-list, .input, .textarea').addClass('error');
					}
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			if (isValid === true) {
				this._submit();
			}
		}
	}, {
		key: '_submit',
		value: function _submit() {
			var _this2 = this;

			var fields = this.$container.serialize();

			fields += '&to=' + this.$container.attr('data-to');

			_jquery2.default.ajax({
				method: "POST",
				url: this.$container.attr('action'),
				data: fields,
				dataType: 'json'
			}).done(function (msg) {
				if (msg.success === true) {
					_this2.$successMessage.addClass('displayed');

					setTimeout(function () {
						_this2.$successMessage.removeClass('displayed');
					}, 3000);
				}
			});
		}

		// --------------------------------------------------------------o Private

	}, {
		key: '_onSubmitButtonClick',
		value: function _onSubmitButtonClick(e) {

			this._preSubmit();
		}
	}, {
		key: '_onFormSubmit',
		value: function _onFormSubmit() {

			this._preSubmit();

			return false;
		}
	}, {
		key: '_onDropdownListChange',
		value: function _onDropdownListChange(item, elm) {

			var input = item.$container.find('input[type=hidden]');
			var text = elm.text();

			input.val(text);
		}
	}, {
		key: '_onItemClick',
		value: function _onItemClick(e) {

			var $this = (0, _jquery2.default)(e.currentTarget);
			$this.removeClass('error');

			$this.find('input, textarea').focus();
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'show',
		value: function show() {

			this.$container.css('display', 'block');
		}
	}, {
		key: 'hide',
		value: function hide() {

			this.$container.css('display', 'none');
		}
	}]);

	return Form;
}(_EventDispatcher3.default);

exports.default = Form;

},{"./../core/EventDispatcher":22,"./../core/Events":23,"./../core/TextUtils":30,"./DropdownList":35,"jquery":"jquery"}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _Component2 = require('./../core/Component');

var _Component3 = _interopRequireDefault(_Component2);

var _Keyboard = require('./../core/Keyboard');

var _Keyboard2 = _interopRequireDefault(_Keyboard);

var _Events = require('./../core/Events');

var _Viewport = require('./../core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _ImageUtils = require('./../core/ImageUtils');

var _ImageUtils2 = _interopRequireDefault(_ImageUtils);

var _Normalize = require('./../core/Normalize');

var _Normalize2 = _interopRequireDefault(_Normalize);

var _MainHeader = require('./../components/MainHeader');

var _MainHeader2 = _interopRequireDefault(_MainHeader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomeSection = function (_Component) {
	_inherits(HomeSection, _Component);

	function HomeSection() {
		_classCallCheck(this, HomeSection);

		return _possibleConstructorReturn(this, (HomeSection.__proto__ || Object.getPrototypeOf(HomeSection)).apply(this, arguments));
	}

	_createClass(HomeSection, [{
		key: '_initContent',


		// --------------------------------------------------------------o Private

		value: function _initContent() {

			_get(HomeSection.prototype.__proto__ || Object.getPrototypeOf(HomeSection.prototype), '_initContent', this).call(this);

			this.backgroundLoaded = false;
			this.$background = this.$container.find('.background');

			this.$content = this.$container.find('.content');

			this.$popinLinks = this.$container.find('.popins-links li');
			this.$popins = this.$container.find('.popins .popin');

			this.$pushButtons = this.$container.find('.buttons .button');

			this.$scrollButton = (0, _jquery2.default)('.scroll-button');

			this.$popinCloseButton = undefined;
			this.isCloseButtonDisplayed = false;
			this.currentPopinIndex = undefined;
			this.isActive = false;
			this.currentPopinClass = undefined;
			this.isMobile = false;

			this.pos = {};
			this.pos.x = {};
			this.pos.y = {};
			this.pos.x.curr = 0;
			this.pos.x.dest = 0;
			this.pos.x.prev = 0;
			this.pos.y.curr = 0;
			this.pos.y.dest = 0;
			this.pos.y.prev = 0;
			this.pos.ease = 0.05;

			this._initSquares();
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(HomeSection.prototype.__proto__ || Object.getPrototypeOf(HomeSection.prototype), '_initEvents', this).call(this);

			if (this.$background.length > 0) {
				this.$background.on('complete load', this._onBackgroundLoad.bind(this));
			}

			if (this.$popinLinks.length > 0) {
				this.$popinLinks.on(_Events.MouseEvent.CLICK, this._onPopinLinkClick.bind(this));
			}

			if (this.$pushButtons.length > 0) {
				this.$pushButtons.on(_Events.MouseEvent.CLICK, this._onPushButtonClick.bind(this));
			}

			_Keyboard2.default.on(_Events.KeyboardEvent.RIGHT, this._onKeyRight.bind(this)).on(_Events.KeyboardEvent.LEFT, this._onKeyLeft.bind(this)).on(_Events.KeyboardEvent.ESC, this._onKeyEsc.bind(this));
		}
	}, {
		key: '_initSquares',
		value: function _initSquares() {

			var $squaresContainer = this.$container.find('.squares-container');
			var nbSquares = 3 + ~~(Math.random() * 7);

			this.$squares = [];

			for (var i = 0; i < nbSquares; i++) {
				var x = 50 + ~~(Math.random() * _Viewport2.default.width) - 100;
				var y = 50 + ~~(Math.random() * _Viewport2.default.height) - 100;
				var sizeX = 10 + ~~(Math.random() * 50);
				var sizeY = 10 + ~~(Math.random() * 50);

				var square = (0, _jquery2.default)('<div class="square" style="top:' + y + 'px;left:' + x + 'px;width:' + sizeX + 'px;height:' + sizeY + 'px;"><div></div></div>');

				$squaresContainer.append(square);
				this.$squares.push(square);
			}
		}
	}, {
		key: '_resizeBackground',
		value: function _resizeBackground() {

			if (this.backgroundLoaded === false) {
				return;
			}

			var background = this.$background[0];
			var dims = _ImageUtils2.default.getCoverSizeImage(background.naturalWidth, background.naturalHeight, _Viewport2.default.width, _Viewport2.default.height);

			this.$background.css(dims);
		}
	}, {
		key: '_showCloseIcon',
		value: function _showCloseIcon() {

			if (this.isCloseButtonDisplayed === true) {
				return;
			}

			this.isCloseButtonDisplayed = true;

			this.$popinCloseButton.addClass('displayed');

			if (this.isMobile === false) {
				_Viewport2.default.$body.addClass('no-cursor');
			}
		}
	}, {
		key: '_hideCloseIcon',
		value: function _hideCloseIcon() {

			if (this.isCloseButtonDisplayed === false) {
				return;
			}

			this.isCloseButtonDisplayed = false;

			this.$popinCloseButton.removeClass('displayed');
			_Viewport2.default.$body.removeClass('no-cursor');
		}
	}, {
		key: '_openPopin',
		value: function _openPopin(index) {
			var _this2 = this;

			this.currentPopinIndex = index;
			this.currentPopinClass = this.$popins.eq(index).attr('class');

			this.$popins.eq(index).addClass('displayed');

			this.$popinCloseButton = this.$popins.eq(index).siblings('.close-icon');

			this._showCloseIcon();

			this.$container.addClass('hidden');
			this.$scrollButton.addClass('hidden');

			if (_Viewport2.default.isMobile) {
				_MainHeader2.default.hideUI();
			}

			if (_Viewport2.default.isUAMobile) {
				this.$popinCloseButton.on(_Events.MouseEvent.CLICK, this._onPopinCloseButtonClick.bind(this));
				return;
			}

			setTimeout(function () {
				_Viewport2.default.$body.on(_Events.MouseEvent.MOVE + '.popin', _this2._onMouseMove.bind(_this2)).on(_Events.MouseEvent.CLICK + '.popin', _this2._onMouseClick.bind(_this2));
			}, 10);
		}
	}, {
		key: '_closePopin',
		value: function _closePopin() {

			if (this.$popinCloseButton === undefined) {
				return;
			}

			this.$popins.eq(this.currentPopinIndex).removeClass('displayed');

			this.currentPopinIndex = undefined;
			this.currentPopinClass = undefined;

			this._hideCloseIcon();

			this.$container.removeClass('hidden');
			this.$scrollButton.removeClass('hidden');

			if (_Viewport2.default.isMobile) {
				_MainHeader2.default.showUI();
			}

			if (_Viewport2.default.isUAMobile) {
				this.$popinCloseButton.off(_Events.MouseEvent.CLICK);
				return;
			}

			_Viewport2.default.$body.off(_Events.MouseEvent.MOVE + '.popin').off(_Events.MouseEvent.CLICK + '.popin');
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onBackgroundLoad',
		value: function _onBackgroundLoad() {

			this.backgroundLoaded = true;

			this._resizeBackground();
		}
	}, {
		key: '_onPopinLinkClick',
		value: function _onPopinLinkClick(e) {

			var $this = (0, _jquery2.default)(e.currentTarget);
			var index = $this.index();

			this._openPopin(index);
		}
	}, {
		key: '_onPushButtonClick',
		value: function _onPushButtonClick(e) {

			var $this = (0, _jquery2.default)(e.currentTarget);

			if ($this.attr('data-form')) {
				this.dispatch(HomeSection.PUSH_BUTTON_CLICK, $this.attr('data-form'));
			}
		}
	}, {
		key: '_onPopinCloseButtonClick',
		value: function _onPopinCloseButtonClick() {

			this._closePopin();
		}
	}, {
		key: '_onMouseMove',
		value: function _onMouseMove(e) {

			var $target = (0, _jquery2.default)(e.target);

			if ($target.parents('.popins, .main-header').length > 0) {
				this._hideCloseIcon();
			} else {
				this._showCloseIcon();
			}
		}
	}, {
		key: '_onMouseClick',
		value: function _onMouseClick(e) {

			var $target = (0, _jquery2.default)(e.target);

			if ($target.parents('.popins').length > 0) {
				return;
			}

			this._closePopin();
		}
	}, {
		key: '_onKeyLeft',
		value: function _onKeyLeft() {}
	}, {
		key: '_onKeyRight',
		value: function _onKeyRight() {}
	}, {
		key: '_onKeyEsc',
		value: function _onKeyEsc() {

			if (this.isActive !== true || this.currentPopinIndex === undefined) {
				return;
			}

			this._closePopin();
		}
	}, {
		key: '_onResize',
		value: function _onResize() {

			if (this.$background.length > 0) {
				this._resizeBackground();
			}

			if (_Viewport2.default.width < 500 && this.isMobile === false || _Viewport2.default.isUAMobile === true) {
				this.isMobile = true;

				if (this.$background.length) {
					_Normalize2.default.transform(this.$background[0], '');
				}

				if (this.$content.length) {
					_Normalize2.default.transform(this.$content[0], '');
				}

				if (this.$popinCloseButton !== undefined && this.currentPopinClass && this.currentPopinClass.indexOf('jobs') === -1) {
					_Normalize2.default.transform(this.$popinCloseButton[0], '');
					_Normalize2.default.transform(this.$popins.eq(this.currentPopinIndex)[0], '');
				}
			} else if (_Viewport2.default.width >= 500 && this.isMobile === true) {
				this.isMobile = false;
			}
		}
	}, {
		key: '_onUpdate',
		value: function _onUpdate() {

			//return;

			if (this.isActive === false || this.isMobile === true || _Viewport2.default.isUAMobile === true) {
				return;
			}

			this.pos.x.curr += (this.pos.x.dest - this.pos.x.curr) * this.pos.ease;
			this.pos.y.curr += (this.pos.y.dest - this.pos.y.curr) * this.pos.ease;

			if (this.$background.length) {
				var x = this.pos.x.curr * 0.01 * -1;
				var y = this.pos.y.curr * 0.01 * -1;

				_Normalize2.default.transform(this.$background[0], 'translate3d(' + x + 'px, ' + y + 'px, 0');
			}

			if (this.$content.length) {
				var _x = this.pos.x.curr * 0.02 * -1;
				var _y = this.pos.y.curr * 0.02 * -1;

				_Normalize2.default.transform(this.$content[0], 'translate3d(' + _x + 'px, ' + _y + 'px, 0');
			}

			if (this.$popinCloseButton !== undefined && this.currentPopinClass && this.currentPopinClass.indexOf('jobs') === -1) {
				var _x2 = this.pos.x.curr * 0.02 * -1;
				var _y2 = this.pos.y.curr * 0.02 * -1;

				_Normalize2.default.transform(this.$popinCloseButton[0], 'translate3d(' + this.pos.x.dest + 'px, ' + this.pos.y.dest + 'px, 0)');
				_Normalize2.default.transform(this.$popins.eq(this.currentPopinIndex)[0], 'translate3d(' + _x2 + 'px, ' + _y2 + 'px, 0)');
			}

			var inc = 0;

			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = this.$squares[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var $square = _step.value;


					var ease = 0.01 * inc;
					var _x3 = this.pos.x.curr * ease * -1;
					var _y3 = this.pos.y.curr * ease * -1;

					_Normalize2.default.transform($square[0], 'translate3d(' + _x3 + 'px, ' + _y3 + 'px, 0)');

					inc++;
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}
		}

		// --------------------------------------------------------------o Public

	}, {
		key: 'show',
		value: function show() {

			this.isActive = true;
			this.$container.addClass('active');
		}
	}, {
		key: 'hide',
		value: function hide() {

			this.isActive = false;
			this.$container.removeClass('active');

			this._closePopin();
		}
	}, {
		key: 'move',
		value: function move(x, y) {

			this.pos.x.dest = x;
			this.pos.y.dest = y;
		}
	}]);

	return HomeSection;
}(_Component3.default);

HomeSection.PUSH_BUTTON_CLICK = 'section:pushbuttonclick';
exports.default = HomeSection;

},{"./../components/MainHeader":19,"./../core/Component":21,"./../core/Events":23,"./../core/ImageUtils":24,"./../core/Keyboard":25,"./../core/Normalize":26,"./../core/Viewport":31,"jquery":"jquery"}],38:[function(require,module,exports){
module.exports = "<div class=\"page-home\">\n\t\n\t<div class=\"intro\">\n\t\t<div class=\"mask\">{{ icon('hector-logo') }}</div>\n\t\t<div class=\"mask\">{{ icon('hector-logo') }}</div>\n\t</div>\n\n\n</div>\n";

},{}],39:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _Page2 = require('./../../core/Page');

var _Page3 = _interopRequireDefault(_Page2);

var _Viewport = require('./../../core/Viewport');

var _Viewport2 = _interopRequireDefault(_Viewport);

var _Keyboard = require('./../../core/Keyboard');

var _Keyboard2 = _interopRequireDefault(_Keyboard);

var _Events = require('./../../core/Events');

var _MainHeader = require('./../../components/MainHeader');

var _MainHeader2 = _interopRequireDefault(_MainHeader);

var _MainFooter = require('./../../components/MainFooter');

var _MainFooter2 = _interopRequireDefault(_MainFooter);

var _data = require('./../../data/data.json');

var _data2 = _interopRequireDefault(_data);

var _HomeSection = require('./../../libs/HomeSection');

var _HomeSection2 = _interopRequireDefault(_HomeSection);

var _HomeSection3 = require('./../../components/HomeSection1');

var _HomeSection4 = _interopRequireDefault(_HomeSection3);

var _HomeSection5 = require('./../../components/HomeSection2');

var _HomeSection6 = _interopRequireDefault(_HomeSection5);

var _HomeSection7 = require('./../../components/HomeSection3');

var _HomeSection8 = _interopRequireDefault(_HomeSection7);

var _HomeSection9 = require('./../../components/HomeSection4');

var _HomeSection10 = _interopRequireDefault(_HomeSection9);

var _HomeSection11 = require('./../../components/HomeSection5');

var _HomeSection12 = _interopRequireDefault(_HomeSection11);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// ---o Section

var Home = function (_Page) {
	_inherits(Home, _Page);

	// --------------------------------------------------------------o Private

	function Home(data, template) {
		_classCallCheck(this, Home);

		template = require('./index.html.twig');
		data = _data2.default.home;

		return _possibleConstructorReturn(this, (Home.__proto__ || Object.getPrototypeOf(Home)).call(this, data, template));
	}

	_createClass(Home, [{
		key: '_initContent',
		value: function _initContent() {

			_get(Home.prototype.__proto__ || Object.getPrototypeOf(Home.prototype), '_initContent', this).call(this);

			var sections = [_HomeSection4.default, _HomeSection6.default, _HomeSection8.default, _HomeSection10.default, _HomeSection12.default];

			this.sections = [];

			for (var i = 0; i < sections.length; i++) {
				var section = new sections[i](_data2.default.home.sections[i]);
				this.$container.append(section.$container);
				this.sections.push(section);
			}

			this.currentIndex = undefined;
			this.isAnimating = false;
			this.prevScroll = 0;
			this.currentScroll = 0;
			this.isScrollable = false;

			this.isMobile = false;
			this.mouseShiftY = 0;

			this._initIntro();

			//this._goTo(0);
		}
	}, {
		key: '_initEvents',
		value: function _initEvents() {

			_get(Home.prototype.__proto__ || Object.getPrototypeOf(Home.prototype), '_initEvents', this).call(this);

			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = this.sections[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var section = _step.value;

					section.on(_HomeSection2.default.PUSH_BUTTON_CLICK, this._onSectionPushButtonClick.bind(this));
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}

			_Viewport2.default.$body.on('mousewheel wheel', this._onMouseWheel.bind(this)).on(_Events.MouseEvent.MOVE, this._onMouseMove.bind(this));

			_MainHeader2.default.on(_MainHeader2.default.NAV_ITEM_CLICK, this._onMainHeaderNavItemClick.bind(this));

			_MainFooter2.default.on(_MainFooter2.default.SCROLL_BUTTON_CLICK, this._onMainFooterScrollButtonClick.bind(this));

			_Keyboard2.default.on(_Events.KeyboardEvent.UP, this._onKeyUp.bind(this)).on(_Events.KeyboardEvent.RIGHT, this._onKeyRight.bind(this)).on(_Events.KeyboardEvent.DOWN, this._onKeyDown.bind(this)).on(_Events.KeyboardEvent.LEFT, this._onKeyLeft.bind(this));
		}
	}, {
		key: '_initIntro',
		value: function _initIntro() {
			var _this2 = this;

			var $intro = this.$container.find('.intro');

			setTimeout(function () {
				$intro.addClass('animating');
			}, 1000);

			$intro.one('transitionend', function (e) {
				_this2._goTo(0);

				_MainHeader2.default.display();
				_MainFooter2.default.display();

				$intro.addClass('hidden').on('transitionend', function () {
					$intro.remove();
					_this2.isScrollable = true;
				});
			});
		}
	}, {
		key: '_initMobile',
		value: function _initMobile() {

			this.isMobile = true;

			this.$container.on(_Events.MouseEvent.DOWN, this._onMouseDown.bind(this)).on(_Events.MouseEvent.UP, this._onMouseUp.bind(this));
		}
	}, {
		key: '_destroyMobile',
		value: function _destroyMobile() {

			this.isMobile = false;

			this.$container.off(_Events.MouseEvent.DOWN).off(_Events.MouseEvent.UP);
		}
	}, {
		key: '_goTo',
		value: function _goTo(index) {
			var _this3 = this;

			if (index === this.currentIndex) {
				return;
			}

			if (index > this.sections.length - 1 || index < 0) {
				return;
			}

			this.isAnimating = true;

			this.prevIndex = this.currentIndex;
			this.currentIndex = index;

			if (this.prevIndex !== undefined) {
				this.sections[this.prevIndex].hide();
			}

			this.sections[this.currentIndex].show();

			_MainHeader2.default.activeItem(index);

			clearTimeout(this.animatingTimer);
			this.animatingTimer = setTimeout(function () {
				_this3.isAnimating = false;
			}, 2000);
		}

		// --------------------------------------------------------------o Listeners

	}, {
		key: '_onSectionPushButtonClick',
		value: function _onSectionPushButtonClick(formIndex) {

			this._goTo(this.sections.length - 1);
			this.sections[this.sections.length - 1].openForm(~~formIndex);
		}
	}, {
		key: '_onMouseWheel',
		value: function _onMouseWheel(e) {

			e.preventDefault();

			if (this.isAnimating === true || this.isScrollable !== true) {
				return;
			}

			this.currentScroll = e.originalEvent.deltaY || -e.originalEvent.wheelDeltaY || e.deltaY;

			if (this.currentScroll > 10) {
				this._goTo(this.currentIndex + 1);
			} else if (this.currentScroll < -10) {
				this._goTo(this.currentIndex - 1);
			}

			return;

			this.prevScroll = this.currentScroll;
			this.currentScroll = e.originalEvent.wheelDeltaY;

			if (Math.abs(this.prevScroll) > Math.abs(this.currentScroll)) {
				return;
			}
		}
	}, {
		key: '_onMouseDown',
		value: function _onMouseDown(e) {

			if (e.type !== 'touchstart') {
				return;
			}

			this.isMouseDown = true;
			this.mouseShiftY = 0;
			this.mouseInitY = e.originalEvent.touches[0].pageY;
		}
	}, {
		key: '_onMouseMove',
		value: function _onMouseMove(e) {
			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {

				for (var _iterator2 = this.sections[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var section = _step2.value;

					if (section.isActive) {
						section.move(e.pageX, e.pageY);
					}
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			if (this.isMobile === false || this.isMouseDown === false) {
				return;
			}

			if (!e.originalEvent.touches) {
				return;
			}
			this.mouseShiftY = this.mouseInitY - e.originalEvent.touches[0].pageY;

			if (this.mouseShiftY > 50) {
				this.isMouseDown = false;
				this._goTo(this.currentIndex + 1);
			} else if (this.mouseShiftY < -50) {
				this.isMouseDown = false;
				this._goTo(this.currentIndex - 1);
			}
		}
	}, {
		key: '_onMouseUp',
		value: function _onMouseUp() {

			this.isMouseDown = false;
		}
	}, {
		key: '_onMainHeaderNavItemClick',
		value: function _onMainHeaderNavItemClick(index) {

			this._goTo(index);
		}
	}, {
		key: '_onMainFooterScrollButtonClick',
		value: function _onMainFooterScrollButtonClick() {

			this._goTo(this.currentIndex + 1);
		}
	}, {
		key: '_onKeyLeft',
		value: function _onKeyLeft() {

			if (this.currentIndex === 1) {
				//this.convictionsSlider.prev();
			}
		}
	}, {
		key: '_onKeyRight',
		value: function _onKeyRight() {

			if (this.currentIndex === 1) {
				//this.convictionsSlider.next();
			}
		}
	}, {
		key: '_onKeyUp',
		value: function _onKeyUp() {

			if (this.isScrollable !== true) {
				return;
			}

			this._goTo(this.currentIndex - 1);
		}
	}, {
		key: '_onKeyDown',
		value: function _onKeyDown() {

			if (this.isScrollable !== true) {
				return;
			}

			this._goTo(this.currentIndex + 1);
		}

		// --------------------------------------------------------------o Listeners


		// --------------------------------------------------------------o Public

	}, {
		key: '_onResize',
		value: function _onResize() {

			this.$container.css({
				'width': _Viewport2.default.width,
				'height': _Viewport2.default.height
			});

			_Viewport2.default.$body.css({
				'width': _Viewport2.default.width,
				'height': _Viewport2.default.height
			});

			if (_Viewport2.default.isMobile === true && this.isMobile === false) {
				this._initMobile();
			} else if (_Viewport2.default.isMobile === false && this.isMobile === true) {
				this._destroyMobile();
			}
		}
	}, {
		key: '_onUpdate',
		value: function _onUpdate() {}
	}]);

	return Home;
}(_Page3.default);

exports.default = Home;

},{"./../../components/HomeSection1":7,"./../../components/HomeSection2":9,"./../../components/HomeSection3":11,"./../../components/HomeSection4":13,"./../../components/HomeSection5":15,"./../../components/MainFooter":17,"./../../components/MainHeader":19,"./../../core/Events":23,"./../../core/Keyboard":25,"./../../core/Page":27,"./../../core/Viewport":31,"./../../data/data.json":33,"./../../libs/HomeSection":37,"./index.html.twig":38}]},{},[34])


//# sourceMappingURL=maps/scripts.js.map
