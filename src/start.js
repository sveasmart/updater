const util = require('./util')
const time = require('./time')
const config = require('config')
const fs = require('fs')
const path = require('path')

const updater = require('./updater')
const idGenerator = require('./id-generator')

const minUpdateIntervalSeconds = 1
const maxUpdateIntervalSeconds = 60 * 60 * 24 //max 24 hours

const rootDir = config.get('rootDir')
const hubUrl = config.get('hubUrl')
var updateIntervalSeconds = util.getConfigWithMinMax('updateIntervalSeconds', minUpdateIntervalSeconds, maxUpdateIntervalSeconds)
const deviceIdLength = config.get('deviceIdLength')
const simulate = config.get('simulate')
const updateScriptTimeoutSeconds = util.getConfigWithMinMax('updateScriptTimeoutSeconds', 1, (60 * 60)) //max 1 hour

if (simulate) {
  console.log("simulate == true, so I will only pretend to execute local update scripts.")
}

function checkForUpdate() {
  updater.checkForUpdateAndTellHubHowItWorkedOut(rootDir, hubUrl, updateScriptTimeoutSeconds, simulate, updateCheckCompleted)
}


var display = null

try {
  const adafruit = require('adafruit-mcp23008-ssd1306-node-driver')
  if (adafruit.hasDriver()) {
    console.log("Adafruit is available, so this device appears to have a display :)")
    display = new adafruit.DisplayDriver()
  } else {
    console.log("Adafruit is not available, so we'll fake the display using the console")
  }
} catch (err) {
  console.log("Failed to load Adafruit, so we'll fake the display using the console" + err)
}

function showTextOnDisplay(text) {
  console.log("SHOWING ON DISPLAY: " + texts);
  if (display) {
    try {
      display.clear()
      display.writeText(text, 0, 0, true)
    } catch (err) {
      console.log("Failed to update display. Will ignore and move on", err)
    }
  }
}

function showErrorOnDisplay(errorType, errorMessage) {
  console.log("SHOWING ON DISPLAY: " + errorType + "\n" + errorMessage);
  if (display) {
    try {
      display.clear()
      display.writeText(errorType, 0, 0, false)
      display.writeText(errorMessage, 0, 1, true)
    } catch (err) {
      console.log("Failed to update display. Will ignore and move on", err)
    }
  }

}

var networkWasDown = false

function truncate(string, toLength) {
  return string.substring(0, toLength)
}

function updateCheckCompleted(err, result) {
  if (err) {
    networkWasDown = true

    let errorType = "Error"
    if (err.networkError == true) {
      errorType = "Network error"
    }
    if (err.updateError == true) {
      errorType = "Update error"
    }
    showErrorOnDisplay(errorType, err.message)

  } else {
    if (networkWasDown) {
      networkWasDown = false
      showTextOnDisplay("Network OK")
    }

    console.log("Update check completed. ", result)
    checkUpdateInterval(result.newUpdateInterval)
  }
  console.log("Waiting " + updateIntervalSeconds + " seconds...")
  setTimeout(checkForUpdate, updateIntervalSeconds * 1000)
}

function checkUpdateInterval(newUpdateInterval) {
  if (newUpdateInterval) {
    try {
      newUpdateInterval = parseInt(newUpdateInterval)
      if (newUpdateInterval < minUpdateIntervalSeconds) {
        newUpdateInterval = minUpdateIntervalSeconds
      }
      if (newUpdateInterval > maxUpdateIntervalSeconds) {
        newUpdateInterval = maxUpdateIntervalSeconds
      }
      updateIntervalSeconds = newUpdateInterval
      console.log("Setting update interval to " + updateIntervalSeconds + " seconds")
    } catch (err) {
      console.log("Something went wrong while parsing newUpdateInterval (ignoring it and moving on)", newUpdateInterval, err)
    }

  }

}

function generateDeviceIdIfMissing() {
  const deviceIdFile = path.join(rootDir, "device-id")
  if (!fs.existsSync(deviceIdFile)) {
    const deviceId = idGenerator.generateRandomId(deviceIdLength)
    fs.writeFileSync(deviceIdFile, deviceId)
    console.log("Created " + deviceIdFile + " with ID " + deviceId)
  }
}

function createRootDirIfMissing() {
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir)
    console.log("Created root dir: " + rootDir)
  }
}

function setSystemClock() {
  time.syncSystemClockWithServer(hubUrl)
}


setSystemClock()
createRootDirIfMissing()
generateDeviceIdIfMissing()
checkForUpdate()




