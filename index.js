/**
 * Mock REST requests.
 *
 * See README.md for documentation of options.
 *
 * @param {Object} options
 * @return {Function} middleware
 * @api public
 */
var mocks = {
    GET: {},
    PUT: {},
    POST: {},
    PATCH: {},
    DELETE: {}
};
var url = require('url');
var _ = require('underscore');

module.exports = function mockRequests() {
    'use strict';

    var renderResponse = function (res, mockedResponse, body) {
        res.writeHead(mockedResponse.responseCode, mockedResponse.headers);
        res.write(JSON.stringify(body));
        res.end();
    };

    return function (req, res, next) {
        var uri = url.parse(req.url);
        var path = uri.pathname;

        var body = '';
        if (req.method === 'POST' && req.url.indexOf('/mock') === 0) {
            req.on('data', function (data) {
                body += data;
            });
            req.on('end', function () {

                var headers = {
                    'Content-Type': req.headers['content-type']
                };
                for (var key in req.headers) {
                    if (req.headers.hasOwnProperty(key)) {
                        if (key.indexOf('mock-header-') === 0) {
                            headers[key.substring(12)] = req.headers[key];
                        }
                    }
                }

                path = path.substring(5);

                //console.info('storing for', path);
                mocks['GET'][path] = {
                    body: JSON.parse(body),
                    responseCode: req.headers['mock-response'] || 200,
                    headers: headers
                };
                res.writeHead(200);
                res.end();
            });
        } else if (req.url.indexOf('/reset') === 0) {
            mocks['GET'][req.url.substring(6)] = null;
            res.writeHead(200);
            res.end();
        } else if (path.substr(0, 4) === '/api') {
            //console.info('retrieving for', path);

            var detailID = -1;
            var detailMethod = '';
            var splits = path.split('/');
            splits = _.reject(splits, function(el){ return el === ''; });

            var methods = [];
            var ids = [];

            var base = _.filter(splits, function (el) {
                if (!isNaN(parseInt(el, 10))) {
                    ids.push(parseInt(el, 10));
                } else {
                    if(el !== 'api') {
                        methods.push(el);
                    }
                    return el;
                }
                return false;
            }).join('/');

            path = '/' + base + '/';

            var methodIdMap = {};
            for (var i = 0; i < ids.length; i++) {
                methodIdMap[methods[i]] = ids[i];
            }
            // not a nested response
            if (methods.length === ids.length) {
                detailID = ids[ids.length-1];
                detailMethod = methods[methods.length-1];
            }

            var mockedResponse = mocks['GET'][path];

            if (!mockedResponse) {
                res.writeHead(404);
                return res.end();
            }

            switch (req.method) {
                case 'POST':
                    req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    var item = _.findWhere(mockedResponse.body.results, {id: detailID});
                    if (item) {
                        body = _.extend(item, JSON.parse(body));
                        renderResponse(res, mockedResponse, body, next);
                    } else if (detailID === -1) {
                        // get highest ID
                        var obj = _.max(mockedResponse.body.results, function(obj){ return obj.id; });
                        body = JSON.parse(body);
                        body.id = obj.id + 1;
                        mockedResponse.body.results.push(body);
                        mockedResponse.body.count = mockedResponse.body.results.length;
                        renderResponse(res, mockedResponse, body, next);
                    } else {
                        next();
                    }
                });
                break;
                case 'PUT':
                    req.on('data', function (data) {
                    body += data;
                });
                req.on('end', function () {
                    var item = _.findWhere(mockedResponse.body.results, {id: detailID});
                    if (item) {
                        body = _.extend(item, JSON.parse(body));
                        renderResponse(res, mockedResponse, body, next);
                    }  else if (detailID === -1) {
                        // get highest ID
                        var obj = _.max(mockedResponse.body.results, function(obj){ return obj.id; });
                        body = JSON.parse(body);
                        body.id = obj.id + 1;
                        mockedResponse.body.results.push(body);
                        mockedResponse.body.count = mockedResponse.body.results.length;
                        renderResponse(res, mockedResponse, body, next);
                    } else {
                        next();
                    }
                        //console.info('PUT', {'error': 'Item with id:'+id+' not found.'});
                });
                break;
                case 'GET':
                    delete methodIdMap[detailMethod];
                    // returns one item
                    if (detailID > -1) {
                        methodIdMap.id = detailID;
                        body = _.findWhere(mockedResponse.body.results, methodIdMap);
                    } else {
                        body = _.where(mockedResponse.body.results, methodIdMap);
                    }
                    renderResponse(res, mockedResponse, body, next);
                break;
                case 'DELETE':

                    mockedResponse = mocks['GET'][path];
                var idx = -1;
                _.map(mockedResponse.body.results, function (el, i) {
                    if (el.id === detailID) {
                        body = el;
                        idx = i;
                    }
                });

                if (idx > -1) {
                    mockedResponse.body.results.splice(idx, 1);
                    mockedResponse.body.count = mockedResponse.body.results.length;
                }

                renderResponse(res, mockedResponse, body, next);
                break;
            }

        } else {
            next();
        }
    };
};
