const fs = require('fs') //File system interaction
const nock = require('nock') //Mocks all http requests
const Archiver = require('archiver'); //Creates ZIP files

const url = require('url');
const querystring = require('querystring');

const testUtil = require('./test-util')

//This represents the Hub's view of the world
const devices = [
  {
    deviceId: "deviceA",
    latestSnapshotId: 1
  },

  {
    deviceId: "deviceB",
    latestSnapshotId: 2
  },

  {
    deviceId: "deviceC",
    latestSnapshotId: 2,
    fileInZip: "noUpdateFileHereHaHaHa.sh"
  },

  {
    deviceId: "deviceD",
    latestSnapshotId: 5,
    scriptIsInSubFolder: true
  },

  {
    deviceId: "deviceE",
    latestSnapshotId: 7,
    downloadType: 'sh',
    config: {
      color: 'blue'
    }
  },

  {
    deviceId: "deviceF",
    latestSnapshotId: 8,
    downloadType: 'js',
    config: {
      app1: {
        color: 'red'
      }
    }
  },

  {
    deviceId: "deviceG",
    latestSnapshotId: 30,
    newUpdateInterval: 120
  },

  {
    deviceId: "deviceH",
    latestSnapshotId: 1,
    sshTunnelRequested: true
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

  if (!device.downloadType || device.downloadType == 'zip') {
    device.downloadType = 'zip'
    publishZipFile(getFileName(device), subFileName, "Hello", device.scriptIsInSubFolder)
  } else if (device.downloadType == 'sh') {
    publishShFile(getFileName(device))
  } else if (device.downloadType == 'js') {
    publishJsFile(getFileName(device))
  } else {
    throw new Error("Invalid downloadType: " + device.downloadType)
  }

  device.lastLog = null
}

function getFileName(device) {
  return "update-" + device.deviceId + "-" + device.latestSnapshotId + "." + device.downloadType
}

function getFileUrl(device) {
  return "http://download.fakeupdater.com/" + getFileName(device)
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

function publishShFile(fileName) {
  nock('http://download.fakeupdater.com')
    .get("/" + fileName)
    .replyWithFile(200, testUtil.serverFilesDir + "/update.sh")
}


function publishJsFile(fileName) {
  nock('http://download.fakeupdater.com')
    .get("/" + fileName)
    .replyWithFile(200, testUtil.serverFilesDir + "/update.js")
}

function getDevice(deviceId) {
  console.assert(deviceId, "missing deviceId")
  for (device of devices) {
    if (device.deviceId == deviceId) {
      return device
    } 
  }
}

function initFixture() {
  devices.forEach(function(device){
    initDevice(device)
  });

  nock('http://fakeupdater.com')
    .get("/updateme")
    .query(true)
    .reply(200, function(uri, requestBody) {
      const query = url.parse(uri, true).query
      console.assert(query.deviceId, "No deviceId in request to updateme: " + JSON.stringify(query))
      const device = getDevice(query.deviceId)
      const response = {}

      if (device.newUpdateInterval) {
        response.updateInterval = device.newUpdateInterval
      }

      if (device.sshTunnelRequested) {
        response.sshTunnelRequested = true
      }

      if (query.snapshotId == device.latestSnapshotId) {
        response.status = 'noUpdateNeeded'
      } else {
        response.status = 'updateNeeded'
        response.snapshotId = device.latestSnapshotId
        response.downloadUrl = getFileUrl(device)
        response.downloadType = device.downloadType
        if (device.config) {
          response.config = device.config
        }
      }
      return response

    })

  nock('http://fakeupdater.com')
    .post("/howitworkedout")
    .reply(200, function(uri, requestBody) {
      console.assert(requestBody.deviceId, "No deviceId in request to howItWorkedOut: " + JSON.stringify(requestBody))

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
  fs.writeFileSync(testUtil.updaterRootDir + "/device-id", deviceId)
}

function setSnapshotId(snapshotId) {
  fs.writeFileSync(testUtil.updaterRootDir + "/snapshot-id", snapshotId)
}

function getSnapshotId() {
  return fs.readFileSync(testUtil.updaterRootDir + "/snapshot-id").toString()
}

exports.setDeviceId = setDeviceId
exports.setSnapshotId = setSnapshotId
exports.initFixture = initFixture
exports.getLastLog = getLastLog
exports.shouldNextUpdateScriptSucceed = shouldNextUpdateScriptSucceed
exports.getSnapshotId = getSnapshotId
