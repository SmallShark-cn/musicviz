import json,os
# from .login.loginStatus import load_login_status
from MusicLibrary.neteaseCloudMusicApi import NeteaseCloudMusicApi, NcmProcessEnv

ncm = NeteaseCloudMusicApi(NcmProcessEnv())

## 1. 获取验证码
# captcha_response = ncm.captcha_sent(phone="")
# print(captcha_response)

## 2. 登录
# response = ncm.login_cellphone(phone="", captcha="")
# if response.data.get("cookie"):
#     with open(os.path.join(os.path.dirname(__file__), "ncm_login_cookie.json"), "w", encoding="utf-8") as f:
#         json.dump({"cookie": response.data.get("cookie")}, f, indent=4)
# print(response)