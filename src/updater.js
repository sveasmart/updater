const request = require('request')
const fs = require("fs")
const path = require('path')
const child_process = require('child_process')
const extract = require('extract-zip')

const encoding = 'utf8'

//Calls the given updateUrl and checks if an update is needed.
//Uses the given rootDir to fetch the device-id,
//update the snapshot-id, and store and execute the update itself.
function update(rootDir, hubUrl, callback) {
  //Read the deviceId from file
  const deviceIdFile = path.join(rootDir, "device-id")
  const deviceId = fs.readFileSync(deviceIdFile, encoding)

  //Read the snapshotId from file, or use 0 if not found.
  const snapshotIdFile = path.join(rootDir, "snapshot-id")
  var snapshotId = 0
  if (fs.existsSync(snapshotIdFile)) {
    snapshotId = fs.readFileSync(snapshotIdFile, encoding)
  }
  askHubToUpdateMe(rootDir, hubUrl, deviceId, snapshotId, callback)

}

function askHubToUpdateMe(rootDir, hubUrl, deviceId, snapshotId, callback) {
  //Configure the HTTP request
  const options = {
    uri: hubUrl + "/updateme",
    json: true,
    method: 'GET',
    qs: {
      'deviceId': deviceId,
      'snapshotId': snapshotId
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
      executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, function(err, scriptOutput) {
        //OK update has been executed. Let's see how it worked out.
        if (err) {
          //oh, it failed!
          tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, false, err, callback)
        } else {
          tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, true, scriptOutput, callback)
        }


      })

    } else {
      //Invalid response. Bail out!
      callback(new Error("Unexpected or missing status in response body: " + body))
    }
  })
}

function tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, success, output, callback) {
  const options = {
    uri: hubUrl + "/howitworkedout",
    json: true,
    method: 'POST',
    body: {
      deviceId: deviceId,
      snapshotId: snapshotId,
      success: success,
      output: output
    }
  }

  request(options, callback)
}


//Downloads the given file and calls update.sh.
//If all goes well, the callback called with the output from the script.
//If anything goes wrong, the callback is called with an error.
function executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, callback) {
  //Create/update the device-id file
  const snapshotIdFile = path.join(rootDir, "snapshot-id")
  fs.writeFileSync(snapshotIdFile, snapshotId)

  fs.mkdirSync(path.join(rootDir, 'downloads'))
  const snapshotRoot = path.join(rootDir, 'downloads', snapshotId)
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
        const outputBuffer = child_process.execFileSync(updateScript)

        //TODO catch error?
        callback(null, outputBuffer.toString())
      } else {
        callback(new Error("The zip file didn't contain update.sh!"))
      }
    })

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

exports.update = update


