const request = require('request')
const fs = require("fs")
const path = require('path')
const child_process = require('child_process')
const extract = require('extract-zip')

const encoding = 'utf8'

/*
Contacts the given hub and checks if an update is needed.
Uses the given rootDir to check device-id and snapshot-id.
If the hub says an update is needed, then I'll download the update,
unzip it, and execute update.sh.
I'll pass in the environment variable 'app_root' so the script knows where to put stuff.
And finally, I'll contact the hub again to notify how it went (including output logs).

See the update protocol for details:
 https://github.com/sveasmart/updater-protocol
 
If an update was needed, and the updater managed to download the update script and execute it,
then it will return something like through the callback:

{
 deviceId: 'deviceA',
 snapshotId: '22',
 success: true,
 output: 'installing widget version 2.0.3... done!'
 }
 
 Same thing if the update script was executed but failed. 

 @param {string} rootDir - the root dir that contains (or will contain) device-id, snapshot-id, apps, and downloads. For example "/home"
 @param {string} hubUrl - the base url of the updater hub. For example http://hub.updater.eu. No trailing slash.
*/
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
  
  //Go check if an update is needed
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
      //The hub says we need to update! Get the URL to the file.
      const snapshotId = getMandatoryResponseProperty(body, "snapshotId")
      const downloadUrl = getMandatoryResponseProperty(body, "downloadUrl")
      
      //Execute the update
      executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, function(err, scriptOutput) {
        //OK the update script has been executed. Let's see how it worked out.
        if (err) {
          //Oh, the update script failed! Let's tell the hub
          tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, false, err.message, callback)
        } else {
          //The update script succeeded! Let's tell the hub.
          tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, true, scriptOutput, callback)
        }
      })

    } else {
      //Invalid response from the hub. Bail out!
      callback(new Error("Unexpected or missing status in response body: " + body))
    }
  })
}

function tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, success, output, callback) {
  //This is what we'll send to the hub (and to our callback)
  const result = {
    deviceId: deviceId,
    snapshotId: snapshotId,
    success: success,
    output: output
  }

  const options = {
    uri: hubUrl + "/howitworkedout",
    json: true,
    method: 'POST',
    body: result
  }

  request(options, function(err, result) {
    if (err) return callback(err)
    callback(null, result)
  })
}


/*
Downloads the given file, unpacks, and calls update.sh.
If all goes well, the callback is called with the output from the script.
If anything goes wrong, the callback is called with an error.
*/
function executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, callback) {
  //Create the download folder for this zip file
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

      //OK, we've unzipped the file. Now let's call the update.sh script.
      const updateScript = snapshotRoot + "/update.sh"

      if (fs.existsSync(updateScript)) {
        try {
          const outputBuffer = child_process.execFileSync(updateScript)

          //Yay, the script succeed!
          //Update the snapshot ID
          const snapshotIdFile = path.join(rootDir, "snapshot-id")
          fs.writeFileSync(snapshotIdFile, snapshotId)

          callback(null, outputBuffer.toString())

        } catch (err) {
          callback(err)
        }

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


