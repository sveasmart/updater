const config = require('config')
const path = require('path')

function getConfigWithMinMax(paramName, min, max) {
  let value = config.get(paramName)
  if (value < min) {
    value = min
  }
  if (value > max) {
    value = max
  }
  return value
}

function getMyVersionNumber() {
  return getVersionNumberFromPath(path.join(__dirname, ".."))
}

function getVersionNumberFromPath(path) {
  return "v" + path.split("/").pop().split("-").pop()
}

exports.getConfigWithMinMax = getConfigWithMinMax
exports.getMyVersionNumber = getMyVersionNumber
exports.getVersionNumberFromPath = getVersionNumberFromPath