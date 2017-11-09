var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

var Promise = require('promise')

chai.use(chaiAsPromised);
chai.should();

const assert = chai.assert
const expect = chai.expect
const mocha = require("mocha")

chai.should()

chai.config.includeStack = false
chai.config.showDiff = true

const fs = require('fs') //File system interaction
const setup = require('./setup.js') //Contains low-level test setup stuff
const nock = require('nock')

var updater = null
var checkForUpdateAndTellHubHowItWorkedOut = null

const testUtil = require('./test-util')
const testFixture = require('./test-fixture')
const util = require('../src/util')


//An in-memory integration test that checks if the updater works, end-to-end.
//Both the file system and http requests are mocked, so everything happens in-memory.
//So no real IO happens.
describe('Updater', function() {

  //=================================================================================
  beforeEach(function() {
    testUtil.initMocks()
    testFixture.initFixture()
    testFixture.shouldNextUpdateScriptSucceed = true  //TODO not sure why I couldn't do this inside initFixture, but it didn't work for some reason

    updater = setup.getUpdater()

  })

  //================================================================================
  it('If updaterUrl is invalid, update should fail', function() {
    updater.hubUrl = 'http://totally.invalid.url'

    return updater.checkForUpdateAndTellHubHowItWorkedOut().should.be.rejected
  })

  //================================================================================
  it('If no update was needed, then nothing should happen', function() {
    testFixture.setDeviceId("deviceA")
    testFixture.setSnapshotId("1")

    //Call the updater
    return updater.checkForUpdateAndTellHubHowItWorkedOut().should.eventually.deep.equal(
      {
        deviceId: "deviceA",
        snapshotId: 1,
        updated: false
      }
    )
  })

  //================================================================================
  it('If update was needed, it should be downloaded and executed.', function() {


    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      //Ensure that it created a snapshot-id file
      assert.isOk(fs.existsSync("/updatertest/snapshot-id"))
      const snapshotId = fs.readFileSync("/updatertest/snapshot-id")
      assert.equal(snapshotId, '1')

      //Ensure that the file was downloaded to /updatertest/downloads
      assert.isOk(fs.existsSync("/updatertest/downloads/1/download.zip"))
      assert.isOk(fs.existsSync("/updatertest/downloads/1/update.sh"))

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/1/update.sh")

    }).catch((err) => {
      console.log("failed", err)
    })

  })

  //================================================================================
  it('The update script output should be posted to the hub', function() {

    return updater.checkForUpdateAndTellHubHowItWorkedOut().then( function() {
      expect(testFixture.getLastLog("deviceA")).to.deep.equal({
        deviceId: "deviceA",
        output: "update successful!",
        snapshotId: 1,
        success: "true"
      })
    })

  })

  //================================================================================
  it('The update script output should be posted to the hub, even if the script fails.', function() {

    testFixture.shouldNextUpdateScriptSucceed = false


    return updater.checkForUpdateAndTellHubHowItWorkedOut().should.eventually.be.rejected.then( function() {
      expect(testFixture.getLastLog("deviceA")).to.deep.equal({
        deviceId: "deviceA",
        output: "Error: update failed!",
        snapshotId: 1,
        success: "false"
      })
    })

  })
  //================================================================================
  it('If the update script fails, my snapshot-id file should NOT be updated.', function() {
    testFixture.setSnapshotId("0")
    testFixture.shouldNextUpdateScriptSucceed = false

    return updater.checkForUpdateAndTellHubHowItWorkedOut().should.be.rejected.then( function() {
      //Ensure that snapshot-id is unchanged
      assert.equal(testFixture.getSnapshotId(), "0")
    })
  })

  //================================================================================
  it('should set environment variable "app_root" when running update scripts', function() {
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      //Ensure that the environment variable was set
      assert.isOk(process.env)
      assert.equal(process.env.apps_root, "/updatertest/apps")
    })
  })

  //================================================================================
  it('should set the correct working directory when running update scripts', function() {
    console.log("==========================")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then( function() {
      //Ensure that the environment variable was set
      console.log("Y updater.lastExecutedCommandOptions", updater.lastExecutedCommandOptions)
      assert.isOk(updater.lastExecutedCommandOptions.cwd)
      assert.equal(updater.lastExecutedCommandOptions.cwd, "/updatertest/downloads/1")
    })
  })

  //================================================================================
  it('should fail update if the downloaded ZIP doesnt contain update.sh', function() {
    testFixture.setDeviceId("deviceC") //This one has a ZIP file with no update.sh inside!
    testFixture.setSnapshotId(1)

    return updater.checkForUpdateAndTellHubHowItWorkedOut().should.be.rejected.then(function() {
      //No new snapshot should have been generated.
      assert.equal(testFixture.getSnapshotId(), 1)
      //And the updater should have reported a failure to the hub.
      expect(testFixture.getLastLog("deviceC")).to.deep.equal({
        deviceId: "deviceC",
        output: "Error: The zip file didn't contain update.sh!",
        snapshotId: 2,
        success: "false"
      })
    })
  })

  //================================================================================
  it('If update.sh is under a subdirectory in the ZIP, it should still be found.', function() {
    testFixture.setDeviceId("deviceD")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/5/stuff/update.sh")
    })
  })

  //================================================================================
  it('can download an .sh file directly.', function() {
    testFixture.setDeviceId("deviceE")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/7/update.sh")
    })
  })

  //================================================================================
  it('can execute a js file', function() {
    testFixture.setDeviceId("deviceF")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      //Ensure that update.js was executed
      assert.equal(updater.lastExecutedCommand, "node /updatertest/downloads/8/update.js")
    })
  })
  
  //================================================================================
  it('can receive a nested config', function() {
    testFixture.setDeviceId("deviceF")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function(err) {

      //Ensure that update.js was executed
      assert.equal(updater.lastExecutedCommand, "node /updatertest/downloads/8/update.js")
      const configString = process.env.config
      const config = JSON.parse(configString)

      assert.equal(config.app1.color, "red")
    })
  })

  //================================================================================
  it('can receive an updateInterval change', function() {
    testFixture.setDeviceId("deviceG")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().should.become(
      { 
        deviceId: "deviceG",
        snapshotId: 30,
        newUpdateInterval: 120,
        output: "update successful!",
        updated: true
      }
    )
  })  
  
  it('can see version number from path', function() {
    assert.equal(util.getVersionNumberFromPath("/bla/yeah/updater-1.0.5"), "v1.0.5")
  })
  
  it('doesnt receive onUpdating event unless an update actually happened', function() {
    //Set it up so that no update is needed
    testFixture.setDeviceId("deviceA")
    testFixture.setSnapshotId("1")

    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      expect(updater.onUpdatingWasCalledWithTrue).to.not.be.true
      expect(updater.onUpdatingWasCalledWithFalse).to.not.be.true
    })
  })

  it('Receives onUpdating event when an update was done', function() {
    //Set it up so an update is needed
    testFixture.setDeviceId("deviceA")
    testFixture.setSnapshotId("0")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      expect(updater.onUpdatingWasCalledWithTrue).to.be.true
      expect(updater.onUpdatingWasCalledWithFalse).to.be.true
    })
  })

  //================================================================================
  it('Handles sshTunnelRequested: true', function() {
    testFixture.setDeviceId("deviceH")
    testFixture.setSnapshotId("1")
    return updater.checkForUpdateAndTellHubHowItWorkedOut().then(function() {
      //Ensure that update.js was executed
      assert.equal(updater.lastExecutedCommand, "echo 'No sshTunnelCommand configured'")
    })
  })

})
