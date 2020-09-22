const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');
const sql = require("mssql");
const sorter = require('sort-nested-json');
const reqst = require('request');
var bodyParser = require('body-parser');
const { connect } = require('socket.io-client');
// var express = express();
var allClients = [];
var clientLogs = [];
var serverStates = [];
app.use(require('express').static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }))
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
    })

    app.get('/',function(req,res) {
        request.query(`select * from REPORTS`, function(err,result) {
            if(err) console.log(err);
            if(allClients.length === 0) allClients = result.recordset;
            else {
                for(i=0;i<result.recordset.length;i++){
                    k = 0;
                    for(j=0;j<allClients.length;j++)
                    {
                        if(result.recordset[i].ADDRESS == allClients[j].ADDRESS) k++;
                    }
                    if(k == 0){
                        allClients.push({ADDRESS:result.recordset[i].ADDRESS,APPNAME:result.recordset[i].APPNAME,APPTYPE:result.recordset[i].APPTYPE});
                    }
                }
            }
            res.render(__dirname + '\\views\\main.ejs',{allClients:allClients,clientLogs:sorter.sort(clientLogs).asc('timestamp'),part:'projects'});
        });
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
        });

        app.get('/server_state', function(req,res) {
            servers = [];
            request.query('select * from SERVERS', function(err,result) {
                if(err) console.log(err)
                servers = result.recordset;
                reqst('http://localhost:4001',function(err,resl,body){
                    if(err) console.log(err);    
                    servers.forEach(rec => {
                        JSON.parse(body).forEach(b=>{ 
                            if(rec.IP == b.toString()) {
                                rec.STATUS = 1;
                            }
                        })
                    })
                    res.render(__dirname + '\\views\\main.ejs',{serverStates:servers,part:'servers'});
                });
            })
        });
    
        app.get('/bot_server_state', function(req,res) {
            res.send(servers);
        });

        app.post('/add_server', function(req,res) {
            request.query("INSERT INTO SERVERS(IP,HOSTNAME) VALUES(N'" + req.body.IP + "',N'" + req.body.hostname + "');", function(err,result){
                if(err) console.log(err);
                if(result.rowsAffected[0] == 1) {
                    res.redirect('/server_state');
                }
            });
        });

        app.post('/add_project', function(req,res) {
            request.query("INSERT INTO REPORTS(ADDRESS,APPNAME,APPTYPE) VALUES(N'" + req.body.address + "',N'" + req.body.appname + "',N'" + req.body.apptype + "');", function(err,result){
                if(err) console.log(err);
                if(result.rowsAffected[0] == 1) {
                    res.redirect('/');
                }
            });
        });
        
io.on('connection', socket => {
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
        console.log(req.query.id)
        socket.to(req.query.id).emit('init');
        allClients.forEach(elem => {
            if(elem.ID == req.query.id)
            {
                elem.status = 1;
            }
        })
        res.render(__dirname + '\\views\\main.ejs',{allClients:allClients,clientLogs:sorter.sort(clientLogs).asc('timestamp'),part:'projects'});
    });

    console.log('\x1b[32m%s\x1b[0m', 'Client connected with id: ' + socket.id + ' from address: ' + socket.client.conn.remoteAddress);

    socket.on('client', async (data) => {
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

    // socket.on('server', (data) =>{
    //     serverStates = data;
    // });

    // message handler
    socket.on('message', (data) => {
        console.log('DATA: ' + data)
        console.log('socketid: ' + socket.id)
        client = allClients.find(elem => elem.SocketID == socket.id );

        console.log(allClients)
        clientLogs.push({'SocketID':socket.id,'Appname':client.APPNAME,'message':data,'timestamp':Date.now()})
    });

    socket.on('reconnect', (data) => {
        console.log(data)
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
server.listen(3000);