const requestPromise = require('request-promise-native')
const request = require('request')
const fs = require("fs")
const path = require('path')
const child_process = require('child_process')

const util = require('./util')

const encoding = 'utf8'

class Updater {

  constructor(rootDir, hubUrl, 
    {
      updateRequestTimeoutSeconds = 10, 
      updateScriptTimeoutSeconds = 1800, 
      simulate = false,
      onUpdating, //called when we start or stop the process of downloading and executing an update. true = starting, false = ended (whether successful or not).
    }
  ) {
    console.assert(arguments.length == 2 || arguments.length == 3, "I expected 2 or 3 arguments. Not " + arguments.length + ". ")

    console.assert(rootDir, "missing rootDir")
    console.assert(rootDir, "missing hubUrl")


    this.rootDir = rootDir
    this.hubUrl = hubUrl
    this.updateRequestTimeoutSeconds = updateRequestTimeoutSeconds
    this.updateScriptTimeoutSeconds = updateScriptTimeoutSeconds
    this.simulate = simulate
    this.updaterVersion = util.getMyVersionNumber()
    this.onUpdating = onUpdating
    console.log("this.onUpdating", this.onUpdating)
  }

  /*
   Contacts the given hub and checks if an update is needed.
   Reads device-id and snapshot-id (relative to rootDir)
   If the hub says an update is needed, then I'll download the update and execute it.
   I'll pass in the environment variable 'app_root' so the script knows where to put stuff.
   And finally, I'll contact the hub again to notify how it went (including output logs).
  
   See the update protocol for details:
   https://github.com/sveasmart/updater-protocol

   Returns a promise, which resolves to an object like this.
   {
   deviceId: 'deviceA',
   snapshotId: '22',  //whatever snapshotId we ended up at (or stayed at)
   output: 'updating... done!' //whatever the update script outputed (if a script was executed)
   updated: false,    //true if an update was needed and executed, false if update wasn't needed
   newUpdateInterval: 30   //if given by the hub
   }

   The promise will resolve successfully if no update was needed, or if the update script was successfully executed.
   The promise will fail if an update script was needed and couldn't be executed, or if the /updateme call to the hub failed.
   The error will contain:
   error.networkError = true if the problem was network-related
   error.updateError = true if the problem happened during script execution


   If I fail to notify the updater hub about the result, that failure will be logged and swallowed.
   So failure in calling /howitworkedout will not be visible outside this method.

  */
  checkForUpdateAndTellHubHowItWorkedOut() {
    //Call /updateme
    return this._callUpdateMe()

      .then((updateMeResponse) => {
        console.log("got updateMe response: ", updateMeResponse)
        //Got response from /updateme
        return this._handleUpdateMeResponse(updateMeResponse)
      })

      //TEMP - the below useful for when tests break and we want to see what's really going on.
      //Comment out in production to avoid the extra logging, since the caller of checkForUpdateAndTellHubHowItWorkedOut
      //should be responsible for handling uncaught errors anyway.
      /*
      .catch((err) => {
        console.log("uncaught error intercepted by checkForUpdateAndTellHubHowItWorkedOut", err)
        throw err
      })
      */


  }

  _handleUpdateMeResponse(updateMeResponse) {
    const returnObject = {
      deviceId: this._readDeviceId()
    }

    if (updateMeResponse.updateInterval) {
      //Hub wants me to change updateInterval.
      //Make note of that in the return object.
      returnObject.newUpdateInterval = updateMeResponse.updateInterval
    }

    //Now let's execute the update (if needed)
    return this._executeUpdateIfNeeded(updateMeResponse)

      .then((scriptOutput) => {
        if (scriptOutput == null) {

          //No update was needed. Fine.
          //Make note that we are still at the same snapshot ID as before
          returnObject.snapshotId = this._readSnapshotId()
          returnObject.updated = false
          return returnObject

        } else {
          //An update was successfully executed!
          //Store the script output and new snapshotId in the return object
          const newSnapshotId = this._readSnapshotId()
          returnObject.snapshotId = newSnapshotId
          returnObject.output = scriptOutput
          returnObject.updated = true

          //Let's trigger a call to /howitworkedout, so the hub finds out about the success
          return this._tellHubHowItWorkedOut(newSnapshotId, true, scriptOutput)
            .then(() => {
              //OK, we've notified the hub about our successful update.
              //We're done!
              return returnObject
            })
            .catch((errorTellingHubHowItWorkedOut) => {
              //Oh, we couldn't tell the hub about our successful update.
              //But we don't really care, so let's swallow that.
              console.log("Update succeeded, but we failed when calling /howitworkedout. Ignoring the problem. ", errorTellingHubHowItWorkedOut)
              return returnObject
            })
        }

      }).catch((updateError) => {
        //Darn. An update was needed, and we failed to execute it.
        //For example, couldn't download the update file, or the script execution
        //threw an error.
        console.log("Update failed! " +  updateError.message, updateError)

        //Let's capture the output from the script execution
        let scriptOutput = ""
        if (updateError.stdout) {
          scriptOutput = scriptOutput + updateError.stdout.toString()
        }
        scriptOutput = scriptOutput + updateError.toString()

        //Then let's trigger a call to /howitworkedout, so the hub finds out about the failure
        const newSnapshotId = updateError.newSnapshotId
        let succeededInTellingHubAboutTheFailure = false
        return this._tellHubHowItWorkedOut(newSnapshotId, false, scriptOutput)
          .then(() => {
            //OK we notified the hub about the update failure,
            //so now let's throw it.
            succeededInTellingHubAboutTheFailure = true
            throw updateError
          })
          .catch((error) => {
            //OK now we're not sure if this error is the updateError being rethrown above,
            //or if it's actually a new error from telling the hub how it worked out.
            //Not that we care much, but we do want the logs to explain what's going on.
            //So we use this little boolean to distinguish between the two cases.
            if (succeededInTellingHubAboutTheFailure) {
              console.log("I successfully told the hub about the failed udpate")
            } else {
              //Oh, we couldn't tell the hub about the failed update!
              console.log("Update failed AND I failed to notify the hub about the problem", error)
            }

            //The important thing here is the original update error,
            //not the failure to notify the hub afterwards.
            //So we always want to rethrow the original update error.
            throw updateError

          })
      })
  }


  /**
   * Returns a promise that calls /updateme
   * and resolves with the response json.
   * If an error happens, the error will be tagged with networkError = true
   */
  _callUpdateMe() {
    //Read the deviceId from file
    const deviceId = this._readDeviceId()

    //Read the snapshotId from file, or use 0 if not found.
    const snapshotId = this._readSnapshotId()

    console.log("Checking for update from " + this.hubUrl + " ... (deviceId = " + deviceId + ", snapshotId = " + snapshotId + ", updaterVersion = " + this.updaterVersion + ")")

    //Configure the HTTP request
    const options = {
      uri: this.hubUrl + "/updateme",
      json: true,
      method: 'GET',
      qs: {
        'deviceId': deviceId,
        'snapshotId': snapshotId,
        'updaterVersion' : this.updaterVersion
      },
      timeout: this.updateRequestTimeoutSeconds * 1000
    }

    return requestPromise(options)
      .catch((err) => {
        err.networkError = true
        throw err
      })
  }


  /**
   * Returns a promise that checks the given updateMeResponse
   * and, if an update was needed, downloads the update script and executes it.
   *
   * If an update wasn't needed, the promise resolves with null.
   *
   * If an update was needed, and downloaded and executed successfully,
   * the promise resolves with the output from the script execution.
   *
   * If an update was needed, and failed (because it couldn't be downloaded, or because the script failed)
   * then the promise will be rejected.
   * The error message will contain:
   * error.stdout = the output from the script (if it got executed)
   * error.newSnapshotId = the snapshotId it was trying to update to
   */
  _executeUpdateIfNeeded(updateMeResponse) {
    if (updateMeResponse.status === "noUpdateNeeded") {
      //Nothing to update. We are done!
      return Promise.resolve(null)

    } else if (updateMeResponse.status === "updateNeeded") {
      //The hub says we need to update! Get the URL to the file.
      const newSnapshotId = util.getMandatoryProperty(updateMeResponse, "snapshotId")
      const downloadUrl = util.getMandatoryProperty(updateMeResponse, "downloadUrl")
      const downloadType = util.getOptionalProperty(updateMeResponse, "downloadType", "zip").toLowerCase()
      const configParams = util.getOptionalProperty(updateMeResponse, "config", {})

      console.log("Will update device " + this._readDeviceId() + " from snapshot " + this._readSnapshotId() + " to " + newSnapshotId + ", using downloadUrl " + downloadUrl)
      console.log("Config: ", configParams)

      this._notifyOnUpdating(true)
      return this._executeUpdate(newSnapshotId, downloadUrl, downloadType, configParams)
        .then((scriptOutput) => {
          this._notifyOnUpdating(false)
          return scriptOutput
        })
        .catch((err) => {
          this._notifyOnUpdating(false)
          err.newSnapshotId = newSnapshotId
          throw err
        })
    }
  }

  _notifyOnUpdating(updating) {
    if (this.onUpdating) {
      this.onUpdating(updating)
    }
  }


  /**
   * Returns a promise that downloads the given file and executes the update script inside it.
   *
   * If the script was downloaded and executed successfully,
   * the promise resolves with the output from the script execution.
   *
   * If the update failed (because it couldn't be downloaded, or because the script failed)
   * then the promise will be rejected. If the script was downloaded but failed on execution,
   * then the error object will contain error.stdout = the output from execution
   *
   * If simulate == true then I'll just pretend everything worked out, and not run anything.
   */
  _executeUpdate(newSnapshotId, downloadUrl, downloadType, configParams) {
    if (downloadType == 'zip') {
      return this._downloadAndExecuteZipUpdate(newSnapshotId, downloadUrl, configParams)
  
    } else if (downloadType == 'sh') {
      return this._downloadAndExecuteShUpdate(newSnapshotId, downloadUrl, configParams)

    } else if (downloadType == 'js') {
      return this._downloadAndExecuteJsUpdate(newSnapshotId, downloadUrl, configParams)

    } else {
      throw new Error("Invalid downloadType: '" + downloadType + "'. Should be 'zip' or 'sh' or 'js'.")
    }
  }

  /**
   * Returns a promise that downloads and executes the update script in the zip file at the
   * given downloadUrl.
   * Returns the output from the script.
   */
  _downloadAndExecuteZipUpdate(newSnapshotId, downloadUrl, configParams) {
    const zipFile = this._getDownloadedFilePath(newSnapshotId, 'download.zip')
    const zipParent = path.join(zipFile, "..")

    //Download the ZIP file...
    return util.downloadFile(downloadUrl, zipFile)
      .then(() => {
        //OK I got the file!
        //Unzip it.
        return util.unzipFile(zipFile)
      })
      .then(() => {
        //OK, we've unzipped the file!
        //Now let's call the update.sh script.
        const updateScript = util.findFileInPath(zipParent, 'update.sh')
        if (updateScript) {
          console.log("Here's what I see in " + zipParent + " after unzipping:")
          console.log(fs.readdirSync(zipParent).join(","))
          return this._executeUpdateScript(updateScript, newSnapshotId, configParams)
        } else {
          console.log("The zip file didn't contain update.sh! Here's what I see after unzipping: ")
          console.log(fs.readdirSync(zipParent).join(","))
          throw new Error("The zip file didn't contain update.sh!")
        }
      })
  }

  /**
   * Returns a promise that downloads and executes the update script (.sh) at the given downloadUrl
   * Returns the output from the script.
   */
  _downloadAndExecuteShUpdate(newSnapshotId, downloadUrl, configParams) {
    const shFile = this._getDownloadedFilePath(newSnapshotId, 'update.sh')

    //Download the .sh file
    return util.downloadFile(downloadUrl, shFile)
      .then(() => {
        //OK I got the file! Execute it.
        return this._executeUpdateScript(shFile, newSnapshotId, configParams)
      })
  }

  /**
   * Returns a promise that downloads and executes the update script (.js) at the given downloadUrl
   * Returns the output from the script.
   */
  _downloadAndExecuteJsUpdate(newSnapshotId, downloadUrl, configParams) {
    const jsFile = this._getDownloadedFilePath(newSnapshotId, 'update.js')

    //Download the .sh file
    return util.downloadFile(downloadUrl, jsFile)
      .then(() => {
        //OK I got the file! Execute it.
        return this._executeUpdateScript(jsFile, newSnapshotId, configParams)
      })
  }

  /**
   * Executes the given update script synchronously.
   * If the file is a .sh, it will execute it using shell
   * If the file is a .js, it will execute it using node.
   * If successful, updates the 'snapshot-id' file.
   *
   * Note that if this.simulate is true, then we will only pretend to execute the file.
   *
   * @param updateScriptFile the path to the .sh or .js file to be executed
   * @param snapshotId the snapshotId to write in 'snapshot-id' if this succeeds.
   * @param configParams config params to send to the update script via the 'config' environment variable
   * @returns the output from the script
   */
  _executeUpdateScript(updateScriptFile, snapshotId, configParams) {
    //Make sure we have execution rights
    child_process.execSync("chmod a+x " + updateScriptFile)

    const cwd = path.resolve(updateScriptFile, "..")
    console.log("Setting cwd to " + cwd)
    const options = {
      'cwd': cwd,
      'timeout': this.updateScriptTimeoutSeconds * 1000
    }

    const appsRootDir = path.resolve(this.rootDir, 'apps')

    process.env.apps_root = appsRootDir
    process.env.update_root = cwd
    process.env.config = JSON.stringify(configParams)

    let output
    if (this.simulate) {
      output = "simulate is true, so I'll just \n" +
        "pretend that I executed the " + updateScriptFile + "\n" +
        "and successfully updated to snapshotId " + snapshotId + "."

    } else if (updateScriptFile.endsWith(".js")) {
      console.log("Executing: node " + updateScriptFile + " (timeout = " + this.updateScriptTimeoutSeconds + " seconds)")
      const outputBuffer = child_process.execSync("node " + updateScriptFile, options)
      output = outputBuffer.toString()
      console.log("Got output: ", output)

    } else {
      console.log("Executing: " + updateScriptFile + " (timeout = " + this.updateScriptTimeoutSeconds + " seconds)")
      const outputBuffer = child_process.execFileSync(updateScriptFile, {}, options)
      output = outputBuffer.toString()
      console.log("Got output: ", output)
    }

    //Yay, the script succeed!
    //Update the snapshot ID
    this._saveSnapshotId(snapshotId)

    return output
  }

  /**
   * Returns a promise that connects to the Hub and calls /howitworkedout.
   * @param snapshotId the snapshot update that was executed
   * @param success true if the update was successful, false if not
   * @param output the console output from the update script execution
   */
  _tellHubHowItWorkedOut(snapshotId, success, output) {
    if (success) {
      console.log("Telling the hub that the update to " + snapshotId + " succeeded")
    } else {
      console.log("Telling the hub that the update to " + snapshotId + " failed")
    }
    //This is what we'll send to the hub
    const result = {
      deviceId: this._readDeviceId(),
      snapshotId: snapshotId,
      success: "" + success,
      output: output
    }

    const options = {
      uri: this.hubUrl + "/howitworkedout",
      json: true,
      method: 'POST',
      body: result
    }

    console.log("calling requestPromise for _tellHubHowItWorkedOut")
    return requestPromise(options)
      //TEMP
      .then(() => {
        console.log("requestPromise for _tellHubHowItWorkedOut succeeded")
      })
      //TEMP
      .catch((err) => {
        console.log("requestPromise for _tellHubHowItWorkedOut failed. Will rethrow.", err)
        throw err
      })
  }

  /**
   * Returns the download directory for the given snapshotId.
   * Creates the dir if necessary.
   */
  _getSnapshotRoot(snapshotId) {
    const downloadsDir = util.makeDir(this.rootDir, 'downloads')
    return util.makeDir(downloadsDir, snapshotId)
  }

  _getDownloadedFilePath(snapshotId, fileName) {
    const snapshotRoot = this._getSnapshotRoot(snapshotId)
    return path.resolve(path.join(snapshotRoot, fileName))
  }

  _saveSnapshotId(snapshotId) {
    const snapshotIdFile = path.join(this.rootDir, "snapshot-id")
    fs.writeFileSync(snapshotIdFile, snapshotId)
  }

  _readDeviceId() {
    const deviceIdFile = path.join(this.rootDir, "device-id")
    return fs.readFileSync(deviceIdFile, encoding).toString()
  }

  /**
   * Reads the snapshotId from the 'snapshot-id' file.
   * Returns the snapshotId if found.
   * If not found, or non-numeric, then returns 0
   */
  _readSnapshotId() {
    const snapshotIdFile = path.join(this.rootDir, "snapshot-id")
    if (fs.existsSync(snapshotIdFile)) {
      const content = fs.readFileSync(snapshotIdFile, encoding)
      const snapshotId = parseInt(content)
      if (isNaN(snapshotId)) {
        console.log("Strange. snapshot-id file contains non-numeric value, so I'll use 0: ", content)
        return 0
      } else {
        return snapshotId
      }
    } else {
      return 0
    }
  }
}

module.exports = Updater


