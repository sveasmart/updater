const config = require('config')
const fs = require('fs')
const path = require('path')

const updater = require('./updater')
const idGenerator = require('./id-generator')

const rootDir = config.get('rootDir')
const hubUrl = config.get('hubUrl')
const updateIntervalSeconds = config.get('updateIntervalSeconds')
const deviceIdLength = config.get('deviceIdLength')

function checkForUpdate() {
  console.log("Checking for update from " + hubUrl + " ...")
  updater.checkForUpdate(rootDir, hubUrl, updateCheckCompleted)
}

function updateCheckCompleted(err, result) {
  if (err) {
    console.log("Update failed! ", err)
  } else {
    console.log("Update completed. ", result)
  }
  console.log("Waiting " + updateIntervalSeconds + " seconds...")
  setTimeout(checkForUpdate, updateIntervalSeconds * 1000)
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



