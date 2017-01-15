const request = require("request")

function update(rootDir, updateUrl, callback) {
  var options = {
    uri: updateUrl,
    method: 'GET'
  }
  request(options, function(err, response, body) {
    if (err) return callback(err)

    callback()
  })
  
}


exports.update = update


