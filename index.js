const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');
const sql = require("mssql");
const sorter = require('sort-nested-json');
// var express = express();
var allClients = [];
var clientLogs = [];
var serverStates = [];
app.use(require('express').static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

var config = {
    user: 'MonitorAppSocketUser',
    password: 'O0k1w80rzx',
    server: 'HDESKNEW', 
    database: 'MonitorAppSocket',
    "options": {
        "encrypt": false,
        "enableArithAbort": true
    },
};

sql.connect(config, function (err) {
    if(err) {console.log(err);}
    var request = new sql.Request();
    request.query(`select * from REPORTS`, function(err,result) {
        if(err) console.log(err);
        allClients = result.recordset;
io.on('connection', socket => {
    app.get('/',function(req,res) {
        res.render(__dirname + '\\views\\main.ejs',{allClients:allClients,clientLogs:sorter.sort(clientLogs).asc('timestamp'),part:'projects'});
    });

    app.get('/reset', function(req,res) {
        var request = new sql.Request();
        request.query(`select * from REPORTS`, function(err,result) {
            if(err) console.log(err);
            if(allClients.length === 0) allClients = result.recordset;
            else {
                allClients.forEach(elem => {
                    elem.ADDRESS == result.recordset[elem.ID - 1]['ADDRESS'];
                    elem.APPNAME == result.recordset[elem.ID - 1]['APPNAME'];
                    elem.APPTYPE == result.recordset[elem.ID - 1]['APPTYPE'];
                })
            }
        })
    });

    app.get('/logs',function (req,res){
        if(typeof req.query.id === 'undefined') res.send(clientLogs);
        res.render(__dirname + '\\views\\main.ejs',{logs: sorter.sort(clientLogs.filter(elem => elem.SocketID == req.query.id)).asc('timestamp'),part:'logs'})
        // res.send(clientLogs.filter(elem => elem.SocketID == req.query.id))
    });

    app.get('/quit', function(req,res) {
        socket.to(req.query.id).emit('quit');
        allClients.forEach(elem => {
            if(elem.ID == req.query.id)
            {
                elem.status = 1;
            }
        })
        res.render(__dirname + '\\views\\main.ejs',{allClients:allClients,clientLogs:sorter.sort(clientLogs).asc('timestamp'),part:'projects'});
    });

    app.get('/init', function(req,res) {
        socket.to(req.query.id).emit('init');
        allClients.forEach(elem => {
            if(elem.ID == req.query.id)
            {
                elem.status = 1;
            }
        })
        res.render(__dirname + '\\views\\main.ejs',{allClients:allClients,clientLogs:sorter.sort(clientLogs).asc('timestamp'),part:'projects'});
    });

    app.get('/server_state', function(req,res) {
        res.render(__dirname + '\\views\\main.ejs',{serverStates:serverStates,part:'servers'});
    });

    app.get('/bot_server_state', function(req,res) {
        res.send(serverStates);
    });

    console.log('\x1b[32m%s\x1b[0m', 'Client connected with id: ' + socket.id + ' from address: ' + socket.client.conn.remoteAddress);

    socket.on('client', (data) => {
        allClients.forEach(elem => {
            if(elem.APPNAME === data)
            {
                elem['SocketID'] = socket.id,
                elem['remoteAddr'] = socket.client.conn.remoteAddress;
                elem['status'] = 0;
            }
        });
        socket.join(socket.id);
        console.log(data + ' connected!');
    });

    socket.on('server', (data) =>{
        serverStates = data;
    });

    // message handler
    socket.on('message', (data) => {
        client = allClients.find(elem => elem.SocketID == socket.id );
        clientLogs.push({'SocketID':socket.id,'Appname':client.APPNAME,'message':data,'timestamp':Date.now()})
    });
    // app exit handler
    socket.on('quit', (data) => {
        allClients.forEach(elem => {
            if(elem.APPNAME === data) {
                elem.status = 0;
            }
        })
        console.log("shut down: " + data);
    });
    // app init handler
    socket.on('init', (data) => {
        allClients.forEach(elem => {
            if(elem.APPNAME === data) {
                elem.status = 2;
            }
        })
        console.log(data + ' initialized!');
    });

    socket.on('disconnect', function() {
        var k = 0;
        allClients.forEach(client =>{           
            if(client.SocketID == socket.id){
                console.log('\x1b[31m%s\x1b[0m', client.APPNAME + ' with address ' + client.remoteAddr + ' disconnected!');
                allClients.forEach(elem => {
                    if(elem.SocketID === socket.id) {
                        delete elem.status;
                        delete elem.SocketID;
                        delete elem.remoteAddr;
                    }
                })
            }
            k++;
        });
    });
});
});
});


server.listen(3000);