import json,os
from .login.loginStatus import load_login_status
from MusicLibrary.kuGouMusicApi import KuGouMusicApi, Platform, KugouProcessEnv

user_data_file = os.path.join(os.path.dirname(__file__), "login", "loginStatus.json")

cookie, userid = load_login_status()

kugou = KuGouMusicApi(KugouProcessEnv(platform=Platform.LITE))

kugou.set_cookie(cookie)

print("当前cookie:", cookie)

response = kugou.song_url(hash="611E8F05F5D68636F40A08B1B5E6F2D5", quality="320")
print(response)