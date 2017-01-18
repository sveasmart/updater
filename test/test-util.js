//This module encapsulates some low level stuff
//so that the test cases can stay high level and easy to read.

const chai = require('chai')
const assert = chai.assert
const mocha = require("mocha")

const fs = require('fs') //File system interaction
const nock = require('nock') //Mocks all http requests
const Archiver = require('archiver'); //Creates ZIP files

function initMocks() {
  //Create a fake in-memory file system
  this.mockFileSystem = require('mock-fs') //Mocks all filesystem access using a fake in-memory fileystem
  this.mockFileSystem({
    '/updatertest': { //Note - this call fails if a REAL folder with this name exists in the filesystem.
      'device-id': 'deviceA'
    }
  })
  assert.isOk(fs.existsSync("/updatertest"))
  assert.isOk(fs.existsSync("/updatertest/device-id"))
}


exports.initMocks = initMocks
