const chai = require('chai')
const assert = chai.assert
const updater = require("../src/updater.js")
const fs = require('fs')
const mockFileSystem = require('mock-fs');
const nock = require('nock'); //http request mocking framework
const request = require('request')

describe('Updater', function() {
  before(function() {
    //Create a fake in-memory file system
    mockFileSystem({
      'home': {
        'device-id': 'deviceA'
      }
    })
    assert.isOk(fs.existsSync("home"))
    assert.isOk(fs.existsSync("home/device-id"))
  })

  after(function() {
    mockFileSystem.restore()
    assert.isNotOk(fs.existsSync("home"))
  })

  it('If no update was needed, then nothing should change', function(done) {
    nock('http://fakeupdater.com')
      .get("/updateme")
      .reply(200, {hello: "World"})

    //Updater connects to the server and says "Hi, I'm deviceA, and I have snapshot #0."
    //Server responds "OK" (= nothing to install)
    //Updater shouldn't change anything.

    updater.update("/home", 'http://fakeupdater.com/updateme', function(err) {
      if (err) return done(err)
      assert.isNotOk(fs.existsSync("home/snapshot-id"))
      done()
    })
  })
})
