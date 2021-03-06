/**
 * Module dependencies.
 */

var express = require('express'),
         io = require("socket.io"),
        irc = require("irc"),
     stylus = require("stylus"),
        nib = require("nib"),
       gzip = require('connect-gzip'),
      debug = false,
        app = module.exports = express.createServer(),
CouchClient = require('couch-client'),
 connection = CouchClient("http://jsfoobot:foobotpass@netroy.iriscouch.com/irc_jsfoo"),
      docId = "backlog";

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.enable('view cache');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(stylus.middleware({
    src: __dirname + '/src',
    dest: __dirname + '/static',
    compile: function (str, path, fn) {
      return stylus(str).set('filename', path).set('compress', true).use(nib());
    }
  }));
  app.use(app.router);
  //app.use(express.static(__dirname + '/static'));
  app.use(gzip.staticGzip(__dirname + '/static', { maxAge: 86400*365 }));
});
app.configure('development', function(){
  debug = true;
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});
app.configure('production', function(){
  app.use(express.errorHandler()); 
});

var server  = "irc.freenode.net",
   channel  = debug?"#jsfootest":"#hasgeek";

function capitalize(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Routes
app.get('/irc', function(req, resp){
  resp.render('irc', {
    'title': 'jsFoo 2011',
    'channel': channel,
    'server': server
  });
});
var routeRegEx = /^\/201[12]\-(bangalore|pune|chennai)\/(about\-(event|hasgeek)|schedule|venue|hacknight|videos|sponsors|credits|register)?\/?$/;
app.get(routeRegEx, function(req, resp){
  var url = req.url;
  var params = url.match(/(2011|2012)\-(bangalore|pune|chennai)/);
  var opts = {
    title: ['jsFoo', params[1], capitalize(params[2])].join(' ')
  };
  resp.render('main-' + params[0], opts);
});

// Catch all route
app.use(function(eq, resp){
  resp.redirect("/2011-pune/");
});

// prevent server from starting as module - can be used with something like multinode
if (!module.parent) {
  app.listen(process.env.app_port || 11728);
  console.info("Started on port %d", app.address().port);
}

if(debug){
  return;
}

var nick  = debug?"blahblahblah":"jsFooBot",
   names  = {},
   topic  = "",
messages  = [],
 MAX_LOG  = 250;

// Bind Socket.IO server to the http server
var io = io.listen(app);
io.configure('production', function(){
  io.set('log level', 1);
  io.enable('browser client minification');
  io.enable('browser client etag');
  io.set('transports', ['websocket', 'xhr-polling', 'jsonp-polling', 'htmlfile', 'flashsocket']);
});
io.configure('development', function(){
  io.set('log level', 2);
  io.set('transports', ['websocket', 'xhr-polling']);
});

io.sockets.on('connection', function(client){
  // Send the Back-log
  io.sockets.emit('names', names);
  io.sockets.emit('topic', topic);
  io.sockets.emit('message', messages);
});

// Before initializing IRC client, pull the json from couchDB
console.info("fetching back log");
connection.get(docId, function(err, doc){
  if(err){
    console.error(err);
    return;
  }else if(doc.messages && doc.messages.length){
    messages = doc.messages;
    console.log("Fetched the backlog. Message count : " + messages.length);
  }
});

// And set a timer to take backups every 60 seconds
var lastTimeStamp = 0, last;
if(!debug) setInterval(function(){
  if(messages.length === 0) return;
  last = messages[messages.length - 1];
  if(last.time <= lastTimeStamp) return;
  try{
    connection.save({
      "_id": docId,
      "messages": messages
    }, function(err, doc){
      if(err){
        console.error("Saving failed");
        console.error(err);
        return;
      }
      lastTimeStamp = last.time;
      console.info("Saved the backlog at " + new Date(lastTimeStamp));
    });
  }catch(e){}
},60*1000);

// And on SIGHUP flush the backlog
process.on('SIGHUP', function () {
  messages = [];
  lastTimeStamp = (new Date()).getTime();
  console.log("SIGHUP recieved.. flushing IRC message backlog");
});


// Init the IRC client & connect to #hasgeek
var ircClient = new irc.Client(server, nick, {
  'channels'  : [channel],
  'userName'  : "jsFooBot",
  'realName'  : "jsFooBot",
  'password'  : null,
  'autoRejoin': true,
  'debug'     : debug
});

console.info("Connecting to freenode");

// Add message handlers to the IRC client
ircClient.addListener('names', function(ch, nicks){
  if(ch.toLowerCase() !== channel) return;
  names = nicks;
  io.sockets.emit('names', nicks);
});
ircClient.addListener('topic', function(ch, tp){
  if(ch.toLowerCase() !== channel) return;
  topic = tp;
  io.sockets.emit('topic', topic);
});
ircClient.addListener('join', function(ch, nick){
  if(ch.toLowerCase() !== channel) return;
  names[nick] = '';
  io.sockets.emit('join', nick);
});
ircClient.addListener('part', function(ch, nick){
  if(ch.toLowerCase() !== channel) return;
  delete names[nick];
  io.sockets.emit('part', nick);
});
ircClient.addListener('nick', function(old, nick){
  delete names[old];  
  names[nick] = '';
  io.sockets.emit('nick', old, nick);
});
ircClient.addListener('message', function (from, ch, text) {
  if(ch.toLowerCase() !== channel) return;
  var packet = {from: from, text: text, time: (new Date()).getTime()};
  messages.push(packet);
  if(messages.length > MAX_LOG) messages.shift();
  io.sockets.emit('message', packet);
});
