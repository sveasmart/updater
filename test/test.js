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

    checkForUpdateAndTellHubHowItWorkedOut = Promise.denodeify(updater.checkForUpdateAndTellHubHowItWorkedOut)
  })

  //================================================================================
  it('If updaterUrl is invalid, update should fail', function() {

    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://totally.invalid.url', 1, false).should.be.rejected
  })

  //================================================================================
  it('If no update was needed, then nothing should happen', function() {
    testFixture.setDeviceId("deviceA")
    testFixture.setSnapshotId("1")

    //Call the updater
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).should.become(
      {
        deviceId: "deviceA",
        snapshotId: "1",
        updated: false
      }
    )
  })

  //================================================================================
  it('If update was needed, it should be downloaded and executed.', function() {


    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then(function() {
      //Ensure that it created a snapshot-id file
      assert.isOk(fs.existsSync("/updatertest/snapshot-id"))
      const snapshotId = fs.readFileSync("/updatertest/snapshot-id")
      assert.equal(snapshotId, '1')

      //Ensure that the file was downloaded to /updatertest/downloads
      assert.isOk(fs.existsSync("/updatertest/downloads/1/download.zip"))
      assert.isOk(fs.existsSync("/updatertest/downloads/1/update.sh"))

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/1/update.sh")

    })

  })

  //================================================================================
  it('The update script output should be posted to the hub', function() {

    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then( function() {
      expect(testFixture.getLastLog("deviceA")).to.deep.equal({
        deviceId: "deviceA",
        output: "update successful!",
        snapshotId: "1",
        success: "true"
      })
    })

  })

  //================================================================================
  //PROBLEM: calling the /howitworkedout in the background
  it('The update script output should be posted to the hub, even if the script fails.', function() {

    testFixture.shouldNextUpdateScriptSucceed = false


    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).should.be.rejected.then( function() {
      expect(testFixture.getLastLog("deviceA")).to.deep.equal({
        deviceId: "deviceA",
        output: "Error: update failed!",
        snapshotId: "1",
        success: "false"
      })
    })

  })
  //================================================================================
  it('If the update script fails, my snapshot-id file should NOT be updated.', function() {
    testFixture.setSnapshotId("0")
    testFixture.shouldNextUpdateScriptSucceed = false

    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).should.be.rejected.then( function() {
      //Ensure that snapshot-id is unchanged
      assert.equal(testFixture.getSnapshotId(), "0")
    })
  })

  //================================================================================
  it('should set environment variable "app_root" when running update scripts', function() {
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then(function() {
      //Ensure that the environment variable was set
      assert.isOk(process.env)
      assert.equal(process.env.apps_root, "/updatertest/apps")
    })
  })

  //================================================================================
  it('should set the correct working directory when running update scripts', function() {

    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then( function() {
      //Ensure that the environment variable was set
      assert.isOk(updater.lastExecutedCommandOptions.cwd)
      assert.equal(updater.lastExecutedCommandOptions.cwd, "/updatertest/downloads/1")
    })
  })

  //================================================================================
  it('should fail update if the downloaded ZIP doesnt contain update.sh', function() {
    testFixture.setDeviceId("deviceC") //This one has a ZIP file with no update.sh inside!
    testFixture.setSnapshotId(1)

    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).should.be.rejected.then(function() {
      //No new snapshot should have been generated.
      assert.equal(testFixture.getSnapshotId(), 1)
      //And the updater should have reported a failure to the hub.
      expect(testFixture.getLastLog("deviceC")).to.deep.equal({
        deviceId: "deviceC",
        output: "Error: The zip file didn't contain update.sh!",
        snapshotId: "2",
        success: "false"
      })
    })
  })

  //================================================================================
  it('If update.sh is under a subdirectory in the ZIP, it should still be found.', function() {
    testFixture.setDeviceId("deviceD")
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then(function() {
      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/5/stuff/update.sh")
    })
  })

  //================================================================================
  it('can download an .sh file directly.', function() {
    testFixture.setDeviceId("deviceE")
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then(function() {
      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedCommand, "/updatertest/downloads/7/update.sh")
    })
  })

  //================================================================================
  it('can execute a js file', function() {
    testFixture.setDeviceId("deviceF")
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then(function() {
      //Ensure that update.js was executed
      assert.equal(updater.lastExecutedCommand, "node /updatertest/downloads/8/update.js")
    })
  })
  
  //================================================================================
  it('can receive a nested config', function() {
    testFixture.setDeviceId("deviceF")
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).then(function(err) {

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
    return checkForUpdateAndTellHubHowItWorkedOut("/updatertest", 'http://fakeupdater.com', 1, false).should.become(
      { 
        deviceId: "deviceG",
        snapshotId: "30",
        newUpdateInterval: 120,
        updated: true
      }
    )
  })  

})
