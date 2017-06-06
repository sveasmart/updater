const config = require('config')
const path = require('path')
const fs = require('fs')
const request = require('request')
const extract = require('extract-zip')
const Promise = require('promise')

exports.getConfigWithMinMax = function(paramName, min, max) {
  let value = config.get(paramName)
  if (value < min) {
    value = min
  }
  if (value > max) {
    value = max
  }
  return value
}

exports.getMyVersionNumber = function() {
  return exports.getVersionNumberFromPath(path.join(__dirname, ".."))
}

exports.getVersionNumberFromPath = function(path) {
  return "v" + path.split("/").pop().split("-").pop()
}

/**
 * Returns a promise that downloads a file from the given URL,
 * and resolves (with no arg) when it has been completely downloaded.
 * @param fromUrl the URL to the file
 * @param toFile the path to store the file to
 */
exports.downloadFile = function(fromUrl, toFile) {
  return new Promise((resolve, reject) => {
    const filePipe = request({uri: fromUrl}).pipe(fs.createWriteStream(toFile))
    filePipe.on('finish', function () {
      resolve()
    })
    filePipe.on('error', function(err) {
      reject(err)
    })
  })
}

/**
 * Returns a promise that unzips the given file inside it's parent dir.
 * The promise resolves (with no arg) when it has been completely unzipped.
 */
exports.unzipFile = function(zipFile) {
  const parentDir = path.join(zipFile, "..")
  const extractPromise = Promise.denodeify(extract)
  return extractPromise(zipFile, {dir: parentDir})
}

/**
 * Looks for a file with the given name in the given dir, or the first subfolder
 * Returns the path if found, or null if not.
 */
exports.findFileInPath = function(dir, fileName) {
  let filePath = path.join(dir, fileName)
  if (fs.existsSync(filePath)) {
    return filePath
  }
  const children = fs.readdirSync(dir)
  for (child of children) {
    const childFullPath = path.join(dir, child)
    if (fs.statSync(childFullPath).isDirectory()) {
      filePath = path.join(childFullPath, fileName)
      if (fs.existsSync(filePath)) {
        return filePath
      }
    }
  }
  return null

}


/**
 * Creates the given dir under the given parent.
 * If the dir already exists, does nothing.
 * Returns the full path to the created dir.
 */
exports.makeDir = function(parent, dirName) {
  const dirPath = path.join(parent, "" + dirName)
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath)
  }
  return dirPath
}

/**
 * Gets the given property, or throws error if it doesn't exist.
 */
exports.getMandatoryProperty = function(object, propertyName) {
  if (propertyName in object) {
    return object[propertyName]
  } else {
    throw new Error("Can't find property " + propertyName + " in object: " + JSON.stringify(object))
  }
}

/**
 * Gets the given property if provided, otherwise returns the given default
 */
exports.getOptionalProperty = function(object, propertyName, defaultValue) {
  if (propertyName in object) {
    return object[propertyName]
  } else {
    return defaultValue
  }
}


