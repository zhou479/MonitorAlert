const PriceMonitor = require('./src/BinanceWebsocketData');
const logger = require('./src/utils/LogSetting');

// 创建价格监控实例
const monitor = new PriceMonitor();

// 启动监控
try {
    monitor.start();
    logger.info('价格监控系统已启动');
} catch (error) {
    logger.error('启动价格监控失败:', error.message);
    process.exit(1);
}