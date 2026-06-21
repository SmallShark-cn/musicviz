import time, json
from ..utils import init_logger
import os
import requests

logger = init_logger("login_status")

def parse_cookies(cookieStr):
    cookie = {}
    for item in cookieStr.split(", "):
        item = item.split("; ")[0]
        # 按照第一个等号分割，获取键值对
        k, v = item.split("=", 1)
        cookie[k.strip()] = v.strip()
    return cookie

LOGIN_STATUS_FILE = os.path.join(os.path.dirname(__file__), "loginStatus.json")

def save_login_status(header, content):
    cookies = header.get("Set-Cookie", [])
    user = content.get("data", {})
    data = {
        "cookies": cookies,
        "user": user,
        "timestamp": int(time.time())
    }
    with open(LOGIN_STATUS_FILE, "w+", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    return data

# COOKIE 更新逻辑
def refresh_cookies(token, userid):
    SERVER = os.getenv("KIGOU_MUSIC_API", "http://127.0.0.1:3000")
    response = requests.get(f"{SERVER}/login/token", {"token": token, "userid": userid})
    if response:
        with open("login_response.txt", "w", encoding="utf-8") as f:
            f.write(f"Status Code: {response.status_code}\n")
            f.write(f"Headers: {response.headers}\n")
            f.write(f"Content: {response.text}\n")
            logger.info("刷新后的登录响应已保存到 login_response.txt")
        data = save_login_status(response.headers, response.json())
        COOKIES = data.get("cookies", {})
        return COOKIES

def load_login_status():
    COOKIES = {}
    USERID = ""
    try:
        if os.path.exists(LOGIN_STATUS_FILE):
            with open(LOGIN_STATUS_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
                COOKIES = parse_cookies(config.get("cookies", []))
                USERID = config.get("user", {}).get("userid", "")
                if COOKIES and USERID and time.time() - config.get("timestamp", 0) > 7200:  # 2小时
                    COOKIES = refresh_cookies(COOKIES.get("token"), USERID)
                return COOKIES, USERID
    except Exception as e:
        logger.error(f"加载配置失败: {e}")
        return COOKIES, USERID