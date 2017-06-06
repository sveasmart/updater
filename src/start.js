const util = require('./util')
const time = require('./time')
const config = require('./config')


const fs = require('fs')
const path = require('path')

const Updater = require('./updater')
const updater = new Updater()
const idGenerator = require('./id-generator')
const ProgressBar = require('./progress-bar')

const displayClient = new DisplayClient(config.displayRpcPort, config.mainDisplayTab, true)

const updaterState = new require('./updater-state').UpdaterState()

let errorMessage = null

if (config.simulate) {
  console.log("simulate == true, so I will only pretend to execute local update scripts.")
}

var progressBar = null

function checkForUpdate() {
  updater.checkForUpdateAndTellHubHowItWorkedOut(config.rootDir, config.hubUrl, config.updateScriptTimeoutSeconds, config.simulate)
    .then((result) => {
    updateCheckCompleted(result)  
  })
}

/**
 * Actives the progress bar if an update is going on, or hides it if not.
 * @param updating true if update is currently going on, false otherwise
 */
function setIsUpdating(updating) {
  if (progressBar) {
    progressBar.setActive(updating)

    if (!updating) {
      display.clearRow(0)
    }
  } else {
    console.log("No display, so I can't show a progress bar. But anyway, updating is " + updating)
  }
}

function showTextOnDisplay(text) {
  if (display) {
    try {
      display.clearRow(0)
      display.writeText(text, 0, 0, true)
    } catch (err) {
      console.log("Failed to update display. Will ignore and move on", err)
    }
  } else {
    console.log("SHOWING ON DISPLAY: " + texts);
  }
}

function showErrorOnDisplay(errorType, errorMessage) {
  if (display) {
    try {
      display.clearRow(0)
      display.writeText(errorType, 0, 0, false)
      display.clearRow(1)
      display.writeText(errorMessage, 0, 1, true)
    } catch (err) {
      console.log("Failed to update display. Will ignore and move on", err)
    }
  } else {
    console.log("SHOWING ON DISPLAY: " + errorType + "\n" + errorMessage);
  }

}

var networkWasDown = false

function truncate(string, toLength) {
  return string.substring(0, toLength)
}

function displayStatus(statusRow1, statusRow2, errorMessage) {
  const row = 9
  const col = 0

  if (statusRow1) {
    displayClient.call("writeText", [statusRow1 + "        ", row, col, false, mainDisplayTab])
  }
  if (statusRow2) {
    displayClient.call("writeText", [statusRow2 + "        ", row + 1, col, false, mainDisplayTab])
  }
}

function displayError(errorMessage) {
  displayClient.call("writeText",)
}

function updateCheckCompleted(err, result) {
  if (err) {
    networkWasDown = true

    let errorType = "Error"
    if (err.networkError == true) {
      displayStatus("Network", "DOWN!")
      displayError(err.message)
    }
    if (err.updateError == true) {
      displayStatus("Update", "FAILED!")
      displayError(err.message)
    }
    showErrorOnDisplay(errorType, err.message)

  } else {
    displayStatus("Network", "OK")
    console.log("Update check completed. ", result)
    checkUpdateInterval(result.newUpdateInterval)
  }
  console.log("Waiting " + config.updateIntervalSeconds + " seconds...")
  setTimeout(checkForUpdate, config.updateIntervalSeconds * 1000)
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
      config.updateIntervalSeconds = newUpdateInterval
      console.log("Setting update interval to " + config.updateIntervalSeconds + " seconds")
    } catch (err) {
      console.log("Something went wrong while parsing newUpdateInterval (ignoring it and moving on)", newUpdateInterval, err)
    }

  }

}

function generateDeviceIdIfMissing() {
  const deviceIdFile = path.join(config.rootDir, "device-id")
  if (!fs.existsSync(deviceIdFile)) {
    const deviceId = idGenerator.generateRandomId(config.deviceIdLength)
    fs.writeFileSync(deviceIdFile, deviceId)
    console.log("Created " + deviceIdFile + " with ID " + deviceId)
  }
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

function runSpinnerWhenNeeded() {
  
}

setSystemClock()
createRootDirIfMissing()
generateDeviceIdIfMissing()
checkForUpdate()




