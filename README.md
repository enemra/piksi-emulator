# piksi-emulator
A naive Piksi emulator that outputs position solutions at 1HZ (hardcoded) and echos observations written to it.

This is for testing external streams of corrections and that they're getting to a piksi correctly. A real piksi device echoes back observations that are written to it; this utility is helpful for verifying that those parts of your application are functioning correctly, while removing serial communications and hardware from testing.

# Install

You can use the piksi emulator programatically or via the CLI.

To install globally:

```bash
npm install -g piksi-emulator
```

Or to save it to a project:

```bash
npm install --save piksi-emulator
```

# CLI usage

```
  Usage: piksi-emulator [options]
  Options:
    -h, --help         output usage information
    -V, --version      output the version number
    -p, --port <n>     http port number [default 7777]
    --hz <n>           solution rate [default 1]
    --sender <n>       SBP sender ID [default 0x42]
    -x <x>             ECEF X position (must also provide Y, Z or none)
    -y <y>             ECEF Y position (must also provide X, Z or none)
    -z <z>             ECEF Z position (must also provide X, Y or none)
    --lat <lat>        LLH lat position (must also provide lon, height or none)
    --lon <lon>        LLH lon position (must also provide lat, height or none)
    --height <height>  LLH height (must also provide lat, lon or none)
```

You can run `piksi-emulator` with all the defaults and it will start a virtual device on
HTTP port `7777`.

# Programmatic usage

```javascript
const defaultEcef = ;
const defaultLlh = {
};

var emulator = require('emulator');
var port = 1234;
var ecef = {
  x: -2706105.162741557,
  y: -4261224.166310791,
  z: 3885605.2890337044
};
var llh = {
  lat: 37.77348891054085,
  lon: -122.41772914435545,
  height: 60
};
var hz = 2;
var senderId = 0x84;
var server = emulator(port, ecef, llh, hz, senderId);

// run your tests... then close server after a delay
setTimeout(function () {
  server.close();
}, 10000);
```

# License

MIT license. See `LICENSE` file.
