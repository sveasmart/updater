const fs = require('fs') //File system interaction
const nock = require('nock') //Mocks all http requests
const Archiver = require('archiver'); //Creates ZIP files

const url = require('url');
const querystring = require('querystring');

const devices = [
  {
    deviceId: "deviceA",
    latestSnapshotId: "1",
    doesUpdateFileWork: true
  },

  {
    deviceId: "deviceB",
    latestSnapshotId: "2",
    doesUpdateFileWork: false
  }
]

function initDevice(device) {
  publishZipFile(getZipFileName(device), device.doesUpdateFileWork)
}

function getZipFileName(device) {
  return "update-" + device.deviceId + "-" + device.latestSnapshotId + ".zip"
}

function getZipFileUrl(device) {
  return "http://download.fakeupdater.com/" + getZipFileName(device)
}

function publishZipFile(fileName, works) {
  var zipFile = Archiver('zip');
  zipFile.append('Hello',  { name: 'update.sh' }).finalize()

  nock('http://download.fakeupdater.com')
    .get("/" + fileName)
    .reply(200, function(uri, requestBody) {
      return zipFile
    })
}

function getDevice(deviceId) {
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
      const device = getDevice(query.deviceId)
      if (query.snapshotId == device.latestSnapshotId) {
        return {
          status: 'noUpdateNeeded'
        }
      } else {
        return {
          status: 'updateNeeded',
          snapshotId: device.latestSnapshotId,
          downloadUrl: getZipFileUrl(device)
        }
      }
    })

  nock('http://fakeupdater.com')
    .post("/howitworkedout")
    .reply(200, function(uri, requestBody) {
      const query = url.parse(uri, true).query
      console.log("howitworkedout body", requestBody)
      const device = getDevice(query.deviceId)
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

exports.setDeviceId = setDeviceId
exports.setSnapshotId = setSnapshotId
exports.initFixture = initFixture
exports.getLastLog = getLastLog