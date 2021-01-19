const Conntrack = require('./Conntrack');
const GeoIP = require('./GeoIP');

class HandleConnection {

  constructor(tcpSocket, ioCluster, sessions, sessionID, newTCPEmitter) {

    this.clientIP = tcpSocket.remoteAddress;
    this.clientPort = tcpSocket.remotePort;
    this.tcpSocket = tcpSocket;
    this._ioCluster = ioCluster;
    this.ioCluster = null;
    this.sessionID = sessionID;
    this.session = sessions[sessionID];
    
    this.remoteSocket = newTCPEmitter;

    this.handle();
  }

  async build() {

    // Build RemoteSocket Listen
    this.remoteSocket.on('sid/' + this.sessionID, (packed) => {

      if (packed.method === 'DATA') {
        const flushed = this.tcpSocket.write(packed.data);
        if (!flushed) {
          this.ioCluster.emit('packed', {
            method: 'PAUSE',
            sessionIndicator: this.sessionID
          });
        }
      } else if (packed.method === 'DRAIN') {
        this.tcpSocket.resume();
      } else if (packed.method === 'PAUSE') {
        this.tcpSocket.pause();
      } else if (packed.method === 'CLOSE') {
        this.tcpSocket.end();
      } else if (packed.method === 'ERROR') {
        this.tcpSocket.destroy();
      } else {
        throw new Error('UNKNOWN DATA RECEIVED', packed);
      }

    });

    this.tcpSocket.on('data', (data) => {
      this.ioCluster.emit('packed', {
        method: 'DATA',
        sessionIndicator: this.sessionID,
        data: data
      });
    });

    this.tcpSocket.on('drain', (data) => {
      this.ioCluster.emit('packed', {
        method: 'DRAIN',
        sessionIndicator: this.sessionID
       });
    });

    this.tcpSocket.on('close', (data) => {
      this.ioCluster.emit('packed', {
        method: 'CLOSE',
        sessionIndicator: this.sessionID,
        data: data
      });
    });

    this.tcpSocket.on('error', (data) => {
      this.ioCluster.emit('packed', {
        method: 'ERROR',
        sessionIndicator: this.sessionID,
        data: data
      });
    });

  }

  async handle() {

    try {

      const resolve = await Conntrack.getOriginDestinationTCP(this.clientIP, this.clientPort);
      const getGeo = await GeoIP.routeGeoRemote(resolve.originIP);
  
      console.log(`CONNECT ${this.clientIP}:${this.clientPort} -> ${resolve.originIP}:${resolve.originPort} via ${getGeo.remoteServer}`);

      this.ioCluster = this._ioCluster[getGeo.remoteServer];

      this.ioCluster.emit('packed', {
        method: 'CONNECT',
        sessionIndicator: this.sessionID,
        destinationIP: resolve.originIP,
        destinationPort: resolve.originPort,
      });

      this.build();

    } catch (e) {
      console.error('ERR: Could not resolve originDst data', e);
    }

  }

}

module.exports = HandleConnection;