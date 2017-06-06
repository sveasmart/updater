/**
 * This module encapsulates some if the nitty gritty stuff around loading
 * config params.
 */

const util = require('./util')
const config = require('config')

config.rootDir = config.get('rootDir')
config.hubUrl = config.get('hubUrl')
config.updateIntervalSeconds = util.getConfigWithMinMax('updateIntervalSeconds', 1, 60 * 60 * 24)  //max 24 hours
config.deviceIdLength = config.get('deviceIdLength')
config.simulate = config.get('simulate')
config.updateScriptTimeoutSeconds = util.getConfigWithMinMax('updateScriptTimeoutSeconds', 1, 60 * 60) //max 1 hour

config.displayRpcPort = config.get("displayRpcPort")
config.mainDisplayTab = config.get("mainDisplayTab")
config.networkInfoDisplayTab = config.get("networkInfoDisplayTab")


/**
 * Loads the given config param and stores it
 * as a field in the config object.
 * If the param is missing, it will either return the default value (if given)
 * or throw an exception.
 */
function loadConfig(paramName, defaultValue) {
  config[paramName] = getConfig(paramName, defaultValue)
}

/**
 * Returns the given config param.
 * If the param is missing, it will either return the default value (if given)
 * or throw an exception.
 */
function getConfig(paramName, defaultValue) {
  if (defaultValue !== undefined) {
    if (config.has(paramName)) {
      return config.get(paramName)
    } else {
      return defaultValue
    }
  } else {
    return config.get(paramName)
  }
}

module.exports = config