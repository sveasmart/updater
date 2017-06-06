const rpc = require('json-rpc2');

/**
 * Makes the given RPC call to the display service.
 * Returns a promise
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
  const rpcClient = rpc.Client.$create(displayRpcPort, '127.0.0.1');
  return new Promise((resolve, reject) => {
    rpcClient.call(method, args, (err, res) => {
      if (err) {
        reject(err);
      }
      else resolve(res);
    });
  });
}