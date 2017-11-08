//This is useful for testing the scriptToCallWhenDeviceIdHasBeenSet feature.
//Add this to your config/local.yml:
//   scriptToCallWhenDeviceIdHasBeenSet: node scripts/change-hostname.js

const fs = require('fs')
console.log("CHANGE HOSTNAME " + process.argv[2])
fs.writeFileSync("changehostname.txt", "CHANGE HOSTNAME " + process.argv[2])
