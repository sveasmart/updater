const os = require('os');
const request = require("request");
const spawnSync = require('child_process').spawnSync;

function syncSystemClockWithServer(hubUrl) {

    const options = {
        uri: hubUrl + "/time",
        json: true,
        method: 'GET'
    };

    request(options, function (error, response, body) {
        if (os.platform() === 'linux') {
            let serverIsoTime = body.data;

            let command = "date";
            let args = ["-s", serverIsoTime];

            console.log("Setting system time");
            let result = spawnSync(command, args);

            if (result.status === 0) {
                console.log("Time set from server OK");
            } else {
                console.log("ERROR: Something went wrong!");
                console.log(result.stderr.toString());
            }
        }
    });
}

exports.syncSystemClockWithServer = syncSystemClockWithServer;