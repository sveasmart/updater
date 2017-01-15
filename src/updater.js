const request = require("request")

function update(rootDir, updateUrl, callback) {
  var options = {
    uri: updateUrl,
    json: true,
    method: 'GET'
  }
  request(options, function(err, response, body) {
    if (err) return callback(err)
    if (body.status === "noUpdateNeeded") {
      callback()
    } else {
      callback(new Error("Unexpected or missing status in response body: ", body))
    }
  })

}


exports.update = update


