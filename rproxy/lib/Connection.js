const ServerConstants = require(`${process.cwd()}/config.json`);

const net = require('net');

class Connection {

  constructor(socket) {

    socket.sendBuffer = [];
    socket.receiveBuffer = [];

    console.log(`NEW WEBSOCKET CONNECTION FROM ${socket.handshake.address}`);

    this.sessions = {};

    socket.on('packed', (packed) => {
      
      const unpack = (packed);
      
      const sID = unpack.sessionIndicator;

      if (unpack.method !== 'CONNECT' && typeof this.sessions[sID] === 'undefined') {
        socket.emit('packed', {
          method: 'ERROR',
          sessionIndicator: sID,
          message: 'Session not found.'
        });
        return;
      }

      if (unpack.method === 'CONNECT') {

        this.sessions[sID] = {};
        this.sessions[sID].id = sID;
        this.sessions[sID].initState = false;
        this.sessions[sID].initBuffer = Buffer.alloc(0);
        this.sessions[sID].socket = null;

        this.sessions[sID].socket = new net.Socket();  

        const thisSession = this.sessions[sID];

        const remotesocket = thisSession.socket;
        
        console.log(`NEW PROXY CONNECT! -> ${unpack.destinationIP}:${unpack.destinationPort}`)

        remotesocket.connect(unpack.destinationPort, unpack.destinationIP);
        remotesocket.on('connect', () => {
          remotesocket.setNoDelay(true);

          const currentBufferSize = Buffer.byteLength(thisSession.initBuffer); 

          // TCP bypass DPI
          const baseLength = 21;

          if (ServerConstants.BYPASSDPI && currentBufferSize >= baseLength) {
            const sliceLeft = thisSession.initBuffer.slice(0, baseLength);
            const sliceRight = thisSession.initBuffer.slice(baseLength, currentBufferSize);

            remotesocket.write(sliceLeft);
            remotesocket.write(sliceRight);
          } else {
            remotesocket.write(thisSession.initBuffer);
          }

          thisSession.initState = true;

        });
        
        remotesocket.on('data', (data) => {
          socket.emit('packed', {
            method: 'DATA',
            sessionIndicator: sID,
            data: data
          });
        });

        remotesocket.on('drain', () => {
          socket.emit('packed', {
            method: 'DRAIN',
            sessionIndicator: sID
          });
        });

        remotesocket.on('close', () => {
          socket.emit('packed', {
            method: 'CLOSE',
            sessionIndicator: sID
          });
          remotesocket.destroy();
          delete this.sessions[sID];
        });

        remotesocket.on('error', (err) => {
          console.error(err);
          socket.emit('packed', {
            method: 'ERROR',
            sessionIndicator: sID,
            message: err.toString()
          });
          remotesocket.destroy();
          delete this.sessions[sID];
        });
        
      } else if (unpack.method === 'DATA') {

        if (!this.sessions[sID]) return;

        if (!this.sessions[sID].initState) {
          this.sessions[sID].initBuffer = Buffer.concat([this.sessions[sID].initBuffer, unpack.data]);
        } else {
          const flushed = this.sessions[sID].socket.write(unpack.data);
          if (!flushed) {
            socket.emit('packed', {
              method: 'PAUSE',
              sessionIndicator: sID
            });
          }
        }

      } else if (unpack.method === 'DRAIN') {
        if (this.sessions[sID]) {
          this.sessions[sID].socket.resume();
        }
      } else if (unpack.method === 'PAUSE') {
        if (this.sessions[sID]) {
          this.sessions[sID].socket.pause();
        }
      } else if (unpack.method === 'CLOSE') {
        if (this.sessions[sID]) {
          this.sessions[sID].socket.destroy();
          delete this.sessions[sID];
        }
      } else if (unpack.method === 'ERROR') {
        if (this.sessions[sID]) {
          this.sessions[sID].socket.destroy();
          delete this.sessions[sID];
        } 
      } else {  
        console.error('ERR: Received unknown message. ', packed);
      }

    });

  }

}

module.exports = Connection;