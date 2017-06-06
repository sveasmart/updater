const Promise = require('promise')
const promiseRetry = require('promise-retry')
const rpc = require('json-rpc2');

class DisplayClient {
  constructor(displayRpcPort, displayTab, logCalls) {
    this.rpcClient = rpc.Client.$create(displayRpcPort, 'localhost');
    this.displayTab = displayTab
    this.logCalls = logCalls
  }

  call(method, args) {
    if (this.logCalls) {
      if (args) {
        console.log("RPC-calling " + method + "(" + args.join(", ") + ")")
      } else {
        console.log("RPC-calling " + method + "()")
      }
    }
    return new Promise((resolve, reject) => {
      this.rpcClient.call(method, args, (err, res) => {
        if (err) {
          console.log("Failed to RPC-call display " + method + "!")
          reject(err);
        }
        else resolve(res);
      });
    });
  }

  callAndRetry(method, args) {
    return promiseRetry((retry, number) => {
      if (number > 1) {
        console.log('...' + method + ' attempt number', number);
      }
      return this.call(method, args).catch((error) => {
        console.log(method + " failed! Will retry. " +  error)
        retry()
      });
    })
  }
  
}

module.exports = DisplayClient