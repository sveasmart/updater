const rpc = require('json-rpc2');

/**
 *
 * @param method
 * @param args
 * @param logCalls
 * @returns {Promise}
 */
exports.callDisplayOverRpc = function(displayRpcPort, method, args, logCalls = false) {
  console.assert(displayRpcPort, "missing displayRpcPort")
  console.assert(method, "missing method")
  console.assert(args, "missing args")

  if (logCalls) {
    if (args) {
      console.log("RPC-calling " + method + "(" + args.join(", ") + ")")
    } else {
      console.log("RPC-calling " + method + "()")
    }
  }
  const rpcClient = rpc.Client.$create(displayRpcPort, 'localhost');
  return new Promise((resolve, reject) => {
    rpcClient.call(method, args, (err, res) => {
      if (err) {
        console.log("Failed to RPC-call display " + method + "!")
        reject(err);
      }
      else resolve(res);
    });
  });
}