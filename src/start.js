const util = require('./util')
const time = require('./time')
const fs = require('fs')
const path = require('path')
const Updater = require('./updater')
const DisplayClient = require("./display")
const idGenerator = require('./id-generator')


const config = require('./updater-config').loadConfig()

let errorMessage = null

if (config.simulate) {
  console.log("simulate == true, so I will only pretend to execute local update scripts.")
}


function checkForUpdate() {
  updater.checkForUpdateAndTellHubHowItWorkedOut()
    .then((result) => {
      display.showNetworkOk()
      console.log("Update check completed. ", result)
      checkUpdateInterval(result.newUpdateInterval)

      console.log("Waiting " + config.updateIntervalSeconds + " seconds...")
      setTimeout(checkForUpdate, config.updateIntervalSeconds * 1000)

    })
    .catch((err) => {
      if (err.networkError) {
        display.showNetworkError(err)
      }
      if (err.updateError) {
        display.showUpdateError(err)
      }
      
      console.log("Waiting " + config.updateIntervalSeconds + " seconds...")
      setTimeout(checkForUpdate, config.updateIntervalSeconds * 1000)
    })

}

/**
 * Notifies me that updating is currently in progress.
 * So I'll show a progress bar.
 */
function onUpdating(updating) {
  console.log("onUpdating called", updating)
  if (updating) {
    display.showUpdatingProgressBar()
  } else {
    display.hideUpdatingProgressBar()
  }
}

function truncate(string, toLength) {
  return string.substring(0, toLength)
}

function displayStatus(statusRow1, statusRow2, errorMessage) {
  const row = 9
  const col = 0

  if (statusRow1) {
    display.call("writeText", [statusRow1 + "        ", row, col, false, config.mainDisplayTab])
  }
  if (statusRow2) {
    display.call("writeText", [statusRow2 + "        ", row + 1, col, false, config.mainDisplayTab])
  }
}

function displayError(errorMessage) {
  display.call("writeText", [errorMessage])
}

function checkUpdateInterval(newUpdateInterval) {
  if (newUpdateInterval) {
    try {
      newUpdateInterval = parseInt(newUpdateInterval)
      if (newUpdateInterval < config.minUpdateIntervalSeconds) {
        newUpdateInterval = config.minUpdateIntervalSeconds
      }
      if (newUpdateInterval > config.maxUpdateIntervalSeconds) {
        newUpdateInterval = config.maxUpdateIntervalSeconds
      }
      config.updateIntervalSeconds = newUpdateInterval
      console.log("Setting update interval to " + config.updateIntervalSeconds + " seconds")
    } catch (err) {
      console.log("Something went wrong while parsing newUpdateInterval (ignoring it and moving on)", newUpdateInterval, err)
    }

  }

}

function readDeviceId() {
  const deviceIdFile = path.join(config.rootDir, "device-id")
  let deviceId
  if (fs.existsSync(deviceIdFile)) {
    deviceId = fs.readFileSync(deviceIdFile).toString()
  } else {
    deviceId = idGenerator.generateRandomId(config.deviceIdLength)
    fs.writeFileSync(deviceIdFile, deviceId)
    console.log("Created " + deviceIdFile + " with ID " + deviceId)
  }
  return deviceId
}

function createRootDirIfMissing() {
  if (!fs.existsSync(config.rootDir)) {
    fs.mkdirSync(config.rootDir)
    console.log("Created root dir: " + config.rootDir)
  }
}

function setSystemClock() {
  time.syncSystemClockWithServer(config.hubUrl)
}

createRootDirIfMissing()

const deviceId = readDeviceId()

const options = {
  updateScriptTimeoutSeconds: config.updateScriptTimeoutSeconds,
  simulate: config.simulate,
  onUpdating: onUpdating
}
const updater = new Updater(config.rootDir, config.hubUrl, options)

const display = new DisplayClient(deviceId, config.displayRpcPort, config.mainDisplayTab, true)

display.showDeviceId()

setSystemClock()
checkForUpdate()




