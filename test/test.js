const chai = require('chai')
const assert = chai.assert

const fs = require('fs') //File system interaction

const mockFileSystem = require('mock-fs') //Mocks all filesystem access using a fake in-memory fileystem
const nock = require('nock') //Mocks all http requests

const updater = require("../src/updater.js")

//An in-memory integration test that checks if the updater works, end-to-end.
//Both the file system and http requests are mocked, so everything happens in-memory.
//So no real IO happens.
describe('Updater', function() {

  before(function() {
    //Create a fake in-memory file system
    mockFileSystem({
      '/home': {
        'device-id': 'deviceA'
      }
    })
    assert.isOk(fs.existsSync("/home"))
    assert.isOk(fs.existsSync("/home/device-id"))
  })

  after(function() {
    //Cleanup. Disable the mocks
    mockFileSystem.restore()
    assert.isNotOk(fs.existsSync("home"))
    nock.cleanAll()
  })

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

  it('If no update was needed, then nothing should change', function(done) {

    //Prepare the http mock so it says no update is needed
    nock('http://fakeupdater.com')
      .get("/updateme")
      .query({
        'deviceId': 'deviceA'
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

  it('If update was needed, it should be downloaded and the snapshot-id file should be updated', function(done) {

    //Prepare the http mock so it says an update is needed
    nock('http://fakeupdater.com')
      .get("/updateme")
      .query({
        'deviceId': 'deviceA'
      })
      .reply(200, {
        'status': 'updateNeeded',
        'snapshotId': '1',
        'downloadUrl': 'http://fakupdate.com/download?deviceId=deviceA&snapshotId=1'
      })

    //Call the updater
    updater.update("/home", 'http://fakeupdater.com/updateme', function(err) {
      if (err) return done(err)

      //Ensure that it created a snapshot-id file
      assert.isOk(fs.existsSync("/home/snapshot-id"))
      const snapshotId = fs.readFileSync("/home/snapshot-id")
      assert.equal(snapshotId, '1')
      done()
    })
  })

})
