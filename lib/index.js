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
var senderId = 0x42;

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
 */
function piksiEmulator() {
  var port = arguments.length <= 0 || arguments[0] === undefined ? 7777 : arguments[0];
  var ecef = arguments.length <= 1 || arguments[1] === undefined ? defaultEcef : arguments[1];
  var llh = arguments.length <= 2 || arguments[2] === undefined ? defaultLlh : arguments[2];
  var hz = arguments.length <= 3 || arguments[3] === undefined ? 1 : arguments[3];
  var senderId = arguments.length <= 4 || arguments[4] === undefined ? senderId : arguments[4];

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

  var outstream = new _stream.PassThrough();

  setInterval(function () {
    var _gpsTimestampToWnTow = gpsTimestampToWnTow(Date.now() / 1000);

    var tow = _gpsTimestampToWnTow.tow;
    var wn = _gpsTimestampToWnTow.wn;


    var ecefFields = Object.assign({}, ecef, {
      n_sats: 9,
      accuracy: 0,
      flags: 0,
      tow: tow
    });

    var llhFields = Object.assign({}, llh, {
      n_sats: 9,
      v_accuracy: 0,
      h_accuracy: 0,
      flags: 0,
      tow: tow
    });

    var ecefBuf = (0, _construct2.default)(_navigation.MsgPosEcef, ecefFields, senderId).toBuffer();
    var llhBuf = (0, _construct2.default)(_navigation.MsgPosLlh, llhFields, senderId).toBuffer();

    outstream.write(ecefBuf);
    outstream.write(llhBuf);
  }, 1000 / hz);

  var responder = function responder(req, res) {
    outstream.pipe(res);

    (0, _libsbp.dispatch)(req, function (err, framedMsg) {
      // Virtual Piksi is receiving written obs - if sender ID is nonzero,
      // echo them back to the stream.
      console.log(framedMsg);
      if (framedMsg.messageType === 'MSG_OBS' && framedMsg.senderId !== 0) {
        var MsgConstructor = _msg.sbpIdTable[framedMsg2.sbp.msg_type];
        var buf = (0, _construct2.default)(MsgConstructor, framedMsg2.fields, senderId).toBuffer();
        outstream.write(buf);
      }
    });

    res.on('end', function () {
      return outstream.unpipe(res);
    });
  };

  return _http2.default.createServer(responder).listen(port);
}