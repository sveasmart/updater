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
    updater.checkForUpdate("/updatertest", 'http://totally.invalid.url', function(err) {
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
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', function(err) {
      if (err) return done(err)

      //Check that no update was exected
      assert.isNotOk(updater.lastExecutedFile)
      done()
    })
  })

  //================================================================================
  it('If update was needed, it should be downloaded and executed.', function(done) {

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', function(err) {
      if (err) return done(err)

      //Ensure that it created a snapshot-id file
      assert.isOk(fs.existsSync("/updatertest/snapshot-id"))
      const snapshotId = fs.readFileSync("/updatertest/snapshot-id")
      assert.equal(snapshotId, '1')

      //Ensure that the file was downloaded to /updatertest/downloads
      assert.isOk(fs.existsSync("/updatertest/downloads/1/download.zip"))
      assert.isOk(fs.existsSync("/updatertest/downloads/1/update.sh"))

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedFile, "/updatertest/downloads/1/update.sh")

      done()
    })
  })

  //================================================================================
  it('The update script output should be posted to the hub', function(done) {

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', function(err) {
      if (err) return done(err)

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedFile, "/updatertest/downloads/1/update.sh")

      //Ensure that the result was posted to the hub
      const lastLog = testFixture.getLastLog("deviceA")
      assert.isOk(lastLog)
      assert.equal(lastLog.success, true)
      assert.equal(lastLog.output, "update successful!")

      done()
    })
  })

  //================================================================================
  it('The update script output should be posted to the hub, even if the script fails.', function(done) {

    testFixture.shouldNextUpdateScriptSucceed = false
    
    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', function(err) {
      if (err) return done(err)

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedFile, "/updatertest/downloads/1/update.sh")

      //Ensure that the result was posted to the hub
      const lastLog = testFixture.getLastLog("deviceA")
      assert.isOk(lastLog)
      assert.equal(lastLog.success, false)
      assert.equal(lastLog.output, "update failed!")

      done()
    })
  })

  //================================================================================
  it('If the update script fails, my snapshot-id file should NOT be updated.', function(done) {
    testFixture.setSnapshotId("0")
    assert.equal(testFixture.getSnapshotId(), "0")
    testFixture.shouldNextUpdateScriptSucceed = false

    updater.checkForUpdate("/updatertest", 'http://fakeupdater.com', function(err) {
      if (err) return done(err)

      //Ensure that snapshot-id is unchanged
      assert.equal(testFixture.getSnapshotId(), "0")

      done()
    })
  })

})
