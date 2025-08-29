const { WebsocketClient } = require('binance');
const logger = require('./utils/LogSetting');
const { sendFWAlert } = require('./utils/AlertSetting');

// const delay = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

class PriceMonitor {
    constructor() {
        this.wsClient = null;
        this.isRunning = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 5000; // 5秒
        this.initWebSocketClient();

        this.firstFlag = 3;
        this.secondFlag = 3;
        this.ThirdFlag = 3;

        // 告警冷却（毫秒）与各档位冷却时间戳
        this.COOLDOWN_MS = 9000;
        this.lastAlertTime = {      //上一次发出警报的时间戳
            level1: 0,
            level2: 0,
            level3: 0
        }
    }

    // 初始化WebSocket客户端
    initWebSocketClient() {
        try {
            this.wsClient = new WebsocketClient({
                beautify: true,
            });
            
            this.setupEventListeners();
        } catch (error) {
            logger.error('初始化WebSocket客户端失败:', error.message);
            throw error;
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 连接成功监听
        this.wsClient.on('open', (data) => {
            logger.success('WS流连接成功');
            this.reconnectAttempts = 0; // 重置重连计数
        });
          
        // 消息监听
        this.wsClient.on('formattedMessage', (data) => {
            console.log(data);
            
            // 处理数据
            this.handlePriceChange(data);
        });

        // 错误处理 - 改进的错误处理
        this.wsClient.on('error', (data) => {
            logger.error('WS流出现错误:', data?.wsKey, data?.error || data);
            // this.handleWebSocketError(data);
        });

        // 重连监听
        this.wsClient.on('reconnecting', (data) => {
            this.reconnectAttempts++;
            logger.warn(`WS流正在重新连接中.... 第${this.reconnectAttempts}次尝试`, data?.wsKey);
        });

        this.wsClient.on('reconnected', (data) => {
            logger.success('WS流已重新连接', data?.wsKey);
            this.reconnectAttempts = 0;
        });

        // 连接关闭监听
        this.wsClient.on('close', (data) => {
            logger.warn('WS流连接关闭:', data?.wsKey);
            if (this.isRunning) {
                this.handleConnectionLoss();
            }
        });
    }

    // 处理连接丢失
    handleConnectionLoss() {
        if (!this.isRunning) return;

        logger.warn('检测到连接丢失，准备重新订阅...');
        
        setTimeout(() => {
            if (this.isRunning) {
                logger.info('尝试重新订阅数据流...');
                this.subscribeToCoins();
            }
        }, this.reconnectDelay);
    }

    // 处理K线数据函数
    async handlePriceChange(data) {
        try {
            const symbol = data.symbol;
            const close = parseFloat(data.close);

            // 数据有效性检查
            if (isNaN(close) || close <= 0) {
                logger.warn(`${symbol} 收到无效的价格数据: 最新价格=${close}`);
                return;
            }

            const now = Date.now();

            // 判断价格区间、触发警报和重置警报功能
            switch (true) {
                case (close < 0.9):
                    this.firstFlag = 3;
                    logger.info(`最新价格小于0.9, 重置level1报警次数为3`);
                    break;
                case (close >= 0.9 && close < 1.8):
                    if (this.firstFlag > 0 && (now - this.lastAlertTime.level1 >= this.COOLDOWN_MS)) {
                        // 还有警报发送次数，且距离上次发出时间间隔足够长，则发送警报
                        this.firstFlag--;
                        sendFWAlert();
                        logger.success(`最新价格大于0.9且小于1.8, 发送level1警报, 剩余报警次数 ${this.firstFlag} 🚨🚨🚨`);
                        this.lastAlertTime.level1 = now;
                    } else if(this.firstFlag > 0 && (now - this.lastAlertTime.level1 < this.COOLDOWN_MS)){
                        // 还有发送次数，但距离上次警报过短，则跳过
                        logger.warn(`距离上次发出警报时间过短,跳过level1告警`);
                    } else {
                        // 无警报发送次数，该价格段的警报发送完毕，目前价格长期处于这个价格段，不再发送警报
                        logger.warn(`level1无告警发送次数,价格稳定`);
                        if (now - this.lastAlertTime.level1 >= this.COOLDOWN_MS * 20) {
                            this.secondFlag = 3;
                            logger.info(`最新价格大于0.9且小于1.8, 重置level2报警次数为3`);
                        }
                    }
                    break;
                case (close >= 1.8 && close < 2.7):
                    if (this.secondFlag > 0 && (now - this.lastAlertTime.level2 >= this.COOLDOWN_MS)) {
                        // 还有警报发送次数，且距离上次发出时间间隔足够长，则发送警报
                        this.secondFlag--;
                        sendFWAlert();
                        logger.success(`最新价格大于1.8且小于2.7,发送level2警报, 剩余报警次数 ${this.secondFlag} 🚨🚨🚨`);
                        this.lastAlertTime.level2 = now;
                    } else if(this.secondFlag > 0 && (now - this.lastAlertTime.level2 < this.COOLDOWN_MS)){
                        // 还有发送次数，但距离上次警报过短，则跳过
                        logger.warn(`距离上次发出警报时间过短,跳过level2告警`);
                    } else {
                        // 无警报发送次数，该价格段的警报发送完毕，目前价格长期处于这个价格段，不再发送警报
                        logger.warn(`level2无告警发送次数,价格稳定`);
                        // 如果价格稳定在此区间，则重置下一级别警报次数
                        if (now - this.lastAlertTime.level2 >= this.COOLDOWN_MS * 40) {
                            this.ThirdFlag = 3;
                            logger.info(`最新价格大于1.8且小于2.7, 重置level2报警次数为3`);
                        }
                    }
                    break;
                case (close >= 2.7):
                    if (this.ThirdFlag > 0 && (now - this.lastAlertTime.level3 >= this.COOLDOWN_MS)) {
                        // 还有警报发送次数，且距离上次发出时间间隔足够长，则发送警报
                        this.ThirdFlag--;
                        sendFWAlert();
                        logger.success(`最新价格大于1.2,发送level3警报, 剩余报警次数 ${this.ThirdFlag}  🚨🚨🚨`);
                        this.lastAlertTime.level3 = now;
                    } else if(this.ThirdFlag > 0 && (now - this.lastAlertTime.level3 < this.COOLDOWN_MS)){
                        // 还有发送次数，但距离上次警报过短，则跳过
                        logger.warn(`距离上次发出警报时间过短,跳过level3告警`);
                    } else {
                        // 无警报发送次数，该价格段的警报发送完毕，目前价格长期处于这个价格段，不再发送警报
                        logger.warn(`level3无告警发送次数,价格稳定`);
                    }
                    break;
                default:
                    logger.error(`处理价格变动出现错误`)
                    break;
            }
            logger.info(`[${symbol}] 最新价格为${close}`);
        } catch (error) {
            logger.error('处理K线数据时出错:', error);
            // logger.error('错误数据:', data);
        }
    }

    // 订阅单个币种K线数据
    subscribeSymbolPrice(symbol) {
        try {
            // 第三个参数设置为true，这样可以接收到is_closed字段
            // this.wsClient.subscribeSpotKline(symbol, interval, true);
            // if (symbol == "XPLUSDT") {
            // this.wsClient.subscribe('xplusdt@markPrice@1s', 'coinm')
            this.wsClient.subscribe(`${symbol}usdt@miniTicker`, 'usdm');
            // }
            logger.info(`已订阅 ${symbol} 的 交易对数据`);
            return true;
        } catch (error) {
            logger.error(`订阅 ${symbol} 数据失败:`, error.message);
            return false;
        }
    }

    // 根据配置订阅币种 - 改进失败处理
    // subscribeToCoins() {
        // if (!config.coins || !config.coins.length) {
        //     logger.error('没有找到币种配置');
        //     return false;
        // }

        // let successCount = 0;
        // let totalCount = 0;
        // this.subscribeCoinKline();
        // config.coins.forEach(coinConfig => {
        //     const { symbol, intervals } = coinConfig;
            
        //     if (!symbol || !intervals || !Array.isArray(intervals)) {
        //         logger.warn('无效的币种配置:', coinConfig);
        //         return;
        //     }
            
        //     intervals.forEach(interval => {
        //         totalCount++;
        //         if (this.subscribeCoinKline(symbol, interval)) {
        //             successCount++;
        //         }
        //     });
        // });

        // logger.info(`成功订阅 ${successCount}/${totalCount} 个数据流`);
        
        // // 如果所有订阅都失败，停止监控
        // if (successCount === 0 && totalCount > 0) {
        //     logger.error('所有数据流订阅都失败，停止监控');
        //     this.stop();
        //     return false;
        // }
        
        // // 如果成功率过低，发出警告
        // if (successCount < totalCount * 0.5) {
        //     logger.warn(`订阅成功率较低: ${((successCount/totalCount)*100).toFixed(1)}%`);
        // }
        
        // return successCount > 0;
    // }

    // 启动监控
    start() {
        try {
            if (this.isRunning) {
                logger.warn('价格监控已在运行中');
                return;
            }

            logger.info('启动价格监控...');
            this.isRunning = true;
            
            if (!this.subscribeSymbolPrice('xpl')) {
                logger.error('启动失败：无法订阅任何数据流');
                this.isRunning = false;
                return false;
            }
            
            this.setupGracefulShutdown();
            logger.success('价格监控启动成功');
            return true;
            
        } catch (error) {
            logger.error('启动价格监控时出错:', error.message);
            this.isRunning = false;
            return false;
        }
    }

    // 停止监控
    stop() {
        if (!this.isRunning) {
            logger.warn('价格监控未在运行');
            return;
        }

        logger.info('正在关闭价格监控...');
        this.isRunning = false;
        
        try {
            if (this.wsClient) {
                this.wsClient.closeAll();
            }
        } catch (error) {
            logger.error('关闭WebSocket连接时出错:', error.message);
        }
        
        logger.info('价格监控已停止');
    }

    // 设置优雅退出处理
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            logger.info(`收到${signal}信号，正在优雅关闭...`);
            this.stop();
            setTimeout(() => { process.exit(0); }, 1000);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    // 获取监控状态
    // getStatus() {
    //     return {
    //         isRunning: this.isRunning,
    //         reconnectAttempts: this.reconnectAttempts,
    //         maxReconnectAttempts: this.maxReconnectAttempts
    //     };
    // }
}

module.exports = PriceMonitor;