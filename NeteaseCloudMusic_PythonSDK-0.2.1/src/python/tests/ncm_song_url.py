import json,os
# from .login.loginStatus import load_login_status
from MusicLibrary.neteaseCloudMusicApi import NeteaseCloudMusicApi, NcmProcessEnv

def parse_cookies(cookieStr):
    cookie = {}
    for item in cookieStr.split(";;"):
        item = item.split("; ")[0]
        # 按照第一个等号分割，获取键值对
        k, v = item.split("=", 1)
        cookie[k.strip()] = v.strip()
    return cookie

user_data_file = os.path.join(os.path.dirname(__file__), "ncm_login_cookie.json")

with open(user_data_file, "r", encoding="utf-8") as f:
    content = json.load(f)

cookie = parse_cookies(content.get("cookie", {}))

# cookie, userid = load_login_status()

# print("当前cookie:", cookie)

ncm = NeteaseCloudMusicApi(NcmProcessEnv())

ncm.set_cookie(cookie)

response = ncm.request("/song/url", id="33894312", br="320000")
response = ncm.song_url(id="33894312", br="320000")
print(response)