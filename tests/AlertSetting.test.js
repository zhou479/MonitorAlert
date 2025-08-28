const { sendFWAlert } = require("../src/utils/AlertSetting");

(async() => {
    await sendFWAlert();
})();