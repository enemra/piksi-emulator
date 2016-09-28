/**
 * Copyright (C) 2016 Swift Navigation Inc.
 * Contact: Joshua Gross <josh@swift-nav.com>
 * This source is subject to the license found in the file 'LICENSE' which must
 * be distributed together with this source. All other rights reserved.
 *
 * THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND,
 * EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A PARTICULAR PURPOSE.
 */
import assert from 'assert';
import http from 'http';
import { PassThrough } from 'stream';
import { dispatch } from 'libsbp';
import constructMsg from 'libsbp/javascript/sbp/construct';
import { sbpIdTable } from 'libsbp/javascript/sbp/msg';
import { MsgPosLlh, MsgPosEcef, MsgGpsTime } from 'libsbp/javascript/sbp/navigation';

const defaultEcef = {
  x: -2706105.162741557,
  y: -4261224.166310791,
  z: 3885605.2890337044
};
const defaultLlh = {
  lat: 37.77348891054085,
  lon: -122.41772914435545,
  height: 60
};
const defaultSenderId = 0x42;

// Unix timestamp of the GPS epoch 1980-01-06 00:00:00 UTC
const gpsEpochSeconds = 315964800;
const weekSeconds = (60 * 60 * 24 * 7);

/**
 * Convert GPS moment timestamp (in GPS time, without leap seconds) to { wn, tow }.
 *
 * @param {moment} gpsTimestamp - A `moment` object representing a GPS timestamp,
 *   without leap-seconds.
 * @return {object} { wn, tow }
 */
function gpsTimestampToWnTow (gpsTimestamp) {
  const gpsTimeMs = gpsTimestamp - gpsEpochSeconds;
  const wn = Math.floor(gpsTimeMs / weekSeconds);
  const tow = gpsTimeMs - (wn * weekSeconds);
  return { wn, tow };
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
export default function piksiEmulator (port = 77777, ecef = defaultEcef, llh = defaultLlh, hz = 1, senderId = defaultSenderId, jitter = 0) {
  assert(typeof port === 'number', 'port must be a number');
  assert(ecef && llh, 'ecef and llh must both be provided!');
  assert((ecef === defaultEcef && llh === defaultLlh) || (ecef !== defaultEcef && llh !== defaultLlh),
        'you should either use default ECEF and LLH or change both - they should be consistent');
  assert(typeof ecef.x === 'number', 'must provide ecef X value as number');
  assert(typeof ecef.y === 'number', 'must provide ecef Y value as number');
  assert(typeof ecef.z === 'number', 'must provide ecef Z value as number');
  assert(typeof llh.lat === 'number', 'must provide llh lat value as number');
  assert(typeof llh.lon === 'number', 'must provide llh lon value as number');
  assert(typeof llh.height === 'number', 'must provide llh height value as number');
  assert(typeof hz === 'number', 'must provide hz value as number');
  assert(hz < 1000, 'hz cannot be greater than 1000');
  assert(typeof jitter === 'number', 'must provide jitter value as number');

  const outstream = new PassThrough();

  const jitterEcef = ({ x, y, z }) => {
    return {
      x: x + (Math.random() * 1000 * jitter),
      y: y + (Math.random() * 1000 * jitter),
      z: z + (Math.random() * 1000 * jitter)
    };
  };

  const jitterLlh = ({ lat, lon, height }) => {
    return {
      lat: lat + (Math.random() * jitter),
      lon: lon + (Math.random() * jitter),
      height: height + (Math.random() * 10 * jitter)
    };
  };

  const writeInterval = setInterval(() => {
    const { tow, wn } = gpsTimestampToWnTow(Date.now() / 1000);

    const ecefFields = Object.assign({}, jitterEcef(ecef), {
      n_sats:9,
      accuracy: 0,
      flags: 0,
      tow
    });

    const llhFields = Object.assign({}, jitterLlh(llh), {
      n_sats:9,
      v_accuracy: 0,
      h_accuracy: 0,
      flags: 0,
      tow
    });

    const timeFields = {
      wn,
      tow,
      ns: 0,
      flags: 0
    };

    const timeBuf = constructMsg(MsgGpsTime, timeFields, senderId).toBuffer();
    const ecefBuf = constructMsg(MsgPosEcef, ecefFields, senderId).toBuffer();
    const llhBuf = constructMsg(MsgPosLlh, llhFields, senderId).toBuffer();

    outstream.write(timeBuf);
    outstream.write(ecefBuf);
    outstream.write(llhBuf);
  }, 1000 / hz);

  const responder = (req, res) => {
    outstream.pipe(res);

    dispatch(req, (err, framedMsg) => {
      // Virtual Piksi is receiving written obs - if sender ID is nonzero,
      // echo them back to the stream.
      if (framedMsg.messageType === 'MSG_OBS' && framedMsg.senderId !== 0) {
        const MsgConstructor = sbpIdTable[framedMsg.sbp.msg_type];
        const buf = constructMsg(MsgConstructor, framedMsg.fields, framedMsg.sbp.sender).toBuffer();
        outstream.write(buf);
      }
    });

    res.on('end', () => outstream.unpipe(res));
  };

  const server = http.createServer(responder).listen(port);
  server.on('close', () => clearInterval(writeInterval));
  return server;
}
