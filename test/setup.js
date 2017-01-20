//Contains all the icky test setup stuff,
//so that test.js can focus on the business logic

const chai = require('chai')
const assert = chai.assert

const testFixture = require("./test-fixture")

/*
  getUpdater() returns an updater with mocked child_process.
 When the updater tries to run a script (via child_process.execFileSync,
 the mock intercepts it and instead just sets updater.lastExecutedFile
 Also sets updater.lastExecutedFileOptions
 See https://nodejs.org/api/child_process.html#child_process_child_process_execfilesync_file_args_options
 */
function getUpdater() {
  const mockery = require('mockery')
  mockery.registerMock('child_process')

  var updater = null
  const childProcessMock = {
    execFileSync: function(path, args, options) {
      updater.lastExecutedFile = path
      updater.lastExecutedFileOptions = options

      if (testFixture.shouldNextUpdateScriptSucceed) {
        return "update successful!"
      } else {
        throw new Error("update failed!")
      }
    }
  }

  mockery.registerMock('child_process', childProcessMock)

  mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
  });

  updater = require("../src/updater.js")
  updater.lastExecutedFile = null
  updater.lastExecutedFileOptions = null

  mockery.disable()

  return updater
}

exports.getUpdater = getUpdater