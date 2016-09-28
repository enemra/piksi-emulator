'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = piksiEmulator;

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _stream = require('stream');

var _libsbp = require('libsbp');

var _construct = require('libsbp/javascript/sbp/construct');

var _construct2 = _interopRequireDefault(_construct);

var _msg = require('libsbp/javascript/sbp/msg');

var _navigation = require('libsbp/javascript/sbp/navigation');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defaultEcef = {
  x: -2706105.162741557,
  y: -4261224.166310791,
  z: 3885605.2890337044
}; /**
    * Copyright (C) 2016 Swift Navigation Inc.
    * Contact: Joshua Gross <josh@swift-nav.com>
    * This source is subject to the license found in the file 'LICENSE' which must
    * be distributed together with this source. All other rights reserved.
    *
    * THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND,
    * EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED
    * WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A PARTICULAR PURPOSE.
    */

var defaultLlh = {
  lat: 37.77348891054085,
  lon: -122.41772914435545,
  height: 60
};
var defaultSenderId = 0x42;

// Unix timestamp of the GPS epoch 1980-01-06 00:00:00 UTC
var gpsEpochSeconds = 315964800;
var weekSeconds = 60 * 60 * 24 * 7;

/**
 * Convert GPS moment timestamp (in GPS time, without leap seconds) to { wn, tow }.
 *
 * @param {moment} gpsTimestamp - A `moment` object representing a GPS timestamp,
 *   without leap-seconds.
 * @return {object} { wn, tow }
 */
function gpsTimestampToWnTow(gpsTimestamp) {
  var gpsTimeMs = gpsTimestamp - gpsEpochSeconds;
  var wn = Math.floor(gpsTimeMs / weekSeconds);
  var tow = gpsTimeMs - wn * weekSeconds;
  return { wn: wn, tow: tow };
}

/**
 * Open a piksi emulator on a port. Output given position solutions at the given rate.
 *
 * @param {number} port - HTTP port number to open up
 * @param {Object} ecef - ECEF position to use { x, y, z }, or default (Swift's SF office location)
 * @param {Object} llh - LLH position to use { lat, lon, height }, or default (Swift's SF office location)
 * @param {number} hz - Hertz rate to write solutions out at
 * @param {number} senderId - senderId of SBP messages
 * @param {number} jitter - a factor used to slightly randomize otherwise-static positions. If you want streams
 *   of dynamic positions in SBP, check out `sbp-synthetic-stream`.
 */
function piksiEmulator() {
  var port = arguments.length <= 0 || arguments[0] === undefined ? 77777 : arguments[0];
  var ecef = arguments.length <= 1 || arguments[1] === undefined ? defaultEcef : arguments[1];
  var llh = arguments.length <= 2 || arguments[2] === undefined ? defaultLlh : arguments[2];
  var hz = arguments.length <= 3 || arguments[3] === undefined ? 1 : arguments[3];
  var senderId = arguments.length <= 4 || arguments[4] === undefined ? defaultSenderId : arguments[4];
  var jitter = arguments.length <= 5 || arguments[5] === undefined ? 0 : arguments[5];

  (0, _assert2.default)(typeof port === 'number', 'port must be a number');
  (0, _assert2.default)(ecef && llh, 'ecef and llh must both be provided!');
  (0, _assert2.default)(ecef === defaultEcef && llh === defaultLlh || ecef !== defaultEcef && llh !== defaultLlh, 'you should either use default ECEF and LLH or change both - they should be consistent');
  (0, _assert2.default)(typeof ecef.x === 'number', 'must provide ecef X value as number');
  (0, _assert2.default)(typeof ecef.y === 'number', 'must provide ecef Y value as number');
  (0, _assert2.default)(typeof ecef.z === 'number', 'must provide ecef Z value as number');
  (0, _assert2.default)(typeof llh.lat === 'number', 'must provide llh lat value as number');
  (0, _assert2.default)(typeof llh.lon === 'number', 'must provide llh lon value as number');
  (0, _assert2.default)(typeof llh.height === 'number', 'must provide llh height value as number');
  (0, _assert2.default)(typeof hz === 'number', 'must provide hz value as number');
  (0, _assert2.default)(hz < 1000, 'hz cannot be greater than 1000');
  (0, _assert2.default)(typeof jitter === 'number', 'must provide jitter value as number');

  var outstream = new _stream.PassThrough();

  var jitterEcef = function jitterEcef(_ref) {
    var x = _ref.x;
    var y = _ref.y;
    var z = _ref.z;

    return {
      x: x + Math.random() * 1000 * jitter,
      y: y + Math.random() * 1000 * jitter,
      z: z + Math.random() * 1000 * jitter
    };
  };

  var jitterLlh = function jitterLlh(_ref2) {
    var lat = _ref2.lat;
    var lon = _ref2.lon;
    var height = _ref2.height;

    return {
      lat: lat + Math.random() * jitter,
      lon: lon + Math.random() * jitter,
      height: height + Math.random() * 10 * jitter
    };
  };

  var writeInterval = setInterval(function () {
    var _gpsTimestampToWnTow = gpsTimestampToWnTow(Date.now() / 1000);

    var tow = _gpsTimestampToWnTow.tow;
    var wn = _gpsTimestampToWnTow.wn;


    var ecefFields = Object.assign({}, jitterEcef(ecef), {
      n_sats: 9,
      accuracy: 0,
      flags: 0,
      tow: tow
    });

    var llhFields = Object.assign({}, jitterLlh(llh), {
      n_sats: 9,
      v_accuracy: 0,
      h_accuracy: 0,
      flags: 0,
      tow: tow
    });

    var timeFields = {
      wn: wn,
      tow: tow,
      ns: 0,
      flags: 0
    };

    var timeBuf = (0, _construct2.default)(_navigation.MsgGpsTime, timeFields, senderId).toBuffer();
    var ecefBuf = (0, _construct2.default)(_navigation.MsgPosEcef, ecefFields, senderId).toBuffer();
    var llhBuf = (0, _construct2.default)(_navigation.MsgPosLlh, llhFields, senderId).toBuffer();

    outstream.write(timeBuf);
    outstream.write(ecefBuf);
    outstream.write(llhBuf);
  }, 1000 / hz);

  var responder = function responder(req, res) {
    outstream.pipe(res);

    (0, _libsbp.dispatch)(req, function (err, framedMsg) {
      // Virtual Piksi is receiving written obs - if sender ID is nonzero,
      // echo them back to the stream.
      if (framedMsg.messageType === 'MSG_OBS' && framedMsg.senderId !== 0) {
        var MsgConstructor = _msg.sbpIdTable[framedMsg.sbp.msg_type];
        var buf = (0, _construct2.default)(MsgConstructor, framedMsg.fields, framedMsg.sbp.sender).toBuffer();
        outstream.write(buf);
      }
    });

    res.on('end', function () {
      return outstream.unpipe(res);
    });
  };

  var server = _http2.default.createServer(responder).listen(port);
  server.on('close', function () {
    return clearInterval(writeInterval);
  });
  return server;
}