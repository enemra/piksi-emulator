#!/usr/bin/env node --harmony

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

"use strict";

var commander = require('commander');
var pkg = require('../package.json');
var emulator = require('../lib/index.js').default;

commander.version(pkg.version)
  .option('-p, --port <n>', 'http port number [default 7777]', parseInt)
  .option('--hz <n>', 'solution rate [default 1]', parseInt)
  .option('--sender <n>', 'SBP sender ID [default 0x42]')
  .option('-x <x>', 'ECEF X position (must also provide Y, Z or none)')
  .option('-y <y>', 'ECEF Y position (must also provide X, Z or none)')
  .option('-z <z>', 'ECEF Z position (must also provide X, Y or none)')
  .option('--lat <lat>', 'LLH lat position (must also provide lon, height or none)')
  .option('--lon <lon>', 'LLH lon position (must also provide lat, height or none)')
  .option('--height <height>', 'LLH height (must also provide lat, lon or none)')
  .parse(process.argv);

var port = commander.port || undefined;
var hz = commander.hz || undefined;
var sender = commander.sender || undefined;
var x = commander.x || undefined;
var y = commander.y || undefined;
var z = commander.z || undefined;
var lat = commander.lat || undefined;
var lon = commander.lon || undefined;
var height = commander.height || undefined;

if ((x || y || z) && !(x && y && z)) {
  throw new Error('If ECEF x, y, or z is provided, you must provide all three.');
}

if ((lat || lon || height) && !(lat && lon && height)) {
  throw new Error('If LLH lat, lon, or height is provided, you must provide all three.');
}

var ecef = (x ? { x: x, y: y, z: z } : undefined);
var llh = (lat ? { lat: lat, lon: lon, height: height } : undefined);

emulator(port, ecef, llh, hz, sender);
