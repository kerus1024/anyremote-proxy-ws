class WSStreamHandler {

  constructor(v, ioCluster, sessionIndicator, newTCPEmitter) {

    ioCluster.on('connect', () => {
      console.log(`WEBSOCKET HANDSHAKED with ${v}`);
    });

    ioCluster.on('packed', (packed) => {
      newTCPEmitter.emit('sid/' + packed.sessionIndicator, packed);
    });

    ioCluster.on('error', (e) => {
      console.error(e);
    });

  }
  
}
  
module.exports = WSStreamHandler;