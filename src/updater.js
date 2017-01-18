const request = require('request')
const fs = require("fs")
const path = require('path')
const child_process = require('child_process')
const extract = require('extract-zip')


//Calls the given updateUrl and checks if an update is needed.
//Uses the given rootDir to fetch the device-id,
//update the snapshot-id, and store and execute the update itself.
function update(rootDir, updateUrl, callback) {
  //Read the deviceId from file
  const deviceIdFile = path.join(rootDir, "device-id")
  const deviceId = fs.readFileSync(deviceIdFile)

  //Configure the HTTP request
  const options = {
    uri: updateUrl,
    json: true,
    method: 'GET',
    qs: {
      'deviceId': deviceId
    }
  }

  //Do the http request
  request(options, function(err, response, body) {
    
    //Parse the response
    if (err) return callback(err)
    if (body.status === "noUpdateNeeded") {
      //Nothing to change. We are done!
      callback()

    } else if (body.status === "updateNeeded") {
      //Update needed!
      const snapshotId = getMandatoryResponseProperty(body, "snapshotId")
      const downloadUrl = getMandatoryResponseProperty(body, "downloadUrl")
      executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, callback)

    } else {
      //Invalid response. Bail out!
      callback(new Error("Unexpected or missing status in response body: " + body))
    }
  })
}

//Gets the given property, or throws error if it doesn't exist.
function getMandatoryResponseProperty(body, propertyName) {
  if (propertyName in body) {
    return body[propertyName]
  } else {
    throw new Error("Can't find property " + propertyName + " in body: " + JSON.stringify(body))
  }
}

//TODO work in progress
function executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, callback) {
  //Create/update the device-id file
  const snapshotIdFile = path.join(rootDir, "snapshot-id")
  fs.writeFileSync(snapshotIdFile, snapshotId)

  fs.mkdirSync('/home/downloads/')
  const snapshotRoot = '/home/downloads/' + snapshotId
  fs.mkdirSync(snapshotRoot)
  const downloadedFile = snapshotRoot + '/download.zip'

  //Download the file
  const zipFilePipe = request({uri: downloadUrl}).pipe(fs.createWriteStream(downloadedFile))
  zipFilePipe.on('close', function() {
    //OK now I got my ZIP file. Let's unzip it.
    extract(downloadedFile, {dir: snapshotRoot}, function (err) {
      if (err) return callback(err)

      const updateScript = snapshotRoot + "/update.sh"

      if (fs.existsSync(updateScript)) {
        child_process.execFileSync(updateScript)
        //TODO catch error?
        callback()
      } else {
        callback(new Error("The zip file didn't contain update.sh!"))
      }
    })

  })

}


exports.update = update


