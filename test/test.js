const chai = require('chai')
const assert = chai.assert
const mocha = require("mocha")

const fs = require('fs') //File system interaction
const setup = require('./setup.js') //Contains low-level test setup stuff
const nock = require('nock')

var updater = null

const testUtil = require('./test-util')
const testFixture = require('./test-fixture')

//An in-memory integration test that checks if the updater works, end-to-end.
//Both the file system and http requests are mocked, so everything happens in-memory.
//So no real IO happens.
describe('Updater', function() {

  //=================================================================================
  beforeEach(function() {
    testUtil.initMocks()
    testFixture.initFixture()
    updater = setup.getUpdater()
  })

  //================================================================================
  it('If updaterUrl is invalid, update should fail', function(done) {

    //Call the updated with a non-existent URL
    updater.checkForUpdate("/updatertest", 'http://totally.invalid.url', false, function(err) {
      if (err) {
        done() //Good! The update SHOULD fail!
      } else {
        done(new Error("Hey, the update should have failed!"))
      }
    })
  })

  //================================================================================
  it('If no update was needed, then nothing should happen', function(done) {
    testFixture.setDeviceId("deviceA")
    testFixture.setSnapshotId("1")

    //Call the updater
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Check that no update was exected
      assert.isNotOk(updater.lastExecutedCommand)
      done()
    })
  })

  //================================================================================
  it('If update was needed, it should be downloaded and executed.', function(done) {

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that it created a snapshot-id file
      assert.isOk(fs.existsSync("/updatertest/snapshot-id"))
      const snapshotId = fs.readFileSync("/updatertest/snapshot-id")
      assert.equal(snapshotId, '1')

      //Ensure that the file was downloaded to /updatertest/downloads
      assert.isOk(fs.existsSync("/updatertest/downloads/1/download.zip"))
      assert.isOk(fs.existsSync("/updatertest/downloads/1/update.sh"))

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/1/update.sh")

      done()
    })
  })

  //================================================================================
  it('The update script output should be posted to the hub', function(done) {

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/1/update.sh")

      //Ensure that the result was posted to the hub
      const lastLog = testFixture.getLastLog("deviceA")
      assert.isOk(lastLog)
      assert.equal(lastLog.success, 'true')
      assert.equal(lastLog.output, "update successful!")

      done()
    })
  })

  //================================================================================
  it('The update script output should be posted to the hub, even if the script fails.', function(done) {

    testFixture.shouldNextUpdateScriptSucceed = false
    
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/1/update.sh")

      //Ensure that the result was posted to the hub
      const lastLog = testFixture.getLastLog("deviceA")
      assert.isOk(lastLog)
      assert.equal(lastLog.success, 'false')
      assert.equal(lastLog.output, "update failed!")

      done()
    })
  })

  //================================================================================
  it('If the update script fails, my snapshot-id file should NOT be updated.', function(done) {
    testFixture.setSnapshotId("0")
    assert.equal(testFixture.getSnapshotId(), "0")
    testFixture.shouldNextUpdateScriptSucceed = false

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that snapshot-id is unchanged
      assert.equal(testFixture.getSnapshotId(), "0")

      done()
    })
  })

  //================================================================================
  it('should set environment variable "app_root" when running update scripts', function(done) {

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that the environment variable was set
      assert.isOk(updater.lastExecutedCommandOptions.env)
      assert.equal(updater.lastExecutedCommandOptions.env.apps_root, "/updatertest/apps")
      done()
    })
  })

  //================================================================================
  it('should set the correct working directory when running update scripts', function(done) {

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that the environment variable was set
      assert.isOk(updater.lastExecutedCommandOptions.cwd)
      assert.equal(updater.lastExecutedCommandOptions.cwd, "/updatertest/downloads/1")
      done()
    })
  })

  //================================================================================
  it('should fail update if the downloaded ZIP doesnt contain update.sh', function(done) {
    testFixture.setDeviceId("deviceC") //This one has a ZIP file with no update.sh inside!
    testFixture.setSnapshotId(1)

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err, result) {
      if (err) {
        //Yeah, it might seem like it SHOULD get an error here. But actually, no.
        //As long as the updated managed to notify the hub about the result,
        //then technically the update was complete.
        done(err)
        return
      }

      //BUT - no new snapshot should have been generated.
      assert.equal(testFixture.getSnapshotId(), 1)
      //And the updater should have reported a failure to the hub.
      const lastLog = testFixture.getLastLog("deviceC")
      assert.equal(lastLog.success, 'false')
      done()
    })
  })

  //================================================================================
  it('If update.sh is under a subdirectory in the ZIP, it should still be found.', function(done) {
    testFixture.setDeviceId("deviceD")
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/5/stuff/update.sh")

      done()
    })
  })

  //================================================================================
  it('can download an .sh file directly.', function(done) {
    testFixture.setDeviceId("deviceE")
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/7/update.sh")

      done()
    })
  })

  //================================================================================
  it('can execute a js file', function(done) {
    testFixture.setDeviceId("deviceF")
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that update.js was executed
      assert.equal(updater.lastExecutedCommand, "node /updatertest/downloads/8/update.js")

      done()
    })
  })
  
  //================================================================================
  it('can receive a nested config', function(done) {
    testFixture.setDeviceId("deviceF")
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', false, function(err) {
      if (err) return done(err)

      //Ensure that update.js was executed
      assert.equal(updater.lastExecutedCommand, "node /updatertest/downloads/8/update.js")
      const configString = updater.lastExecutedCommandOptions.env.config
      const config = JSON.parse(configString)

      assert.equal(config.app1.color, "red")
      done()
    })
  })



})
