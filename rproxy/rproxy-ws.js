process.title = 'rproxy-server-anyremote';
const ServerConstants = require('./config.json');
const Connection = require('./lib/Connection');

const net = require('net');
const express = require('express');
const cluster = require('cluster');
const redis = require('socket.io-redis');

if (cluster.isMaster) {

  let cpus = require('os').cpus().length;
  cpus = cpus > 4 ? cpus : 4;

  console.log(`Run ${process.title}.`);

  for (let i = 0; i < cpus; i++) {
    cluster.fork();
  }

} else {

  const app = express();
  const server = app.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {
    console.log('listening on %j', server.address());
  });

  const io = require('socket.io')(server)
 
  io.adapter(redis({
    host: '127.0.0.1',
    port: 6379
  }));

  io.on('connection', (socket) => {
  
    const connectionPipe = new Connection(socket, io);

  });

  console.log(`forked! ${process.title} - ${process.pid} pid `);

}
