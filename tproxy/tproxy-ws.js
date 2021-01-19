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

  /*
    이미 CLOSE된 세션을 정리해주는 GC가 필요할 것 같다. / 및 if 로직이
  */


  const newTCPEmitter = new EventEmitter();

  const ioClusterConnect = {};
  const sessionIndicator = {};
  let sessionIndicatorIncrement = 0;
  
  Object.keys(geoconfig.geoCountry).forEach(v => {
    const path = `ws://${v}:${geoconfig.rProxyPort}`;
    console.log(path)
    ioClusterConnect[v] = io.connect(path, {
      //reconnection: false,
      localAddress: '10.50.0.1'
    });
    new WSStreamHandler(v, ioClusterConnect[v], sessionIndicatorIncrement, newTCPEmitter);
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
