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
    mainDisplayTab: config.get("mainDisplayTab"),
    networkInfoDisplayTab: config.get("networkInfoDisplayTab")
  }
}
