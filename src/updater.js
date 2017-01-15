const request = require("request")
const fs = require("fs")
const path = require('path');

function update(rootDir, updateUrl, callback) {
  //Read the deviceId from file
  const deviceIdFile = path.join(rootDir, "device-id")
  const deviceId = fs.readFileSync(deviceIdFile)

  //Send the HTTP request
  const options = {
    uri: updateUrl,
    json: true,
    method: 'GET',
    qs: {
      'deviceId': deviceId
    }
  }
  request(options, function(err, response, body) {
    
    //Parse the response
    if (err) return callback(err)
    if (body.status === "noUpdateNeeded") {
      callback()
    } else if (body.status === "updateNeeded") {
      const snapshotId = getMandatoryResponseProperty(body, "snapshotId")
      const downloadUrl = getMandatoryResponseProperty(body, "downloadUrl")
      executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, callback)
    } else {
      callback(new Error("Unexpected or missing status in response body: " + body))
    }
  })
}

function getMandatoryResponseProperty(body, propertyName) {
  if (propertyName in body) {
    return body[propertyName]
  } else {
    throw new Error("Can't find property " + propertyName + " in body: " + JSON.stringify(body))
  }
}

function executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, callback) {
  //Create/update the device-id file
  const snapshotIdFile = path.join(rootDir, "snapshot-id")
  fs.writeFileSync(snapshotIdFile, snapshotId)
  callback()
}

exports.update = update


