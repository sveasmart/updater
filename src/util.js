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

exports.getConfigWithMinMax = getConfigWithMinMax