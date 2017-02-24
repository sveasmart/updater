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

let display;

try {
  const adafruit = require('adafruit-mcp23008-ssd1306-node-driver')
  if (adafruit.hasDriver()) {
    console.log("Adafruit is available, so this device appears to have a display :)")
    display = new adafruit.DisplayDriver()
    buttons = new adafruit.ButtonDriver()
  } else {
    console.log("Adafruit is not available, so we'll fake the display using the console")
    display = new adafruit.FakeDisplayDriver()
    buttons = new adafruit.FakeButtonDriver()
  }

} catch (err) {
  console.log("Failed to load Adafruit, so we'll fake the display using the console" + err)
  display = null
  buttons = null
}

function showTextOnDisplay(text) {
  console.log(text);
  if (display) {
    display.text(text);
  }
}

var networkWasDown = false

function updateCheckCompleted(err, result) {
  if (err) {
    networkWasDown = true
    showTextOnDisplay("Network Down? - No contact with server");
    console.log("Update check failed! " + err.message)
  } else {
    if (networkWasDown) {
      networkWasDown = false
      showTextOnDisplay("Network back up again")
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




