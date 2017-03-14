const config = require('config')

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
  return "v" + __dirname.split("/").pop().split("-").pop()
}

exports.getConfigWithMinMax = getConfigWithMinMax
exports.getMyVersionNumber = getMyVersionNumber