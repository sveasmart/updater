const fs = require('fs') //File system interaction
const nock = require('nock') //Mocks all http requests
const Archiver = require('archiver'); //Creates ZIP files

const url = require('url');
const querystring = require('querystring');

//This represents the Hub's view of the world
const devices = [
  {
    deviceId: "deviceA",
    latestSnapshotId: "1"
  },

  {
    deviceId: "deviceB",
    latestSnapshotId: "2"
  },

  {
    deviceId: "deviceC",
    latestSnapshotId: "2",
    fileInZip: "noUpdateFileHereHaHaHa.sh"
  },

  {
    deviceId: "deviceD",
    latestSnapshotId: "5",
    scriptIsInSubFolder: true
  },

  {
    deviceId: "deviceE",
    latestSnapshotId: "7",
    shFileDirectly: true
  }

]

//This variable is used to control if the next
//update.sh script execution will pretend to succeed
//or pretend to fail.
var shouldNextUpdateScriptSucceed = true

function initDevice(device) {
  var subFileName = "update.sh"
  if (device.fileInZip) {
    subFileName = device.fileInZip
  } 

  if (device.shFileDirectly === true) {
    publishShFile(getShFileName(device), "hello")
  } else {
    publishZipFile(getZipFileName(device), subFileName, "Hello", device.scriptIsInSubFolder)
  }

  device.lastLog = null
}

function getShFileName(device) {
  return "update-" + device.deviceId + "-" + device.latestSnapshotId + ".sh"
}

function getZipFileName(device) {
  return "update-" + device.deviceId + "-" + device.latestSnapshotId + ".zip"
}

function getZipFileUrl(device) {
  return "http://download.fakeupdater.com/" + getZipFileName(device)
}

function getShFileUrl(device) {
  return "http://download.fakeupdater.com/" + getShFileName(device)
}

function publishZipFile(fileName, subFileName, subFileContent, subFileIsInSubFolder) {
  var zipFile = Archiver('zip');

  if (subFileIsInSubFolder) {
    zipFile.append(subFileContent,  { name: "stuff/" + subFileName }).finalize()
  } else {
    zipFile.append(subFileContent,  { name: subFileName }).finalize()
  }

  nock('http://download.fakeupdater.com')
    .get("/" + fileName)
    .reply(200, function(uri, requestBody) {
      return zipFile
    })
}

function publishShFile(fileName, fileContent) {
  nock('http://download.fakeupdater.com')
    .get("/" + fileName)
    .replyWithFile(200, "/serverstuff/update.sh")
}

function getDevice(deviceId) {
  for (device of devices) {
    if (device.deviceId == deviceId) {
      return device
    } 
  }
}

function initFixture() {
  shouldNextUpdateScriptSucceed = true


  devices.forEach(function(device){
    initDevice(device)
  });

  nock('http://fakeupdater.com')
    .get("/updateme")
    .query(true)
    .reply(200, function(uri, requestBody) {
      const query = url.parse(uri, true).query
      const device = getDevice(query.deviceId)
      if (query.snapshotId == device.latestSnapshotId) {
        return {
          status: 'noUpdateNeeded'
        }
      } else {
        if (device.shFileDirectly) {
          return {
            status: 'updateNeeded',
            snapshotId: device.latestSnapshotId,
            downloadUrl: getShFileUrl(device),
            downloadType: 'sh'
          }
        } else {
          return {
            status: 'updateNeeded',
            snapshotId: device.latestSnapshotId,
            downloadUrl: getZipFileUrl(device)
          }

        }

      }
    })

  nock('http://fakeupdater.com')
    .post("/howitworkedout")
    .reply(200, function(uri, requestBody) {
      const device = getDevice(requestBody.deviceId)
      device.lastLog = requestBody
      return {
        status: 'ok'
      }
    })
}

function getLastLog(deviceId) {
  return getDevice(deviceId).lastLog
}

function setDeviceId(deviceId) {
  fs.writeFileSync("/updatertest/device-id", deviceId)
}

function setSnapshotId(snapshotId) {
  fs.writeFileSync("/updatertest/snapshot-id", snapshotId)
}

function getSnapshotId() {
  return fs.readFileSync("/updatertest/snapshot-id").toString()
}

exports.setDeviceId = setDeviceId
exports.setSnapshotId = setSnapshotId
exports.initFixture = initFixture
exports.getLastLog = getLastLog
exports.shouldNextUpdateScriptSucceed = shouldNextUpdateScriptSucceed
exports.getSnapshotId = getSnapshotId
