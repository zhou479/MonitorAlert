const winston = require('winston');
const fs = require('fs');

// 确保日志目录存在
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// 自定义日志等级
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        success: 3,
        debug: 4,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'cyan',
        success: 'green',
        debug: 'blue',
    },
};

// 添加颜色配置
winston.addColors(customLevels.colors);

// 获取调用时的文件名和行号
function getCallerInfo() {
    const error = new Error();
    const stack = error.stack.split('\n')[3]; // 获取调用者的堆栈信息
    const match = stack.match(/\((.+?):(\d+):(\d+)\)/) || stack.match(/at (.+?):(\d+):(\d+)/);
    if (match) {
        const [, file, line] = match;
        return `${file.split('/').pop()}:${line}`; // 只返回文件名和行号
    }
    return '';
}

// 创建日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => {
        // 文件信息和消息都会继承日志级别的颜色
        const fileInfo = info.metadata?.stack ? `${info.metadata.stack}` : '';
        const fullMessage = `${info.timestamp} | ${fileInfo} | ${info.level} | ${info.message}`;
        return winston.format.colorize().colorize(info.level, fullMessage);
    })
);

// 日志配置
const logConfiguration = {
    levels: customLevels.levels,
    level: 'debug',
    format:
        winston.format.combine(
            winston.format.metadata({ fillWith: ['stack'] }),
            winston.format.errors({ stack: true }),
            logFormat
        ),
    transports: [
        // 输出到控制台
        new winston.transports.Console(),

        // 输出到文件
        new winston.transports.File({ 
            filename: 'logs/run.log',
            format: winston.format.combine(
                        winston.format.uncolorize(),
                        winston.format.timestamp({
                            format: 'YYYY-MM-DD HH:mm:ss'
                        }),
                        winston.format.errors({ stack: true }),
                        winston.format.printf(info => {
                            const fileInfo = info.metadata?.stack ? `${info.metadata.stack}` : '';
                            return `${info.timestamp} | ${fileInfo} | ${info.level} | ${info.message}`;
                        })
                    )
        })
    ]
};

// 创建logger实例
const logger = winston.createLogger(logConfiguration);
const wrappedLogger = {
    error: (message) => logger.error(message, { stack: getCallerInfo() }),
    warn: (message) => logger.warn(message, { stack: getCallerInfo() }),
    info: (message) => logger.info(message, { stack: getCallerInfo() }),
    success: (message) => logger.success(message, { stack: getCallerInfo() }),
    debug: (message) => logger.debug(message, { stack: getCallerInfo() })
};

module.exports = wrappedLogger;