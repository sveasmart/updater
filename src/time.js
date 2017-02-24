const os = require('os');
const request = require("request");
const spawnSync = require('child_process').spawnSync;

function syncSystemClockWithServer(hubUrl) {


  const options = {
    uri: hubUrl + "/time",
    json: true,
    method: 'GET'
  };

  console.log("TIME - Getting the time from the server");
  request(options, function (error, response, body) {
    // TODO : Loop until success
    if( error ){
      console.log("TIME - No connection with time server")
    } else {
      let serverIsoTime = body.data;
      console.log("TIME - Server time: " + serverIsoTime);
      if (os.platform() === 'linux') {
        let command = "date";
        let args = ["-s", serverIsoTime];

        console.log("TIME - Setting system time");
        let result = spawnSync(command, args);

        if (result.status === 0) {
          console.log("TIME - Time set from server OK");
        } else {
          console.log("TIME - ERROR: Something went wrong!");
          console.log("TIME - " + result.stderr.toString());
        }
      } else {
        console.log("TIME - Didn't update the local time due to not linux platform");
      }
    }
  });
}

exports.syncSystemClockWithServer = syncSystemClockWithServer;