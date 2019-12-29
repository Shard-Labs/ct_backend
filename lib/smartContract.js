const { Universal: Ae, MemoryAccount, Node, Crypto } = require('@aeternity/aepp-sdk');
const nacl = require('tweetnacl');
const bip39 = require('bip39');
const config = require('config');

let _contract;

/**
 * Initialize smart contract
 * @param callback
 * @return {*}
 */
async function initContract(callback) {
  if (_contract) {
    console.warn('Trying to init Contract again!');
    return callback(null, _contract);
  }

  // use email+pwd as seed to generate private key
  const seed = bip39.mnemonicToSeedSync(config.get('bc.seed'));
  const keypair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
  const secretKey = Buffer.from(keypair.secretKey).toString('hex');
  const publicKey = `ak_${Crypto.encodeBase58Check(keypair.publicKey)}`;
  console.log('public key', publicKey);
  const keypairFormatted = { secretKey, publicKey };

  const node1 = Node({
    url: config.get('bc.url'),
    internalUrl: config.get('bc.url'),
  });
  const acc1 = MemoryAccount({ keypair: keypairFormatted });
  const nodes = await Promise.all([node1]);
  const client = await Ae({
    // This two params deprecated and will be remove in next major release
    url: config.get('bc.url'),
    internalUrl: config.get('bc.url'),
    // instead use
    nodes: [
      { name: 'node1', instance: nodes[0] },
      // mode2
    ],
    compilerUrl: 'https://compiler.aepps.com',
    accounts: [
      acc1,
    ],
  });

  const contractSource = 'contract CryptoTask =\n\n    record state = {\n        tasks : map(int, task),\n        lastTaskIndex : int,\n        nonces : map(address, int)\n        }\n\n    record task = {\n        client : address,\n        flancers : list(int),\n        title : string,\n        descriptionHash : string,\n        taskValue : int,\n        workTime : int,\n        stage : int\n        }\n\n    public stateful entrypoint init() = { \n            tasks = {},\n            lastTaskIndex = 0,\n            nonces = {}\n        }\n        \n        \n    public stateful entrypoint postTask(pubkey: address, sig: signature, nonce : int, functionName : string, title : string, descriptionHash : string, taskValue : int, workTime : int) =      \n        require(functionName == \"postTask\" && Crypto.verify_sig(String.blake2b( String.concat(Int.to_str(nonce), String.concat(functionName, String.concat(title, String.concat(descriptionHash, String.concat(Int.to_str(taskValue), Int.to_str(workTime)))))) ), pubkey, sig) && nonce == state.nonces[pubkey=0], \"Wrong function name, nonce or failed signature check\" )\n\n        let new_task : task = {\n            client = pubkey,\n            flancers = [],\n            title = title,\n            descriptionHash = descriptionHash,\n            taskValue = taskValue,\n            workTime = workTime,\n            stage = 0}\n\n        put(state{tasks[state.lastTaskIndex] = new_task})  \n        put(state{lastTaskIndex = state.lastTaskIndex + 1}) \n        put(state{nonces[pubkey] = state.nonces[pubkey=0] + 1}) \n\n\tstate.lastTaskIndex - 1\n\n\n    public entrypoint getTask(index: int) =\n        state.tasks[index]\n        \n    public entrypoint getNonce(pubkey: address) =\n        state.nonces[pubkey=0]    \n\n';
  _contract = await client.getContractInstance(contractSource, {
    contractAddress: config.get('bc.address')
  });
}

/**
 * Get initialized smart contract
 * @return {*}
 */
function getContract() {
  if (!_contract) {
    throw new Error('No contract initialized!');
  }
  return _contract;
}

module.exports = {
  initContract,
  getContract,
};
