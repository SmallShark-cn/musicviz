import os,logging,sys
from logging.handlers import TimedRotatingFileHandler

def init_logger(name: str):
    # Logger配置
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # 控制台Handler - 设置编码
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_formatter = logging.Formatter("%(asctime)s %(levelname)s [%(funcName)s:%(lineno)d]: %(message)s")
    console_handler.setFormatter(console_formatter)

    # 添加Handler
    logger.handlers.clear()
    logger.addHandler(console_handler)
    
    return logger