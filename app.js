const fs = require('fs');
const express = require('express');
const app = express();
const db = require('./models/index');
//routes
const routes = require('./src/routes');

//assets
app.use('/assets', express.static('assets'));
app.use('/build', express.static('public/build'));

const WEBPACK_ASSETS_URL = 'http://localhost:8080';

if (app.get('env') != 'development') {
    var assets_names = JSON.parse(fs.readFileSync(__dirname + '/assets/webpack-assets.json', 'utf8'));
    var scripts = [assets_names.commonChunk.js, assets_names.app.js];
} else {
    var scripts = [WEBPACK_ASSETS_URL + '/build/app.js'];
}

//Set view engine
app.set('view engine', 'ejs');

//use routes with /api
app.use('/', routes);

//Allow react router to handle the get requests
app.get('/*', function(req, res) {
    res.render('index', {scripts: scripts});
});

const server = app.listen(4000, function() {
    console.log('App listening on port 4000!');
});
db.sequelize
    .sync({
        force: false
    })
    .then(() => {
        console.log('DB Synced');
    });
//socket server
const io = require('socket.io')(server, {wsEngine: 'ws'});

const handleConnections = require('./src/socketRoutes/connectionManager');
const handleBiding = require('./src/socketRoutes/bidManager');

//socket routes
io.sockets.on('connection', socket => {
    socket.on('openAuction', (namespace, owner_id, max_user) => {
        handleConnections.ownerSocket(socket, namespace, owner_id, max_user);
    });
    socket.on('closeAuction', (namespace, owner_id) => {
        handleConnections.closeAuction(socket, io, namespace, owner_id);
    });
    socket.on('joinRoom', (namespace, user_id) => {
        handleConnections.joinAuction(socket, namespace, user_id);
    });
    socket.on('newBid', (namespace, user_id, userName, bid_value) => {
        const clientSocket = handleConnections.getAllClientSockets(namespace)[user_id];
        const adminSocket = handleConnections.getAdminSocket(namespace);
        handleBiding.handleBid(io, socket, namespace, user_id, userName, bid_value, clientSocket, adminSocket);
    });

    socket.on('newSecretBid', (namespace, user_id, userName, bid_value) => {
        const clientSocket = handleConnections.getAllClientSockets(namespace)[user_id];
        const adminSocket = handleConnections.getAdminSocket(namespace);
        handleBiding.handleSecretBid(io, socket, namespace, user_id, userName, bid_value, clientSocket, adminSocket);
    });

    socket.on('biddingStart', (namespace, owner_id, catalog) => {
        handleConnections.currentCatalog(socket, namespace, owner_id, catalog);
    });
    socket.on('biddingSkip', (owner_id, namespace, catalogName) => {
        handleConnections.skipBidding(io, socket, namespace, owner_id, catalogName);
    });
    socket.on('biddingStop', (owner_id, namespace, catalogName, isSecretBid) => {
        handleConnections.stopBidding(io, socket, namespace, owner_id, catalogName, isSecretBid);
    });
    socket.on('disconnect', reason => {
        handleConnections.leaveAuction(socket, socket.user_id, socket.namespace);
    });
    socket.on('pauseBidding', (owner_id, namespace, catalog) => {
        handleConnections.pauseBidding(io, socket, namespace);
    });
    socket.on('resumeBidding', (owner_id, namespace, catalog) => {
        handleConnections.resumeBidding(io, socket, namespace);
    });
    socket.on('deleteBids', (allBids, owner_id, namespace, catalog) => {
        handleBiding.deleteBids(io, socket, allBids, namespace, owner_id, catalog);
    });
    socket.on('deleteSecretBids', (secretBids, deleteSecretBids, owner_id, namespace, catalog) => {
        handleBiding.deleteSecretBids(io, socket, secretBids, deleteSecretBids, namespace, owner_id, catalog);
    });
    socket.on('changeRegistrationStatus', namespace => {
        handleConnections.changeRegistrationStatus(io, socket, namespace);
    });

    socket.on('secretBidStatus', (owner_id, namespace, catalog, isSecretBid) => {
        handleConnections.changeSecretBidStatus(io, socket, namespace, isSecretBid);
    });
});
