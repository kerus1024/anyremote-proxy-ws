const net = require('net');

class Connection {

  constructor(socket) {

    console.log(`new connection from ${socket.request.connection.remoteAddress}`);

    this.sessions = {};

    socket.on('packed', (packed) => {
      
      const unpack = (packed);
      
      const sID = unpack.sessionIndicator;
      console.log(unpack);

      if (typeof this.sessions[sID] === 'undefined') {
        this.sessions[sID] = {};
        this.sessions[sID].id = sID;
        this.sessions[sID].initState = false;
        this.sessions[sID].initBuffer = Buffer.alloc(0);
        this.sessions[sID].socket = null;
      }

      if (unpack.method === 'CONNECT') {

        this.sessions[sID].socket = new net.Socket();  

        const remotesocket = this.sessions[sID].socket;
        
        remotesocket.connect(unpack.destinationPort, unpack.destinationIP);
        remotesocket.on('connect', () => {
          remotesocket.setNoDelay(true);

          const thisSession = this.sessions[sID];

          if (Buffer.byteLength(thisSession.initBuffer)) {
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

        remotesocket.on('close', (data) => {
          socket.emit('packed', {
            method: 'CLOSE',
            sessionIndicator: sID
          });
        });

        remotesocket.on('error', (err) => {
          console.error(err);
          socket.emit('packed', {
            method: 'ERROR',
            sessionIndicator: sID,
            message: err.toString()
          });
        });

      } else if (unpack.method === 'DATA') {

        if (!this.sessions[sID].socket) return;

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
        if (!this.sessions[sID].socket) return;
        this.sessions[sID].socket.resume();
      } else if (unpack.method === 'PAUSE') {
        if (!this.sessions[sID].socket) return;
        this.sessions[sID].socket.pause();
      } else if (unpack.method === 'CLOSE') {
        if (!this.sessions[sID].socket) return;
        this.sessions[sID].socket.destroy();
        delete this.sessions[sID];
      } else if (unpack.method === 'ERROR') {
        if (!this.sessions[sID].socket) return;
        this.sessions[sID].socket.destroy();
        delete this.sessions[sID];
      } else {  
        console.error('ERR: Received unknown message. ', packed);
      }

    });

  }

}

module.exports = Connection;