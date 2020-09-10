const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');
// var express = express();
var allClients = [];
app.use(require('express').static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');


app.get('/',function(req,res) {
    res.render(__dirname + '\\views\\login.ejs',{allClients:allClients});
});

io.on('connection', socket => {
    app.get('/quit', function(req,res) {
        console.log(req.query.id);
        socket.to(req.query.id).emit('quit');
        allClients.forEach(elem => {
            if(elem.ID == req.query.id)
            {
                elem.status = 1;
            }
        })
        res.render(__dirname + '\\views\\login.ejs',{allClients:allClients});
    });

    app.get('/init', function(req,res) {
        console.log(req.query.id);
        socket.to(req.query.id).emit('init');
        allClients.forEach(elem => {
            if(elem.ID == req.query.id)
            {
                elem.status = 1;
            }
        })
        res.render(__dirname + '\\views\\login.ejs',{allClients:allClients});
    });

    console.log('\x1b[32m%s\x1b[0m', 'Client connected with id: ' + socket.id + ' from address: ' + socket.client.conn.remoteAddress);

    socket.on('client', (data) => {
        allClients.push({'ID': socket.id,'address':socket.client.conn.remoteAddress,'client':data,'status':0});
        socket.join(socket.id);
        
        console.log(data + ' connected!');
    });

    // message handler
    socket.on('message', (data) => {
        console.log(socket.id + ": " + data);
    });
    // app exit handler
    socket.on('quit', (data) => {
        allClients.forEach(elem => {
            if(elem.client === data) {
                elem.status = 0;
            }
        })
        console.log("shut down: " + data);
    });
    // app init handler
    socket.on('init', (data) => {
        allClients.forEach(elem => {
            if(elem.client === data) {
                elem.status = 2;
            }
        })
        console.log(data + ' initialized!');
    });

    socket.on('disconnect', function() {
        var k = 0;
        allClients.forEach(client =>{
            if(client.ID == socket.id){
                console.log('\x1b[31m%s\x1b[0m', client.client + ' with address ' + client.address + ' disconnected!');
                allClients.splice(k,1)
            }
            k++;
        });
    });
});

server.listen(3000);