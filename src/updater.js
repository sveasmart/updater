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
 @param {bool} simulate - if true, I will only pretend to execute local update scripts.
 */
function checkForUpdate(rootDir, hubUrl, simulate, callback) {
  try {
    //Read the deviceId from file
    const deviceIdFile = path.join(rootDir, "device-id")
    const deviceId = fs.readFileSync(deviceIdFile, encoding).toString()

    //Read the snapshotId from file, or use 0 if not found.
    const snapshotIdFile = path.join(rootDir, "snapshot-id")
    var snapshotId = 0
    if (fs.existsSync(snapshotIdFile)) {
      snapshotId = fs.readFileSync(snapshotIdFile, encoding).toString()
    }

    //Go check if an update is needed
    console.log("Checking for update from " + hubUrl + " ... (deviceId = " + deviceId + ", snapshotId = " + snapshotId + ")")
    askHubToUpdateMe(rootDir, hubUrl, deviceId, snapshotId, simulate, callback)
  } catch (err) {
    console.log("Something went synchronously wrong when calling checkForUpdate. Caught the error, will return it in the callback.", err)
    callback(err)
  }

}

function askHubToUpdateMe(rootDir, hubUrl, deviceId, snapshotId, simulate, callback) {
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
      callback(null, body)

    } else if (body.status === "updateNeeded") {
      
      //The hub says we need to update! Get the URL to the file.
      const newSnapshotId = getMandatoryResponseProperty(body, "snapshotId").toString()
      const downloadUrl = getMandatoryResponseProperty(body, "downloadUrl")
      const downloadType = getOptionalResponseProperty(body, "downloadType", "zip").toLowerCase()
      const configParams = getOptionalResponseProperty(body, "config", {})

      console.log("Will update device " + deviceId + " from snapshot " + snapshotId + " to " + newSnapshotId)
      console.log("Config: " + configParams)

      //Execute the update
      try {
        executeUpdate(rootDir, deviceId, newSnapshotId, downloadUrl, downloadType, configParams, simulate, function(err, scriptOutput) {
          //OK the update script has been executed. Let's see how it worked out.
          if (err) {
            console.log("Update failed! ", err)
            //Oh, the update script failed! Let's tell the hub
            tellHubHowItWorkedOut(hubUrl, deviceId, newSnapshotId, false, err.message, callback)
          } else {
            console.log("Update succeeded!", scriptOutput)
            //The update script succeeded! Let's tell the hub.
            tellHubHowItWorkedOut(hubUrl, deviceId, newSnapshotId, true, scriptOutput, callback)
          }
        })
      } catch (err) {
        console.log("Update failed! Threw an error. ", err)
        //Oh, the update script failed! Let's tell the hub
        tellHubHowItWorkedOut(hubUrl, deviceId, newSnapshotId, false, err.message, callback)

      }

    } else {
      //Invalid response from the hub. Bail out!
      console.log("Unexpected or missing status in response body", body)
      callback(new Error("Unexpected or missing status in response body: " + body))
    }
  })
}

function tellHubHowItWorkedOut(hubUrl, deviceId, snapshotId, success, output, callback) {
  if (success) {
    console.log("Telling the hub that the update to " + snapshotId + " succeeded")
  } else {
    console.log("Telling the hub that the update to " + snapshotId + " failed")
  }
  //This is what we'll send to the hub (and to our callback)
  const result = {
    deviceId: deviceId,
    snapshotId: snapshotId,
    success: "" + success,
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
    callback(null, result.body)

  })
}


/*
Downloads the given file, unpacks, and calls update.sh.
If all goes well, the callback is called with the output from the script.
If anything goes wrong, the callback is called with an error.
If simulate == true then I'll just pretend everything worked out, and not run anything.
*/
function executeUpdate(rootDir, deviceId, snapshotId, downloadUrl, downloadType, configParams, simulate, callback) {
  //Create the download folder for this zip file
  const downloadsDir = makeDir(rootDir, 'downloads')
  const snapshotRoot = makeDir(downloadsDir, snapshotId)

  if (downloadType == 'zip') {
    const downloadedFile = path.join(snapshotRoot, 'download.zip')

    //Download the file
    const filePipe = request({uri: downloadUrl}).pipe(fs.createWriteStream(downloadedFile))

    filePipe.on('close', function() {
      //OK now I got my file. Unzip it.
      extract(downloadedFile, {dir: snapshotRoot}, function (err) {
        if (err) return callback(err)

        //OK, we've unzipped the file. Now let's call the update.sh script.
        const updateScript = findUpdateScript(snapshotRoot)

        if (updateScript) {
          executeUpdateScript(rootDir, updateScript, snapshotId, configParams, simulate, callback)
        } else {
          callback(new Error("The zip file didn't contain update.sh!"))
        }
      })
    })

  } else if (downloadType == 'sh') {
    const downloadedFile = path.join(snapshotRoot, 'update.sh')
    const filePipe = request({uri: downloadUrl}).pipe(fs.createWriteStream(downloadedFile))
    filePipe.on('close', function() {
      //OK now I got my file. Execute it.
      executeUpdateScript(rootDir, downloadedFile, snapshotId, configParams, simulate, callback)
    })
  } else if (downloadType == 'js') {
    const downloadedFile = path.join(snapshotRoot, 'update.js')
    const filePipe = request({uri: downloadUrl}).pipe(fs.createWriteStream(downloadedFile))
    filePipe.on('close', function() {
      //OK now I got my file. Execute it.
      executeUpdateScript(rootDir, downloadedFile, snapshotId, configParams, simulate, callback)
    })
  } else {
    callback(new Error("Invalid downloadType: '" + downloadType + "'. Should be 'zip' or 'sh'."))
  }

}

function executeUpdateScript(rootDir, updateScript, snapshotId, configParams, simulate, callback) {
  try {
    child_process.execSync("chmod a+x " + updateScript)

    const configString = JSON.stringify(configParams)

    const cwd = path.resolve(updateScript, "..")
    console.log("Setting cwd to " + cwd)

    const appsRootDir = path.resolve(rootDir, 'apps')

    process.env.apps_root = appsRootDir
    process.env.update_root = cwd
    process.env.config = configString

    let output
    if (simulate) {
      output = "simulate is true, so I'll just \n" +
        "pretend that I executed the " + updateScript + "\n" +
        "and successfully updated to snapshotId " + snapshotId + ".\n" +
        "Here is the environment I received: \n" + JSON.stringify(options.env, null, 2)
    } else if (updateScript.endsWith(".js")) {
      console.log("Executing: node " + updateScript)
      const outputBuffer = child_process.execSync("node " + updateScript)
      output = outputBuffer.toString()

    } else {
      console.log("Executing: " + updateScript)
      options.cwd = cwd
      const outputBuffer = child_process.execFileSync(updateScript)
      output = outputBuffer.toString()
    }

    //Yay, the script succeed!
    //Update the snapshot ID
    const snapshotIdFile = path.join(rootDir, "snapshot-id")
    fs.writeFileSync(snapshotIdFile, snapshotId)

    callback(null, output)

  } catch (err) {
    callback(err)
  }

}

/**
 * Looks for a file named update.sh in this path, or the first subfolder
 */
function findUpdateScript(parent) {
  let updateScript = path.join(parent, "update.sh")
  if (fs.existsSync(updateScript)) {
    return updateScript
  }
  const children = fs.readdirSync(parent)
  for (child of children) {
    const childFullPath = path.join(parent, child)
    if (fs.statSync(childFullPath).isDirectory()) {
      updateScript = path.join(childFullPath, "update.sh")
      if (fs.existsSync(updateScript)) {
        return updateScript
      }
    }
  }
  return null

}

/**
 * Creates the given dir under the given parent.
 * If the dir already exists, does nothing.
 * Returns the full path to the created dir.
 */
function makeDir(parent, dirName) {
  const dirPath = path.join(parent, dirName)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath)
  }
  return dirPath
}

//Gets the given property, or throws error if it doesn't exist.
function getMandatoryResponseProperty(body, propertyName) {
  if (propertyName in body) {
    return body[propertyName]
  } else {
    throw new Error("Can't find property " + propertyName + " in body: " + JSON.stringify(body))
  }
}

//Gets the given property if provided, otherwise returns the given default
function getOptionalResponseProperty(body, propertyName, defaultValue) {
  if (propertyName in body) {
    return body[propertyName]
  } else {
    return defaultValue
  }
}

exports.checkForUpdate = checkForUpdate


