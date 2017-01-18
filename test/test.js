const chai = require('chai')
const assert = chai.assert
const mocha = require("mocha")
const it = mocha.it;
const describe = mocha.describe;

const fs = require('fs') //File system interaction
const setup = require('./setup.js') //Contains low-level test setup stuff

const nock = require('nock') //Mocks all http requests
const Archiver = require('archiver'); //Creates ZIP files

var updater = null

//An in-memory integration test that checks if the updater works, end-to-end.
//Both the file system and http requests are mocked, so everything happens in-memory.
//So no real IO happens.
describe('Updater', function() {

  //=================================================================================
  before(function() {
    this.mockFileSystem = require('mock-fs') //Mocks all filesystem access using a fake in-memory fileystem
    //Create a fake in-memory file system
    this.mockFileSystem({
      '/home': {
        'device-id': 'deviceA'
      }
    })
    assert.isOk(fs.existsSync("/home"))
    assert.isOk(fs.existsSync("/home/device-id"))
    updater = setup.getUpdater()
  })

  after(function() {
    //Cleanup. Disable the mocks
    this.mockFileSystem.restore()
    assert.isNotOk(fs.existsSync("home"))
    nock.cleanAll()
    updater = null
    this.mockFileSystem = null
  })

  //================================================================================
  it('If updaterUrl is invalid, update should fail', function(done) {

    //Prepare the http mock
    nock('http://only.this.url.works')

    //Call the updated with a non-existent URL
    updater.update("/home", 'http://totally.invalid.url', function(err) {
      if (err) {
        done() //Good! The update SHOULD fail!
      } else {
        done(new Error("Hey, the update should have failed!"))
      }
    })
  })

  //================================================================================
  it('If no update was needed, then nothing should change', function(done) {

    //Prepare the http mock so it says no update is needed
    nock('http://fakeupdater.com')
      .get("/updateme")
      .query({
        'deviceId': 'deviceA',
        'snapshotId': '0'
      })
      .reply(200, {
        'status': 'noUpdateNeeded'
      })

    //Call the updater
    updater.update("/home", 'http://fakeupdater.com/updateme', function(err) {
      if (err) return done(err)

      //Check that no snapshot-id has been created
      assert.isNotOk(fs.existsSync("home/snapshot-id"))
      done()
    })
  })

  //================================================================================
  it('If update was needed, it should be downloaded and executed.', function(done) {
    //Create a ZIP file with a fake update script
    var zipFile = Archiver('zip');
    zipFile.append('Hello',  { name: 'update.sh' }).finalize()

    //Make the ZIP file available for download
    nock('http://download.fakeupdater.com')
      .get("/myUpdateScript.zip")
      .reply(200, function(uri, requestBody) {
        return zipFile
      })

    //Prepare the http mock so it says an update is needed
    nock('http://fakeupdater.com')
      .get("/updateme")
      .query({
        'deviceId': 'deviceA',
        'snapshotId': '0'
      })
      .reply(200, {
        'status': 'updateNeeded',
        'snapshotId': '1',
        'downloadUrl': 'http://download.fakeupdater.com/myUpdateScript.zip'
      })

    //Call the updater
    updater.update("/home", 'http://fakeupdater.com/updateme', function(err) {
      if (err) return done(err)

      //Ensure that it created a snapshot-id file
      assert.isOk(fs.existsSync("/home/snapshot-id"))
      const snapshotId = fs.readFileSync("/home/snapshot-id")
      assert.equal(snapshotId, '1')

      //Ensure that the file was downloaded to /home/downloads
      assert.isOk(fs.existsSync("/home/downloads/1/download.zip"))
      assert.isOk(fs.existsSync("/home/downloads/1/update.sh"))

      //Ensure that update.sh was executed
      assert.equal(updater.lastExecutedFile, "/home/downloads/1/update.sh")

      done()
    })
  })

})
