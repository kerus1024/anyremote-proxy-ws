# anyremote-proxy-ws
transparent proxy over socket.io (WebSocket)
`
npm install socket.io xml2js @maxmind/geoip2-node socket.io-client
`

remote proxy (listener) require at least 500MB Memory
`
apt -y install redis ; systemctl start redis ; npm install redis@3.0.2 socket.io@3.1.0 socket.io-redis@6.0.1 express@4.17.1
yum -y intall redis ; systemctl start redis ; npm install redis@3.0.2 socket.io@3.1.0 socket.io-redis@6.0.1 express@4.17.1
`

rproxy의 로컬서버에서 데이터를 받아오는 경우 메모리가 순간적으로 뛸 수 있다