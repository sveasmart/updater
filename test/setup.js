//Contains all the icky test setup stuff,
//so that updater-test.js can focus on the business logic

const chai = require('chai')
const assert = chai.assert

const testFixture = require("./test-fixture")
const testUtil = require('./test-util')

var updater = null

/*
  getUpdater() returns an updater with mocked child_process.
 When the updater tries to run a script (via child_process.execFileSync,
 the mock intercepts it and instead just sets updater.lastExecutedFile
 Also sets updater.lastExecutedFileOptions
 See https://nodejs.org/api/child_process.html#child_process_child_process_execfilesync_file_args_options
 */
function getUpdater(extraConfigParams) {
  const mockery = require('mockery')
  mockery.registerMock('child_process')


  const childProcessMock = {
    execSync: function(command, options) {
      console.log("execSync", command)
      if (command.startsWith("chmod")) {
        //Ignore chmod
        return
      }

      updater.lastExecutedCommand = command
      updater.lastExecutedCommandOptions = options

      if (testFixture.shouldNextUpdateScriptSucceed) {
        return "update successful!"
      } else {
        throw new Error("update failed!")
      }
    },

    execFileSync: function(path, args, options) {
      console.log("execFileSync", path)
      updater.lastExecutedCommand = path
      updater.lastExecutedCommandOptions = options

      if (testFixture.shouldNextUpdateScriptSucceed) {
        return "update successful!"
      } else {
        throw new Error("update failed!")
      }
    },

    exec: function(path, args, options) {
      console.log("exec", path)
      updater.lastExecutedCommand = path
      updater.lastExecutedCommandOptions = options
    }
  }



  mockery.registerMock('child_process', childProcessMock)

  mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
  });

  const Updater = require("../src/updater.js")
  
  const config = {
    updateScriptTimeoutSeconds: 1,
    sshTunnelCommand: "echo 'No sshTunnelCommand configured'",
    onUpdating: function(updating) {
      if (updating) {
        updater.onUpdatingWasCalledWithTrue = true
      } else {
        updater.onUpdatingWasCalledWithFalse = true
      }
    }
  }
  
  if (extraConfigParams && extraConfigParams.scriptToCallWhenDeviceIdHasBeenSet) {
    config.scriptToCallWhenDeviceIdHasBeenSet = extraConfigParams.scriptToCallWhenDeviceIdHasBeenSet
  }
  
  updater = new Updater(testUtil.updaterRootDir, 'http://fakeupdater.com', config)
  updater.lastExecutedFile = null
  updater.lastExecutedFileOptions = null



  mockery.disable()

  return updater
}

exports.getUpdater = getUpdater