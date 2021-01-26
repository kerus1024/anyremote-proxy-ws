const ServerConstants = require('./config.json');
const geoconfig = require('./geoconfig.json');

const cluster = require('cluster');
const EventEmitter = require('events');

const io = require('socket.io-client');
const net = require('net');
const server = net.createServer();    

const HandleConnection = require('./lib/HandleConnection');
const WSStreamHandler = require('./lib/WSStreamHandler');

process.on('uncaughtException', (error) => {
  console.error('WARNING: uncaughtexception: ', error);
});

if (cluster.isMaster) {

  let cpus = require('os').cpus().length;

  console.log(`Run ${process.title}.`);

  for (let i = 0; i < cpus; i++) {
    cluster.fork();
  }
  
} else {

  const newTCPEmitter = new EventEmitter();

  const ioClusterConnect = {};
  let ioClusterIndex = 0;
  const sessionIndicator = {};
  let sessionIndicatorIncrement = 0;

  Object.keys(geoconfig.geoCountry).forEach(v => {
    const path = `ws://${v}:${geoconfig.rProxyPort}`;

    if (typeof ioClusterConnect[v] === 'undefined') {
      ioClusterConnect[v] = [];
      ioClusterIndex = 0;
    }

    ioClusterConnect[v].push(io.connect(path, {
      reconnection: true,
      localAddress: ServerConstants.PROXYLOCAL,
      transports: [ 'websocket' ]
    }));

    new WSStreamHandler(v, ioClusterConnect[v][ioClusterIndex], sessionIndicatorIncrement, newTCPEmitter);

    ioClusterIndex++;

  });

  server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
    console.log('server listening to %j', server.address());  
  });

  server.on('connection', (tcpSocket) => {
    const newConnectionPipe = new HandleConnection(tcpSocket, ioClusterConnect, sessionIndicator, sessionIndicatorIncrement, newTCPEmitter);
    sessionIndicator[sessionIndicatorIncrement] = tcpSocket;
    sessionIndicatorIncrement++;
  });

  console.log(`forked! ${process.title} - ${process.pid} pid `);

}
