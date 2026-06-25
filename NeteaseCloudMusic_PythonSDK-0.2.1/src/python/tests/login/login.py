
import qrcode
import time
import base64
from .loginStatus import save_login_status
from ..utils import init_logger
from MusicLibrary.kuGouMusicApi import KuGouMusicApi, Platform, KugouProcessEnv

kugou = KuGouMusicApi(KugouProcessEnv(platform=Platform.LITE))

logger = init_logger("login")

def create_qr():
    # response = GET("/login/wx/create", cache=False)
    # if response is None:
    #     logger.error("二维码生成失败")
    #     return None
    # data = response.json()
    response = kugou.login_wx_create()
    data = response.data
    uuid = data.get("uuid")
    qrcode_url = data.get("qrcode", {}).get("qrcodeurl")
    qrcode_base64 = data.get("qrcode", {}).get("qrcodebase64")
    logger.info(f"请使用微信扫码登录，扫码链接：{qrcode_url}")
    # 控制台显示二维码
    if qrcode_url:
        qr = qrcode.QRCode()
        qr.add_data(qrcode_url)
        qr.make()
        qr.print_ascii(invert=True)
    # 保存二维码图片到本地
    if qrcode_base64:
        with open("wx_qrcode.png", "wb") as f:
            f.write(base64.b64decode(qrcode_base64))
        logger.info("二维码图片已保存为 wx_qrcode.png")
    return uuid

def check_qr(uuid):
    while True:
        response = kugou.login_wx_check(uuid)
        if response is None:
            logger.error("扫码状态获取失败")
            return None
        data = response.data
        status = data.get("wx_errcode")
        if status == 408:
            logger.info("等待扫码...")
        elif status == 404:
            logger.info("已扫码，等待确认...")
        elif status == 403:
            logger.info("用户拒绝登录")
            return None
        elif status == 405:
            logger.info("扫码成功，正在登录...")
            wx_code = data.get("wx_code")
            return wx_code
        elif status == 402:
            logger.info("二维码已过期")
            return None
        else:
            logger.error(f"未知状态：{status}")
        time.sleep(2)

def openplat_login(wx_code):
    response = kugou.login_openplat(code=wx_code)
    if response is None:
        logger.error("开放平台登录失败")
        return None
    print("openplat_login", response)
    return response

if __name__ == "__main__":
    import os
    login_response_path = os.path.join(os.path.dirname(__file__), "login_response.txt")
    
    uuid = create_qr()
    if uuid:
        wx_code = check_qr(uuid)
        if wx_code:
            response = openplat_login(wx_code)
            if response:
                with open(login_response_path, "w", encoding="utf-8") as f:
                    f.write(f"Status Code: {response.status}\n")
                    f.write(f"Headers: {response.headers}\n")
                    f.write(f"Content: {response.data}\n")
                logger.info(f"微信登录响应已保存到 {login_response_path}")
                save_login_status(response.headers, response.data)