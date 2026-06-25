import json,os
from .login.loginStatus import load_login_status
from MusicLibrary.kuGouMusicApi import KuGouMusicApi, Platform, KugouProcessEnv

user_data_file = os.path.join(os.path.dirname(__file__), "login", "loginStatus.json")

cookie, userid = load_login_status()

print("当前cookie:", cookie)

kugou = KuGouMusicApi(KugouProcessEnv(platform=Platform.LITE))

kugou.set_cookie(cookie)

response = kugou.user_detail()
print(response)
# import requests

# response = requests.get("http://127.0.0.1:3000/user/detail", cookies=cookie)
# print(response.json())