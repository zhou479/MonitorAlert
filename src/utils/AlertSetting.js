const axios = require('axios');
const logger = require('./LogSetting');

const FWAlertURL = 'xxxx'; // 从饭碗网站获取

// 饭碗电话告警 https://fwalert.com/
async function sendFWAlert() {
    try{
        let data = '';
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: FWAlertURL,
            headers: {
            },
            data : data
        };

        const res = await axios.request(config);
        if(res.status == 200) {
            logger.success(`饭碗告警通知发送成功!`)
        }
    } catch(error) {
        console.log(`发送电话告警失败 ${error.message}`);
    }
}

module.exports = {
    sendFWAlert
};
