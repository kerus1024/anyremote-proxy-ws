const geoconfig = require(`${process.cwd()}/geoconfig.json`);

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

    this.targetIP           = null;
    this.targetPort         = null;

    this.targetGeoCountry   = 'ZZ';
    this.targetGeoRemoteServer    = geoconfig.gw;
    this.targetGeoRemotePort      = geoconfig.rProxyPort;

    this.handle();
  }

  async build() {

    // Build RemoteSocket Listen
    this.remoteSocket.on('sid/' + this.sessionID, (packed) => {

      // GC야 부탁해..
      if (!this.tcpSocket) return;

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
        this.tcpSocket = null;
      } else if (packed.method === 'ERROR') {
        this.tcpSocket.destroy();
        this.tcpSocket = null;
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

    this.tcpSocket.on('drain', () => {
      this.ioCluster.emit('packed', {
        method: 'DRAIN',
        sessionIndicator: this.sessionID
       });
    });

    this.tcpSocket.on('close', () => {
      this.ioCluster.emit('packed', {
        method: 'CLOSE',
        sessionIndicator: this.sessionID
      });
    });

    this.tcpSocket.on('error', (e) => {
      this.ioCluster.emit('packed', {
        method: 'ERROR',
        sessionIndicator: this.sessionID,
        message: e.toString()
      });
    });

  }

  async handle() {

    try {

      const resolve = await Conntrack.getOriginDestinationTCP(this.clientIP, this.clientPort);
      this.targetIP   = resolve.originIP;
      this.targetPort = resolve.originPort;

      const getGeo = await GeoIP.routeGeoRemote(resolve.originIP);
      this.targetGeoCountry      = getGeo.country;
      this.targetGeoRemoteServer = getGeo.remoteServer;
  
      console.log(`NEW PROXY CONNECT - ${this.clientIP}:${this.clientPort} -> ${this.targetIP}:${this.targetPort} [${this.targetGeoRemoteServer} (${this.targetGeoCountry})]`);

      const selectRandomCluster = Math.floor(Math.random() * (this._ioCluster[this.targetGeoRemoteServer].length) );
      this.ioCluster = this._ioCluster[this.targetGeoRemoteServer][selectRandomCluster];

      this.ioCluster.emit('packed', {
        method: 'CONNECT',
        sessionIndicator: this.sessionID,
        destinationIP: this.targetIP,
        destinationPort: this.targetPort,
      });

      this.build();

    } catch (e) {
      console.error('ERR: Could not resolve originDst data', e);
    }

  }

}

module.exports = HandleConnection;