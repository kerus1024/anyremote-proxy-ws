class WSStreamHandler {

  constructor(v, ioCluster, sessionIndicator, newTCPEmitter) {

    ioCluster.on('connect', () => {
      console.log(`WEBSOCKET HANDSHAKED with ${v}`);
    });

    ioCluster.on('packed', (packed) => {
      //console.log('GotData!', packed);
      //const unpack = JSON.parse(packed);
      //const sID = unpack.sessionIndicator;

      newTCPEmitter.emit('sid/' + packed.sessionIndicator, packed);

    });

    ioCluster.emit('hi');

  }
  
}
  
module.exports = WSStreamHandler;