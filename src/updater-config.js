/**
 * This module encapsulates some if the nitty gritty stuff around loading
 * config params.
 */

const util = require('./util')
const config = require('config')

exports.loadConfig = function() {
  const minUpdateIntervalSeconds = 1
  const maxUpdateIntervalSeconds = 60 * 60 * 24 //max 24 hours

  const minUpdateScriptTimeoutSeconds = 1
  const maxUpdateScriptTimeoutSeconds = 60 * 60 //1 hour

  return {
    minUpdateIntervalSeconds: minUpdateIntervalSeconds,
    maxUpdateIntervalSeconds: maxUpdateIntervalSeconds,

    minUpdateScriptTimeoutSeconds: minUpdateScriptTimeoutSeconds,
    maxUpdateScriptTimeoutSeconds: maxUpdateScriptTimeoutSeconds,

    rootDir: config.get('rootDir'),
    hubUrl: config.get('hubUrl'),
    updateIntervalSeconds: util.getConfigWithMinMax('updateIntervalSeconds', minUpdateIntervalSeconds, maxUpdateIntervalSeconds),
    deviceIdLength: config.get('deviceIdLength'),
    simulate: config.get('simulate'),
    updateScriptTimeoutSeconds: util.getConfigWithMinMax('updateScriptTimeoutSeconds', minUpdateScriptTimeoutSeconds, maxUpdateScriptTimeoutSeconds),

    displayRpcPort: config.get("displayRpcPort"),
    displayResendIntervalSeconds: config.get("displayResendIntervalSeconds"),
    logDisplayCalls: getBool("logDisplayCalls"),

    mainDisplayTab: config.get("mainDisplayTab"),
    networkInfoDisplayTab: config.get("networkInfoDisplayTab"),
    sshTunnelCommand: config.get("sshTunnelCommand"),
    scriptToCallWhenDeviceIdHasBeenSet: config.get("scriptToCallWhenDeviceIdHasBeenSet")
  }
}


/**
 * Gets a config param, and fails if it doesn't exist.
 */
function get(name) {
  const value = config.get(name)
  console.assert(value != null && value != undefined, "Missing config param " + name)
  return value
}

/**
 * Gets a config param and turns it into a string. Fails if doesn't exist.
 */
function getString(name) {
  const value = "" + get(name)
  console.assert(value.trim() != "", "Empty config param " + name)
  return value
}



function getBool(name) {
  const value = getString(name).trim().toLowerCase()
  if (value == "true") {
    return true
  } else if (value == "false") {
    return false
  } else {
    throw new Error(name + " was " + getString(name) + ", but I expected true/false")
  }
}
