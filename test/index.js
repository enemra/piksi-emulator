const assert = require('assert');
const http = require('http');
const dispatch = require('libsbp').dispatch;
const constructMsg = require('libsbp/javascript/sbp/construct');
const MsgObs = require('libsbp/javascript/sbp/observation').MsgObs;
const emulator = require('../lib').default;

const randomAvailablePort = () => new Promise(resolve => {
  const server = http.createServer(() => {}).listen(0);
  server.on('listening', () => {
    const port = server.address().port;
    server.close();
    setTimeout(() => resolve(port), 1);
  });
  server.on('error', () => {
    throw new Error('server connection error!');
  });
});

describe('piksi emulator', function () {
  it('should start a readable stream, be able to kill it', function (done) {
    this.timeout(10000);
    randomAvailablePort().then(port => {
      const stream = emulator(port);
      setTimeout(() => {
        stream.close();
        setTimeout(() => {
          done();
        }, 3000);
      }, 2000);
    });
  });

  it('should start a readable stream, get SBP messages from it', function (done) {
    this.timeout(10000);
    let receivedMessages = [];
    randomAvailablePort().then(port => {

      const server = emulator(port);

      http.get('http://localhost:' + port, res => {
        dispatch(res, (err, framedMsg) => {
          receivedMessages.push(framedMsg);
        });
        setTimeout(() => {
          const numTimeMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_GPS_TIME').length;
          const numEcefMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_POS_ECEF').length;
          const numLlhMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_POS_LLH').length;
          const numFromSender = receivedMessages.filter(msg => msg.sbp.sender === 0x42).length;
          assert.equal(numTimeMsgs, 3);
          assert.equal(numEcefMsgs, 3);
          assert.equal(numLlhMsgs, 3);
          assert.equal(numFromSender, 9);
          server.close();
          done();
        }, 3000);
      }).on('error', err => console.err(err));
    });
  });

  it('should start a readable stream, write SBP obs to it, and get same back', function (done) {
    let receivedMessages = [];
    this.timeout(10000);
    randomAvailablePort().then(port => {

      const server = emulator(port);

      // construct a msg obs, write to "device", verify that it's echo'd back
      const obsFields = {
        obs: [
          {"L":{"f":150,"i":108363538},"cn0":200,"P":1031044621,"lock":46286,"sid":{"sat":28,"reserved":0,"code":0}},
          {"L":{"f":147,"i":84439125},"cn0":172,"P":1031044467,"lock":12428,"sid":{"sat":28,"reserved":0,"code":6}},
          {"L":{"f":177,"i":108819691},"cn0":204,"P":1035385074,"lock":38622,"sid":{"sat":24,"reserved":0,"code":0}},
          {"L":{"f":130,"i":84794565},"cn0":172,"P":1035385057,"lock":5797,"sid":{"sat":24,"reserved":0,"code":6}},
          {"L":{"f":50,"i":110759178},"cn0":192,"P":1053838212,"lock":60652,"sid":{"sat":4,"reserved":0,"code":0}},
          {"L":{"f":189,"i":86305858},"cn0":160,"P":1053838072,"lock":60344,"sid":{"sat":4,"reserved":0,"code":6}},
          {"L":{"f":56,"i":112943415},"cn0":192,"P":1074620519,"lock":3379,"sid":{"sat":19,"reserved":0,"code":0}},
          {"L":{"f":98,"i":88007862},"cn0":148,"P":1074620394,"lock":45542,"sid":{"sat":19,"reserved":0,"code":6}},
          {"L":{"f":134,"i":116105122},"cn0":188,"P":1104703945,"lock":33244,"sid":{"sat":11,"reserved":0,"code":0}},
          {"L":{"f":191,"i":90471513},"cn0":144,"P":1104703842,"lock":30536,"sid":{"sat":11,"reserved":0,"code":6}},
          {"L":{"f":88,"i":121582901},"cn0":188,"P":1156822578,"lock":38469,"sid":{"sat":20,"reserved":0,"code":0}},
          {"L":{"f":19,"i":94739926},"cn0":124,"P":1156822465,"lock":41384,"sid":{"sat":20,"reserved":0,"code":6}},
          {"L":{"f":155,"i":121663804},"cn0":176,"P":1157592793,"lock":33576,"sid":{"sat":1,"reserved":0,"code":0}},
          {"L":{"f":121,"i":94802959},"cn0":116,"P":1157592541,"lock":29528,"sid":{"sat":1,"reserved":0,"code":6}}
        ],
        header: {"n_obs":16,"t":{"wn":1916,"tow":240536000}}
      };
      const obsBuf = constructMsg(MsgObs, obsFields, 0x88).toBuffer();

      setTimeout(() => {
        const putClient = http.request({
          method: 'POST',
          hostname: '127.0.0.1',
          port: port,
          path: '/'
        }, res => {
        });
        putClient.write(obsBuf);
        putClient.write(obsBuf);
        putClient.end();
      }, 1000);

      http.get('http://localhost:' + port, res => {
        dispatch(res, (err, framedMsg) => {
          receivedMessages.push(framedMsg);
        });
        setTimeout(() => {
          const numTimeMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_GPS_TIME').length;
          const numEcefMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_POS_ECEF').length;
          const numLlhMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_POS_LLH').length;
          const numObsMsgs = receivedMessages.filter(msg => msg.messageType === 'MSG_OBS').length;
          const numFromSender = receivedMessages.filter(msg => msg.sbp.sender === 0x42).length;
          const numFromRemote = receivedMessages.filter(msg => msg.sbp.sender === 0x88).length;
          assert.equal(numFromSender, 9);
          assert.equal(numFromRemote, 2);
          assert.equal(numObsMsgs, 2);
          assert.equal(numTimeMsgs, 3);
          assert.equal(numEcefMsgs, 3);
          assert.equal(numLlhMsgs, 3);
          server.close();
          done();
        }, 3000);
      }).on('error', err => console.err(err));
    });
  });
});
