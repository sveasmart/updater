//This module encapsulates some low level stuff
//so that the test cases can stay high level and easy to read.

const fs = require('fs') //File system interaction
const path = require('path')

const testFilesDir =   path.resolve(__dirname, "..", "tempTestFiles")
const updaterRootDir = path.resolve(testFilesDir, "updaterroot")
const serverFilesDir = path.resolve(testFilesDir, "serverstuff")

const rmdirRecursiveSync = require('rmdir-recursive').sync

function initTestFiles() {
  removeTestFiles()
  
  fs.mkdirSync(testFilesDir)

  fs.mkdirSync(updaterRootDir)
  fs.appendFileSync(updaterRootDir + "/device-id", "deviceA")

  fs.mkdirSync(serverFilesDir)
  fs.appendFileSync(serverFilesDir + "/update.sh", "echo $COLOR")
  fs.appendFileSync(serverFilesDir + "/update.js", 'console.log("config ", JSON.parse(process.env.config))')
}

function removeTestFiles() {
  rmdirRecursiveSync(testFilesDir)
}

exports.initTestFiles = initTestFiles
exports.removeTestFiles = removeTestFiles

exports.testFilesDir = testFilesDir
exports.updaterRootDir = updaterRootDir
exports.serverFilesDir = serverFilesDir
