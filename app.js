const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const jwt = require('./middleware/jwt');
const socket_io = require('socket.io');

const { Universal: Ae, MemoryAccount, Node, Crypto } = require('@aeternity/aepp-sdk')
const nacl = require('tweetnacl');
const bip39 = require('bip39');

const app = express();

// Socket.io
const io = socket_io();
const socketHandler = require('./lib/socketHandler.js');
app.io = io;

const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const applicationsRouter = require('./routes/applications');
const messagesRouter = require('./routes/messages');
const filesRouter = require('./routes/files');
const utilRouter = require('./routes/util');
const freelancersRouter = require('./routes/freelancers');
const clientsRouter = require('./routes/clients');
const invitationsRouter = require('./routes/invitations');
const notificationsRouter = require('./routes/notifications');

app.use(cors());
app.use(logger('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/utils', utilRouter);
app.use('/tasks', tasksRouter);
app.use('/users', jwt.checkToken, usersRouter);
app.use('/applications', jwt.checkToken, applicationsRouter);
app.use('/messages', jwt.checkToken, messagesRouter);
app.use('/files', jwt.checkToken, filesRouter);
app.use('/freelancers', freelancersRouter);
app.use('/clients', jwt.checkToken, clientsRouter);
app.use('/invitations', jwt.checkToken, invitationsRouter);
app.use('/notifications', jwt.checkToken, notificationsRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// no stacktraces leaked to user unless in development environment
app.use((err, req, res) => {
  if (app.get('env') === 'development') {
    console.error(err);
  }

  res.status(err.status || 500);
  return res.json({
    success: false,
    message: err.message,
    data: (app.get('env') === 'development') ? err : {},
  });
});

socketHandler(io);



// use email+pwd as seed to generate private key
const seed = bip39.mnemonicToSeedSync('fewr43f$#Rr43t4fr43er');
const keypair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
const secretKey = Buffer.from(keypair.secretKey).toString('hex');
const publicKey = `ak_${Crypto.encodeBase58Check(keypair.publicKey)}`;
console.log(publicKey);
const keypairFormatted = { secretKey, publicKey };

const node1 = Node({ url: 'https://sdk-testnet.aepps.com', internalUrl: 'https://sdk-testnet.aepps.com' });
const acc1 = MemoryAccount({ keypair: keypairFormatted });
Promise.all([node1]).then(nodes => { 
  Ae({
    // This two params deprecated and will be remove in next major release
    url: 'https://sdk-testnet.aepps.com',
    internalUrl: 'https://sdk-testnet.aepps.com',
    // instead use
    nodes: [
      { name: 'node1', instance: nodes[0] },
      // mode2
    ],
    compilerUrl: 'https://compiler.aepps.com',
    accounts: [
      acc1,
    ],
  }).then(client => {
    const contractSource = 'contract CryptoTask =\n\n    record state = {\n        tasks : map(int, task),\n        lastTaskIndex : int,\n        nonces : map(address, int)\n        }\n\n    record task = {\n        client : address,\n        flancers : list(int),\n        title : string,\n        descriptionHash : string,\n        taskValue : int,\n        workTime : int,\n        stage : int\n        }\n\n    public stateful entrypoint init() = { \n            tasks = {},\n            lastTaskIndex = 0,\n            nonces = {}\n        }\n        \n        \n    public stateful entrypoint postTask(pubkey: address, sig: signature, nonce : int, functionName : string, title : string, descriptionHash : string, taskValue : int, workTime : int) =      \n        require(functionName == \"postTask\" && Crypto.verify_sig(String.blake2b( String.concat(Int.to_str(nonce), String.concat(functionName, String.concat(title, String.concat(descriptionHash, String.concat(Int.to_str(taskValue), Int.to_str(workTime)))))) ), pubkey, sig) && nonce == state.nonces[pubkey=0], \"Wrong function name, nonce or failed signature check\" )\n\n        let new_task : task = {\n            client = pubkey,\n            flancers = [],\n            title = title,\n            descriptionHash = descriptionHash,\n            taskValue = taskValue,\n            workTime = workTime,\n            stage = 0}\n\n        put(state{tasks[state.lastTaskIndex] = new_task})  \n        put(state{lastTaskIndex = state.lastTaskIndex + 1}) \n        put(state{nonces[pubkey] = state.nonces[pubkey=0] + 1}) \n\n\tstate.lastTaskIndex - 1\n\n\n    public entrypoint getTask(index: int) =\n        state.tasks[index]\n        \n    public entrypoint getNonce(pubkey: address) =\n        state.nonces[pubkey=0]    \n\n';
    client.getContractInstance(contractSource, {contractAddress : 'ct_2YhSJQakfc2euw5mzd7KPYdyzWXx6onYw45G2iJUVTg9xbLXA6'}).then(contract => {
      app.locals.contract = contract;
    });
  });
});



module.exports = app;
