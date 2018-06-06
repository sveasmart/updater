const Promise = require('promise')
const rpc = require('json-rpc2');

/**
 * Low level adapter for talking to the display service via RPC,
 * using this protocol: https://github.com/sveasmart/display
 *
 * Doesn't know anything about HOW the update wants to use the display.
 * Just handles the RPC-related boilerplate.
 */

class DisplayRpcClient {
  constructor(displayRpcPort, logCalls) {
    this.rpcClient = rpc.Client.$create(displayRpcPort, '127.0.0.1');
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
          console.log("Failed to RPC-call display " + method + "! Could be temporary. " + err)
          reject(err);
        } else {
          resolve(res)
        }
      });
    });
  }
}

module.exports = DisplayRpcClient