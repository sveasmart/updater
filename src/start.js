const config = require('config')
const fs = require('fs')
const path = require('path')

const updater = require('./updater')
const idGenerator = require('./id-generator')

const rootDir = config.get('rootDir')
const hubUrl = config.get('hubUrl')
var updateIntervalSeconds = config.get('updateIntervalSeconds')
const deviceIdLength = config.get('deviceIdLength')
const simulate = config.get('simulate')

const maxUpdateIntervalSeconds = 60 * 60 * 24  //max 24 hours
const minUpdateIntervalSeconds = 1

if (simulate) {
  console.log("simulate == true, so I will only pretend to execute local update scripts.")
}

function checkForUpdate() {
  updater.checkForUpdateAndTellHubHowItWorkedOut(rootDir, hubUrl, simulate, updateCheckCompleted)
}


function updateCheckCompleted(err, result) {
  if (err) {
    console.log("Update check failed! " + err.message)
  } else {
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
      console.log("Something went wrong while parsing newUpdateInterval (ignoring it and moving on)", newUpdateInterval, err2)
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

createRootDirIfMissing()
generateDeviceIdIfMissing()
checkForUpdate()




