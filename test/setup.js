//Contains all the icky test setup stuff,
//so that test.js can focus on the business logic



// getUpdater() returns an updater with mocked child_process.
// When the updater tries to run a script (via child_process.execFileSync,
// the mock intercepts it and instead just sets
// updater.lastExecutedFile
function getUpdater() {
  const mockery = require('mockery')
  mockery.registerMock('child_process')

  var updater = null

  const childProcessMock = {
    execFileSync: function(path) {
      updater.lastExecutedFile = path
    }
  }

  mockery.registerMock('child_process', childProcessMock)

  mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false
  });

  updater = require("../src/updater.js")
  updater.lastExecutedFile = null

  mockery.disable()

  return updater
}

exports.getUpdater = getUpdater