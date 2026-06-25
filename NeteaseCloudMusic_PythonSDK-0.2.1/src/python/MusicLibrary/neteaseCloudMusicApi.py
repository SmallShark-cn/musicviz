import ctypes
from ctypes import CDLL, Structure, c_char_p, c_void_p, c_int, POINTER
from .core import (
    load_ncm,
    engine,
    _Engine,
    _NcmProcessEnv as NcmProcessEnv,
    _NcmContextManager,
)
from .common import to_bytes, Response
import json
from enum import Enum

__all__ = ["NeteaseCloudMusicApi", "NcmProcessEnv"]


class NeteaseCloudMusicApi:
    def __init__(self, env: NcmProcessEnv = None):
        self.ncm = load_ncm()
        self.cookie = {}

        _Engine()
        _NcmContextManager.init(env)
        self.env = env or _NcmContextManager._env
        self.ctx = _NcmContextManager.get_ctx()
        self._destroyed = False

    def set_cookie(self, cookie: dict):
        self.cookie = cookie

    def request(self, path, cookie={}, env: NcmProcessEnv = None, **query) -> Response:
        if env is None:
            env = self.env

        # 剔除值为 None 的参数
        query = {k: v for k, v in query.items() if v is not None}
        query = json.dumps(query) if query else ""

        # 自动补全cookie（如果self.cookie有）
        if not cookie and self.cookie:
            cookie = self.cookie

        # 将cookie转换为JSON字符串
        cookie = json.dumps(cookie) if cookie else "{}"

        path = to_bytes(path)
        query = to_bytes(query)
        cookie = to_bytes(cookie)

        ptr = self.ncm.ncm_request(
            self.ctx,
            path,
            cookie,
            query,
            ctypes.byref(env),
        )
        if ptr:
            result = ctypes.cast(ptr, ctypes.c_char_p).value
            res_str = result.decode("utf-8")
            engine.response_free(ptr)
            return Response(res_str)
        return Response(status="error", body="Failed to get response")

    def destroy(self):
        if not self._destroyed:
            try:
                engine.destroy_context(self.ctx)
                self._destroyed = True
            except Exception as e:
                # 可根据需要打印日志或忽略
                # Todo
                pass

    def __del__(self):
        self.destroy()

    def login_cellphone(
        self,
        phone,
        password=None,
        countrycode=None,
        md5_password=None,
        captcha=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        1.手机登录
        登录功能整体说明 : 登录有三个接口
        不要频繁调登录接口,不然可能会被风控,登录状态还存在就不要重复调登录接口
        因网易增加了网易云盾验证,密码登录暂时不要使用,尽量使用短信验证码登录和二维码登录,否则调用某些接口会触发需要验证的错误
        必选参数 :
        phone: 手机号码
        可选参数 :
        password: 密码
        countrycode: 国家码，用于国外手机号登录，例如美国传入：1
        md5_password: md5 加密后的密码,传入后 password 参数将失效
        captcha: 验证码,使用 /captcha/sent 接口传入手机号获取验证码,调用此接口传入验证码,可使用验证码登录,传入后 password 参数将失效
        接口地址 : /login/cellphone
        调用例子 : /login/cellphone?phone=xxx&password=yyy /login/cellphone?phone=xxx&md5_password=yyy /login/cellphone?phone=xxx&captcha=1234
        """
        return self.request(
            "/login/cellphone",
            cookie,
            env,
            phone=phone,
            password=password,
            countrycode=countrycode,
            md5_password=md5_password,
            captcha=captcha,
        )

    def login(
        self, email, password, md5_password=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        2.邮箱登录
        登录功能整体说明 : 登录有三个接口
        不要频繁调登录接口,不然可能会被风控,登录状态还存在就不要重复调登录接口
        因网易增加了网易云盾验证,密码登录暂时不要使用,尽量使用短信验证码登录和二维码登录,否则调用某些接口会触发需要验证的错误
        必选参数 :
        email: 163 网易邮箱
        password: 密码
        可选参数 :
        md5_password: md5 加密后的密码,传入后 password 将失效
        接口地址 : /login
        调用例子 : /login?email=xxx@163.com&password=yyy
        完成登录后，会在浏览器保存一个 Cookies 用作登录凭证，大部分 API 都需要用到这个 Cookies。
        """
        return self.request(
            "/login",
            cookie,
            env,
            email=email,
            password=password,
            md5_password=md5_password,
        )

    def login_qr_key(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        3.二维码登录
        登录功能整体说明 : 登录有三个接口
        不要频繁调登录接口,不然可能会被风控,登录状态还存在就不要重复调登录接口
        因网易增加了网易云盾验证,密码登录暂时不要使用,尽量使用短信验证码登录和二维码登录,否则调用某些接口会触发需要验证的错误
        说明: 二维码登录涉及到 3 个接口,调用务必带上时间戳,防止缓存
        1. 二维码 key 生成接口
        说明: 调用此接口可生成一个 key
        接口地址 : /login/qr/key
        """
        return self.request("/login/qr/key", cookie, env)

    def login_qr_create(
        self, key, qrimg=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        3.二维码生成接口
        登录功能整体说明 : 登录有三个接口
        不要频繁调登录接口,不然可能会被风控,登录状态还存在就不要重复调登录接口
        因网易增加了网易云盾验证,密码登录暂时不要使用,尽量使用短信验证码登录和二维码登录,否则调用某些接口会触发需要验证的错误
        说明: 调用此接口传入上一个接口生成的 key 可生成二维码图片的 base64 和二维码信息,可使用 base64 展示图片,或者使用二维码信息内容自行使用第三方二维码生成库渲染二维码
        必选参数: key,由第一个接口生成
        可选参数: qrimg 传入后会额外返回二维码图片 base64 编码
        接口地址 : /login/qr/create
        调用例子 : /login/qr/create?key=xxx
        """
        return self.request("/login/qr/create", cookie, env, key=key, qrimg=qrimg)

    def login_qr_check(
        self, key, noCookie=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        3.二维码检测扫码状态接口
        登录功能整体说明 : 登录有三个接口
        不要频繁调登录接口,不然可能会被风控,登录状态还存在就不要重复调登录接口
        因网易增加了网易云盾验证,密码登录暂时不要使用,尽量使用短信验证码登录和二维码登录,否则调用某些接口会触发需要验证的错误
        说明: 轮询此接口可获取二维码扫码状态,800 为二维码过期,801 为等待扫码,802 为待确认,803 为授权登录成功(803 状态码下会返回 cookies),如扫码后返回502,则需加上noCookie参数,如 &noCookie=true
        必选参数: key,由第一个接口生成
        接口地址 : /login/qr/check
        调用例子 : /login/qr/check?key=xxx
        """
        return self.request("/login/qr/check", cookie, env, key=key, noCookie=noCookie)

    def register_anonimous(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        游客登录
        说明 : 直接调用此接口, 可获取游客cookie,如果遇到其他接口未登录状态报400状态码需要验证的错误,可使用此接口获取游客cookie避免报错
        接口地址 : /register/anonimous
        """
        return self.request("/register/anonimous", cookie, env)

    def login_refresh(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        刷新登录
        说明 : 调用此接口 , 可刷新登录状态,返回内容包含新的cookie(不支持刷新二维码登录的cookie)
        调用例子 : /login/refresh
        """
        return self.request("/login/refresh", cookie, env)

    def captcha_sent(
        self, phone, ctcode=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        发送验证码
        说明 : 调用此接口 ,传入手机号码, 可发送验证码
        必选参数 : phone: 手机号码
        可选参数 :
        ctcode: 国家区号,默认 86 即中国
        接口地址 : /captcha/sent
        调用例子 : /captcha/sent?phone=13xxx
        """
        return self.request("/captcha/sent", cookie, env, phone=phone, ctcode=ctcode)

    def captcha_verify(
        self, phone, captcha, ctcode=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        验证验证码
        说明 : 调用此接口 ,传入手机号码和验证码, 可校验验证码是否正确
        必选参数 : phone: 手机号码
        captcha: 验证码
        可选参数 :
        ctcode: 国家区号,默认 86 即中国
        接口地址 : /captcha/verify
        调用例子 : /captcha/verify?phone=13xxx&captcha=1597
        """
        return self.request(
            "/captcha/verify", cookie, env, phone=phone, captcha=captcha, ctcode=ctcode
        )

    def register_cellphone(
        self,
        captcha,
        phone,
        password,
        nickname,
        countrycode=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        注册(修改密码)
        说明 : 调用此接口 ,传入手机号码和验证码,密码,昵称, 可注册网易云音乐账号(同时可修改密码)
        必选参数 :
        captcha: 验证码
        phone : 手机号码
        password: 密码
        nickname: 昵称
        可选参数 :
        countrycode: 国家码，用于国外手机号，例如美国传入：1 ,默认 86 即中国
        接口地址 : /register/cellphone
        调用例子 : /register/cellphone?phone=13xxx&password=xxxxx&captcha=1234&nickname=binary1345
        """
        return self.request(
            "/register/cellphone",
            cookie,
            env,
            captcha=captcha,
            phone=phone,
            password=password,
            nickname=nickname,
            countrycode=countrycode,
        )

    def cellphone_existence_check(
        self, phone, countrycode=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        检测手机号码是否已注册
        说明 : 调用此接口 ,可检测手机号码是否已注册
        必选参数 :
        phone : 手机号码
        可选参数 :
        countrycode: 国家码，用于国外手机号，例如美国传入：1 ,默认 86 即中国
        接口地址 : /cellphone/existence/check
        调用例子 : /cellphone/existence/check?phone=13xxx
        """
        return self.request(
            "/cellphone/existence/check",
            cookie,
            env,
            phone=phone,
            countrycode=countrycode,
        )

    def activate_init_profile(
        self, nickname, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        初始化昵称
        说明 : 刚注册的账号(需登录),调用此接口 ,可初始化昵称
        必选参数 :
        nickname : 昵称
        接口地址 : /activate/init/profile
        调用例子 : /activate/init/profile?nickname=testUser2019
        """
        return self.request("/activate/init/profile", cookie, env, nickname=nickname)

    def nickname_check(
        self, nickname, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        重复昵称检测
        说明 : 调用此接口 ,可检测昵称是否重复,并提供备用昵称
        必选参数 :
        nickname : 昵称
        接口地址 : /nickname/check
        调用例子 : /nickname/check?nickname=binaryify
        """
        return self.request("/nickname/check", cookie, env, nickname=nickname)

    def rebind(
        self,
        oldcaptcha,
        captcha,
        phone,
        ctcode=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        更换绑定手机
        说明 : 调用此接口 ,可更换绑定手机(流程:先发送验证码到原手机号码,再发送验证码到新手机号码然后再调用此接口)
        必选参数 :
        oldcaptcha: 原手机验证码
        captcha: 新手机验证码
        phone : 手机号码
        ctcode : 国家区号,默认 86 即中国
        接口地址 : /rebind
        调用例子 : /rebind?phone=xxx&oldcaptcha=1234&captcha=5678
        """
        return self.request(
            "/rebind",
            cookie,
            env,
            oldcaptcha=oldcaptcha,
            captcha=captcha,
            phone=phone,
            ctcode=ctcode,
        )

    def logout(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        退出登录
        说明 : 调用此接口 , 可退出登录
        调用例子 : /logout
        """
        return self.request("/logout", cookie, env)

    def login_status(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        登录状态
        说明 : 调用此接口,可获取登录状态
        接口地址 : /login/status
        """
        return self.request("/login/status", cookie, env)

    def user_detail(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取用户详情
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户详情
        必选参数 : uid : 用户 id
        接口地址 : /user/detail
        调用例子 : /user/detail?uid=32953014
        """
        return self.request("/user/detail", cookie, env, uid=uid)

    def user_account(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取账号信息
        说明 : 登录后调用此接口 ,可获取用户账号信息
        接口地址 : /user/account
        调用例子 : /user/account
        """
        return self.request("/user/account", cookie, env)

    def user_subcount(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取用户信息 , 歌单，收藏，mv, dj 数量
        说明 : 登录后调用此接口 , 可以获取用户信息
        接口地址 : /user/subcount
        调用例子 : /user/subcount
        """
        return self.request("/user/subcount", cookie, env)

    def user_level(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取用户等级信息
        说明 : 登录后调用此接口 , 可以获取用户等级信息,包含当前登录天数,听歌次数,下一等级需要的登录天数和听歌次数,当前等级进度,对应 https://music.163.com/#/user/level
        接口地址 : /user/level
        调用例子 : /user/level
        """
        return self.request("/user/level", cookie, env)

    def user_binding(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取用户绑定信息
        说明 : 登录后调用此接口 , 可以获取用户绑定信息
        必选参数 : uid : 用户 id
        接口地址 : /user/binding
        调用例子 : /user/binding?uid=32953014
        """
        return self.request("/user/binding", cookie, env, uid=uid)

    def user_replacephone(
        self,
        phone,
        oldcaptcha,
        captcha,
        countrycode=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        用户绑定手机
        说明 : 登录后调用此接口 , 可以更换绑定手机
        必选参数 :
        phone : 手机号码
        oldcaptcha: 原手机号码的验证码
        captcha:新手机号码的验证码
        可选参数 :
        countrycode: 国家地区代码,默认 86
        接口地址 : /user/replacephone
        调用例子 : /user/replacephone?phone=xxx&captcha=1234&oldcaptcha=2345
        """
        return self.request(
            "/user/replacephone",
            cookie,
            env,
            phone=phone,
            oldcaptcha=oldcaptcha,
            captcha=captcha,
            countrycode=countrycode,
        )

    def user_update(
        self,
        gender,
        birthday,
        nickname,
        province,
        city,
        signature,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        更新用户信息
        说明 : 登录后调用此接口 , 传入相关信息,可以更新用户信息
        必选参数 :

        gender: 性别 0:保密 1:男性 2:女性
        birthday: 出生日期,时间戳 unix timestamp
        nickname: 用户昵称
        province: 省份id
        city: 城市id
        signature：用户签名

        接口地址 : /user/update
        调用例子 : /user/update?gender=0&signature=测试签名&city=440300&nickname=binary&birthday=1525918298004&province=440000
        """
        return self.request(
            "/user/update",
            cookie,
            env,
            gender=gender,
            birthday=birthday,
            nickname=nickname,
            province=province,
            city=city,
            signature=signature,
        )

    def avatar_upload(
        self, imgSize=None, imgX=None, imgY=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        更新头像
        说明 : 登录后调用此接口,使用'Content-Type': 'multipart/form-data'上传图片 formData(name 为'imgFile'),可更新头像(参考: https://gitlab.com/Binaryify/NeteaseCloudMusicApi/blob/main/public/avatar_update.html  ),支持命令行调用,参考module_example目录下avatar_upload.js
        可选参数 :
        imgSize : 图片尺寸,默认为 300
        imgX : 水平裁剪偏移,方形图片可不传,默认为 0
        imgY : 垂直裁剪偏移,方形图片可不传,默认为 0
        接口地址 : /avatar/upload
        调用例子 : /avatar/upload?imgSize=200
        """
        return self.request(
            "/avatar/upload", cookie, env, imgSize=imgSize, imgX=imgX, imgY=imgY
        )

    def pl_count(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        私信和通知接口
        说明 : 登录后调用此接口,可获取私信和通知数量信息
        接口地址 : /pl/count
        调用例子 : /pl/count
        """
        return self.request("/pl/count", cookie, env)

    def countries_code_list(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        国家编码列表
        说明 : 调用此接口,可获取国家编码列表
        接口地址 : /countries/code/list
        """
        return self.request("/countries/code/list", cookie, env)

    def user_playlist(
        self, uid, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取用户歌单
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户歌单
        必选参数 : uid : 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /user/playlist
        调用例子 : /user/playlist?uid=32953014
        """
        return self.request(
            "/user/playlist", cookie, env, uid=uid, limit=limit, offset=offset
        )

    def playlist_update(
        self, id, name, desc, tags, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        更新歌单
        说明 : 登录后调用此接口,可以更新用户歌单
        必选参数 :

        id:歌单id
        name:歌单名字
        desc:歌单描述
        tags:歌单tag ,多个用 ; 隔开,只能用官方规定标签

        接口地址 : /playlist/update
        调用例子 : /playlist/update?id=24381616&name=新歌单&desc=描述&tags=欧美
        """
        return self.request(
            "/playlist/update", cookie, env, id=id, name=name, desc=desc, tags=tags
        )

    def playlist_desc_update(
        self, id, desc, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        更新歌单描述
        说明 : 登录后调用此接口,可以单独更新用户歌单描述
        必选参数 :

        id:歌单id
        desc:歌单描述

        接口地址 : /playlist/desc/update
        调用例子 : /playlist/desc/update?id=24381616&desc=描述
        """
        return self.request("/playlist/desc/update", cookie, env, id=id, desc=desc)

    def playlist_name_update(
        self, id, name, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        更新歌单名
        说明 : 登录后调用此接口,可以单独更新用户歌单名
        必选参数 :

        id: 歌单id
        name: 歌单名

        接口地址 : /playlist/name/update
        调用例子 : /playlist/name/update?id=24381616&name=歌单名
        """
        return self.request("/playlist/name/update", cookie, env, id=id, name=name)

    def playlist_tags_update(
        self, id, tags, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        更新歌单标签
        说明 : 登录后调用此接口,可以单独更新用户歌单标签
        必选参数 :

        id: 歌单id
        tags: 歌单标签

        接口地址 : /playlist/tags/update
        调用例子 : /playlist/tags/update?id=24381616&tags=学习
        """
        return self.request("/playlist/tags/update", cookie, env, id=id, tags=tags)

    def playlist_cover_update(
        self,
        id,
        imgSize=None,
        imgX=None,
        imgY=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌单封面上传
        说明 : 登录后调用此接口,使用'Content-Type': 'multipart/form-data'上传图片 formData(name 为'imgFile'),可更新歌单封面(参考:https://gitlab.com/Binaryify/NeteaseCloudMusicApi/blob/main/public/playlist_cover_update.html)
        必选参数 :
        id: 歌单 id 3143833470
        可选参数 :
        imgSize : 图片尺寸,默认为 300
        imgX : 水平裁剪偏移,方形图片可不传,默认为 0
        imgY : 垂直裁剪偏移,方形图片可不传,默认为 0
        接口地址 : /playlist/cover/update
        调用例子 : /playlist/cover/update?id=3143833470&imgSize=200
        """
        return self.request(
            "/playlist/cover/update",
            cookie,
            env,
            id=id,
            imgSize=imgSize,
            imgX=imgX,
            imgY=imgY,
        )

    def playlist_order_update(
        self, ids, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        调整歌单顺序
        说明 : 登录后调用此接口,可以根据歌单 id 顺序调整歌单顺序
        必选参数 :
        ids: 歌单 id 列表
        接口地址 : /playlist/order/update
        调用例子 : /playlist/order/update?ids=[111,222]
        """
        return self.request("/playlist/order/update", cookie, env, ids=ids)

    def song_order_update(
        self, pid, ids, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        调整歌曲顺序
        说明 : 登录后调用此接口,可以根据歌曲 id 顺序调整歌曲顺序
        必选参数 :
        pid: 歌单 id
        ids: 歌曲 id 列表
        接口地址 : /song/order/update
        调用例子 : /song/order/update?pid=2039116066&ids=[5268328,1219871]
        """
        return self.request("/song/order/update", cookie, env, pid=pid, ids=ids)

    def user_comment_history(
        self, uid, limit=None, time=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取用户历史评论
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户历史评论
        必选参数 : uid : 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 10
        time: 上一条数据的 time,第一页不需要传,默认为 0
        接口地址 : /user/comment/history
        调用例子 : /user/comment/history?uid=32953014 /user/comment/history?uid=32953014&limit=1&time=1616217577564 (需要换成自己的用户 id)
        """
        return self.request(
            "/user/comment/history", cookie, env, uid=uid, limit=limit, time=time
        )

    def user_dj(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取用户电台
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户电台
        必选参数 : uid : 用户 id
        接口地址 : /user/dj
        调用例子 : /user/dj?uid=32953014
        """
        return self.request("/user/dj", cookie, env, uid=uid)

    def user_follows(
        self, uid, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取用户关注列表
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户关注列表
        必选参数 : uid : 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /user/follows
        调用例子 : /user/follows?uid=32953014
        """
        return self.request(
            "/user/follows", cookie, env, uid=uid, limit=limit, offset=offset
        )

    def user_followeds(
        self, uid, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取用户粉丝列表
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户粉丝列表
        必选参数 : uid : 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /user/followeds
        调用例子 : /user/followeds?uid=32953014 /user/followeds?uid=416608258&limit=1 /user/followeds?uid=416608258&limit=1&offset=1
        """
        return self.request(
            "/user/followeds", cookie, env, uid=uid, limit=limit, offset=offset
        )

    def user_event(
        self, uid, limit=None, lasttime=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取用户动态
        说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户动态
        必选参数 : uid : 用户 id
        可选参数 : limit : 返回数量 , 默认为 30
        lasttime : 返回数据的 lasttime ,默认-1,传入上一次返回结果的 lasttime,将会返回下一页的数据
        接口地址 : /user/event
        调用例子 : /user/event?uid=32953014 /user/event?uid=32953014&limit=1&lasttime=1558011138743
        返回结果的type参数对应:

        18 分享单曲
        19 分享专辑
        17、28 分享电台节目
        22 转发
        39 发布视频
        35、13 分享歌单
        24 分享专栏文章
        41、21 分享视频

        """
        return self.request(
            "/user/event", cookie, env, uid=uid, limit=limit, lasttime=lasttime
        )

    def event_forward(
        self, uid, evId, forwards, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        转发用户动态
        说明 : 登录后调用此接口 ,可以转发用户动态
        必选参数 : uid : 用户 id
        evId : 动态 id
        forwards : 转发的评论
        接口地址 : /event/forward
        调用例子 : /event/forward?evId=6712917601&uid=32953014&forwards=测试内容
        """
        return self.request(
            "/event/forward", cookie, env, uid=uid, evId=evId, forwards=forwards
        )

    def event_del(self, evId, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        删除用户动态
        说明 : 登录后调用此接口 ,可以删除用户动态
        必选参数 : evId : 动态 id
        接口地址 : /event/del
        调用例子 : /event/del?evId=6712917601
        """
        return self.request("/event/del", cookie, env, evId=evId)

    def share_resource(
        self, id, type=None, msg=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        分享文本、歌曲、歌单、mv、电台、电台节目到动态
        说明 : 登录后调用此接口 ,可以分享文本、歌曲、歌单、mv、电台、电台节目,专辑到动态
        必选参数 : id : 资源 id （歌曲，歌单，mv，电台，电台节目对应 id）
        可选参数 : type: 资源类型，默认歌曲 song，可传 song,playlist,mv,djradio,djprogram, album
        msg: 内容，140 字限制，支持 emoji，@用户名（/user/follows接口获取的用户名，用户名后和内容应该有空格），图片暂不支持
        接口地址 : /share/resource
        调用例子 : /share/resource?id=1297494209&msg=测试 /share/resource?type=djradio&id=336355127 /share/resource?type=djprogram&id=2061034798 /share/resource?type=djprogram&id=2061034798&msg=测试@binaryify 测试 /share/resource?type=noresource&msg=测试
        """
        return self.request("/share/resource", cookie, env, id=id, type=type, msg=msg)

    def comment_event(self, threadId, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取动态评论
        说明 : 登录后调用此接口 , 可以获取动态下评论
        必选参数 : threadId : 动态 id，可通过 /event，/user/event 接口获取
        接口地址 : /comment/event
        调用例子 : /comment/event?threadId=A_EV_2_6559519868_32953014
        """
        return self.request("/comment/event", cookie, env, threadId=threadId)

    def follow(self, id, t, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        关注/取消关注用户
        说明 : 登录后调用此接口 , 传入用户 id, 和操作 t,可关注/取消关注用户
        必选参数 :
        id : 用户 id
        t : 1为关注,其他为取消关注
        接口地址 : /follow
        调用例子 : /follow?id=32953014&t=1
        """
        return self.request("/follow", cookie, env, id=id, t=t)

    def user_record(
        self, uid, type=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取用户播放记录
        说明 : 登录后调用此接口 , 传入用户 id, 可获取用户播放记录
        必选参数 : uid : 用户 id
        可选参数 : type : type=1 时只返回 weekData, type=0 时返回 allData
        接口地址 : /user/record
        调用例子 : /user/record?uid=32953014&type=1
        """
        return self.request("/user/record", cookie, env, uid=uid, type=type)

    def hot_topic(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取热门话题
        说明 : 调用此接口 , 可获取热门话题
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        接口地址 : /hot/topic
        调用例子 : /hot/topic?limit=30&offset=30
        """
        return self.request("/hot/topic", cookie, env, limit=limit, offset=offset)

    def topic_detail(
        self, actid=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取话题详情
        说明 : 调用此接口 , 可获取话题详情
        接口地址 : /topic/detail
        调用例子 : /topic/detail?actid=111551188
        """
        return self.request("/topic/detail", cookie, env, actid=actid)

    def topic_detail_event_hot(
        self, actid=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取话题详情热门动态
        说明 : 调用此接口 , 可获取话题详情热门动态
        接口地址 : /topic/detail/event/hot
        调用例子 : /topic/detail/event/hot?actid=111551188
        """
        return self.request("/topic/detail/event/hot", cookie, env, actid=actid)

    def comment_hotwall_list(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云村热评(官方下架,暂不能用)
        说明 : 登录后调用此接口 , 可获取云村热评
        接口地址 : /comment/hotwall/list
        调用例子 : /comment/hotwall/list
        """
        return self.request("/comment/hotwall/list", cookie, env)

    def playmode_intelligence_list(
        self, id, pid, sid=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        心动模式/智能播放
        说明 : 登录后调用此接口 , 可获取心动模式/智能播放列表
        必选参数 : id : 歌曲 id
        pid : 歌单 id
        可选参数 :
        sid : 要开始播放的歌曲的 id
        接口地址 : /playmode/intelligence/list
        调用例子 : /playmode/intelligence/list?id=33894312&pid=24381616 , /playmode/intelligence/list?id=33894312&pid=24381616&sid=36871368
        """
        return self.request(
            "/playmode/intelligence/list", cookie, env, id=id, pid=pid, sid=sid
        )

    def event(
        self, pagesize, lasttime, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取动态列表
        说明 : 调用此接口 , 可获取各种动态 , 对应网页版网易云，朋友界面里的各种动态消息
        ，如分享的视频，音乐，照片等！
        必选参数 :
        pagesize : 每页数据,默认 20
        lasttime : 返回数据的 lasttime ,默认-1,传入上一次返回结果的 lasttime,将会返回下一页的数据
        接口地址 : /event
        调用例子 : /event?pagesize=30&lasttime=1556740526369
        """
        return self.request("/event", cookie, env, pagesize=pagesize, lasttime=lasttime)

    def artist_list(
        self,
        limit=None,
        offset=None,
        initial=None,
        type=None,
        area=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌手分类列表
        说明 : 调用此接口,可获取歌手分类列表
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如
         如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        initial: 按首字母索引查找参数,如 /artist/list?type=1&area=96&initial=b 返回内容将以 name 字段开头为 b 或者拼音开头为 b 为顺序排列, 热门传-1,#传 0
        type 取值:

        -1:全部
        1:男歌手
        2:女歌手
        3:乐队

        area 取值:

        -1:全部
        7华语
        96欧美
        8:日本
        16韩国
        0:其他

        接口地址 : /artist/list
        调用例子 : /artist/list?type=1&area=96&initial=b /artist/list?type=2&area=2&initial=b
        """
        return self.request(
            "/artist/list",
            cookie,
            env,
            limit=limit,
            offset=offset,
            initial=initial,
            type=type,
            area=area,
        )

    def artist_sub(self, id, t, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        收藏/取消收藏歌手
        说明 : 调用此接口,可收藏歌手
        必选参数 :
        id : 歌手 id
        t:操作,1 为收藏,其他为取消收藏
        接口地址 : /artist/sub
        调用例子 : /artist/sub?id=6452&t=1
        """
        return self.request("/artist/sub", cookie, env, id=id, t=t)

    def artist_top_song(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌手热门 50 首歌曲
        说明 : 调用此接口,可获取歌手热门 50 首歌曲
        必选参数 :
        id : 歌手 id
        接口地址 : /artist/top/song
        调用例子 : /artist/top/song?id=6452
        """
        return self.request("/artist/top/song", cookie, env, id=id)

    def artist_songs(
        self,
        id,
        order=None,
        limit=None,
        offset=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌手全部歌曲
        说明 : 调用此接口,可获取歌手全部歌曲
        必选参数 :
        id : 歌手 id
        可选参数 :
        order : hot ,time 按照热门或者时间排序
        limit: 取出歌单数量 , 默认为 50
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*50, 其中 50 为 limit 的值
        接口地址 : /artist/songs
        调用例子 : /artist/songs?id=6452
        """
        return self.request(
            "/artist/songs", cookie, env, id=id, order=order, limit=limit, offset=offset
        )

    def artist_sublist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        收藏的歌手列表
        说明 : 调用此接口,可获取收藏的歌手列表
        可选参数 :
        limit: 取出歌单数量 , 默认为 25
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*25, 其中 25 为 limit 的值
        接口地址 : /artist/sublist
        调用例子 : /artist/sublist
        """
        return self.request("/artist/sublist", cookie, env, limit=limit, offset=offset)

    def topic_sublist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        收藏的专栏
        说明 : 调用此接口,可获取收藏的专栏
        可选参数 :
        limit: 取出歌单数量 , 默认为 50
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*50, 其中 50 为 limit 的值
        接口地址 : /topic/sublist
        调用例子 : /topic/sublist?limit=2&offset=1
        """
        return self.request("/topic/sublist", cookie, env, limit=limit, offset=offset)

    def video_sub(self, id, t, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        收藏视频
        说明 : 调用此接口,可收藏视频
        必选参数 :
        id : 视频 id
        t : 1 为收藏,其他为取消收藏
        接口地址 : /video/sub
        调用例子 : /video/sub
        """
        return self.request("/video/sub", cookie, env, id=id, t=t)

    def mv_sub(self, mvid, t, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        收藏/取消收藏 MV
        说明 : 调用此接口,可收藏/取消收藏 MV
        必选参数 :
        mvid : MV id
        t : 1 为收藏,其他为取消收藏
        接口地址 : /mv/sub
        调用例子 : /mv/sub
        """
        return self.request("/mv/sub", cookie, env, mvid=mvid, t=t)

    def mv_sublist(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        收藏的 MV 列表
        说明 : 调用此接口,可获取收藏的 MV 列表
        接口地址 : /mv/sublist
        调用例子 : /mv/sublist
        """
        return self.request("/mv/sublist", cookie, env)

    def playlist_catlist(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌单分类
        说明 : 调用此接口,可获取歌单分类,包含 category 信息
        接口地址 : /playlist/catlist
        调用例子 : /playlist/catlist
        """
        return self.request("/playlist/catlist", cookie, env)

    def playlist_hot(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        热门歌单分类
        说明 : 调用此接口,可获取歌单分类,包含 category 信息
        接口地址 : /playlist/hot
        调用例子 : /playlist/hot
        """
        return self.request("/playlist/hot", cookie, env)

    def top_playlist(
        self,
        order=None,
        cat=None,
        limit=None,
        offset=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌单 ( 网友精选碟 )
        说明 : 调用此接口 , 可获取网友精选碟歌单
        可选参数 : order: 可选值为 'new' 和 'hot', 分别对应最新和最热 , 默认为
        'hot'
        cat: tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为
        "全部",可从歌单分类接口获取(/playlist/catlist)
        limit: 取出歌单数量 , 默认为 50
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*50, 其中 50 为 limit 的值
        接口地址 : /top/playlist
        调用例子 : /top/playlist?limit=10&order=new
        """
        return self.request(
            "/top/playlist",
            cookie,
            env,
            order=order,
            cat=cat,
            limit=limit,
            offset=offset,
        )

    def playlist_highquality_tags(
        self, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        精品歌单标签列表
        说明 : 调用此接口 , 可获取精品歌单标签列表
        接口地址 : /playlist/highquality/tags
        调用例子 : /playlist/highquality/tags
        """
        return self.request("/playlist/highquality/tags", cookie, env)

    def top_playlist_highquality(
        self, cat=None, limit=None, before=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取精品歌单
        说明 : 调用此接口 , 可获取精品歌单
        可选参数 : cat: tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为
        "全部",可从精品歌单标签列表接口获取(/playlist/highquality/tags)
        limit: 取出歌单数量 , 默认为 50
        before: 分页参数,取上一页最后一个歌单的 updateTime 获取下一页数据
        接口地址 : /top/playlist/highquality
        调用例子 : /top/playlist/highquality?before=1503639064232&limit=3
        """
        return self.request(
            "/top/playlist/highquality",
            cookie,
            env,
            cat=cat,
            limit=limit,
            before=before,
        )

    def related_playlist(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        相关歌单
        说明: 请替换为[相关歌单推荐](#相关歌单推荐)接口; 本接口通过html抓取内容, 现已无法抓取歌单
        ~~说明 : 调用此接口,传入歌单 id 可获取相关歌单(对应页面 [https://music.163.com/#/playlist?id=1](https://music.163.com/#/playlist?id=1))~~
        ~~必选参数 : id : 歌单 id~~
        ~~接口地址 : /related/playlist~~
        ~~调用例子 : /related/playlist?id=1~~
        """
        return self.request("/related/playlist", cookie, env, id=id)

    def playlist_detail(
        self, id, s=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取歌单详情
        说明 : 歌单能看到歌单名字, 但看不到具体歌单内容 , 调用此接口 , 传入歌单 id, 可
        以获取对应歌单内的所有的音乐(未登录状态只能获取不完整的歌单,登录后是完整的)，但是返回的 trackIds 是完整的，tracks 则是不完整的，可拿全部 trackIds 请求一次 song/detail 接口获取所有歌曲的详情 ([https://github.com/Binaryify/NeteaseCloudMusicApi/issues/452](https://github.com/Binaryify/NeteaseCloudMusicApi/issues/452))
        必选参数 : id : 歌单 id
        可选参数 : s : 歌单最近的 s 个收藏者,默认为 8
        接口地址 : /playlist/detail
        调用例子 : /playlist/detail?id=24381616
        """
        return self.request("/playlist/detail", cookie, env, id=id, s=s)

    def playlist_track_all(
        self, id, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取歌单所有歌曲
        说明 : 由于网易云接口限制，歌单详情只会提供 10 首歌，通过调用此接口，传入对应的歌单id，即可获得对应的所有歌曲
        必选参数 : id : 歌单 id
        可选参数 : limit : 限制获取歌曲的数量，默认值为当前歌单的歌曲数量
        可选参数 : offset : 默认值为0
        接口地址 : /playlist/track/all
        调用例子 : /playlist/track/all?id=24381616&limit=10&offset=1
        > 注：关于offset，你可以这样理解，假设你当前的歌单有200首歌
        >
        > 你传入limit=50&offset=0等价于limit=50，你会得到第1-50首歌曲
        > 你传入limit=50&offset=50，你会得到第51-100首歌曲
        > 如果你设置limit=50&offset=100，你就会得到第101-150首歌曲
        """
        return self.request(
            "/playlist/track/all", cookie, env, id=id, limit=limit, offset=offset
        )

    def playlist_detail_dynamic(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌单详情动态
        说明 : 调用后可获取歌单详情动态部分,如评论数,是否收藏,播放数
        必选参数 : id : 歌单 id
        接口地址 : /playlist/detail/dynamic
        调用例子 : /playlist/detail/dynamic?id=24381616
        """
        return self.request("/playlist/detail/dynamic", cookie, env, id=id)

    def playlist_update_playcount(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌单更新播放量
        说明 : 调用后可更新歌单播放量
        必选参数 : id : 歌单 id
        接口地址 : /playlist/update/playcount
        调用例子 : /playlist/update/playcount?id=24381616
        """
        return self.request("/playlist/update/playcount", cookie, env, id=id)

    def song_url(self, id, br=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取音乐 url
        说明 : 使用歌单详情接口后 , 能得到的音乐的 id, 但不能得到的音乐 url, 调用此接口, 传入的音乐 id( 可多个 , 用逗号隔开 ), 可以获取对应的音乐的 url,未登录状态或者非会员返回试听片段(返回字段包含被截取的正常歌曲的开始时间和结束时间)
        遇到 403 错误时，请在 head 标签内加入 <meta name="referrer" content="no-referrer">
        必选参数 : id : 音乐 id
        可选参数 : br: 码率,默认设置了 999000 即最大码率,如果要 320k 则可设置为 320000,其他类推
        接口地址 : /song/url
        调用例子 : /song/url?id=33894312 /song/url?id=405998841,33894312
        """
        return self.request("/song/url", cookie, env, id=id, br=br)

    def song_url_v1(self, id, level, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取音乐 url - 新版
        说明 : 使用注意事项同上
        必选参数 : id : 音乐 id
        level: 播放音质等级, 分为 standard => 标准,higher => 较高, exhigh=>极高,
        lossless=>无损, hires=>Hi-Res, jyeffect => 高清环绕声, sky => 沉浸环绕声, dolby => 杜比全景声, jymaster => 超清母带
        接口地址 : /song/url/v1
        调用例子 : /song/url/v1?id=33894312&level=exhigh /song/url/v1?id=405998841,33894312&level=lossless
        说明：杜比全景声音质需要设备支持，不同的设备可能会返回不同码率的url。cookie需要传入os=pc保证返回正常码率的url。
        """
        return self.request("/song/url/v1", cookie, env, id=id, level=level)

    def check_music(
        self, id, br=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        音乐是否可用
        说明: 调用此接口,传入歌曲 id, 可获取音乐是否可用,返回 { success: true, message: 'ok' } 或者 { success: false, message: '亲爱的,暂无版权' }
        必选参数 : id : 歌曲 id
        可选参数 : br: 码率,默认设置了 999000 即最大码率,如果要 320k 则可设置为 320000,其他类推
        接口地址 : /check/music
        调用例子 : /check/music?id=33894312
        """
        return self.request("/check/music", cookie, env, id=id, br=br)

    def search(
        self,
        keywords,
        limit=None,
        offset=None,
        type=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        搜索
        说明 : 调用此接口 , 传入搜索关键词可以搜索该音乐 / 专辑 / 歌手 / 歌单 / 用户 ,
        关键词可以多个 , 以空格隔开 , 如 " 周杰伦 搁浅 "( 不需要登录 ), 可通过 /song/url 接口传入歌曲 id 获取具体的播放链接
        必选参数 : keywords : 关键词
        可选参数 : limit : 返回数量 , 默认为 30 offset : 偏移数量，用于分页 , 如
         如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        type: 搜索类型；默认为 1 即单曲 , 取值意义 : 1: 单曲, 10: 专辑, 100: 歌手, 1000:
        歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频, 1018:综合, 2000:声音(搜索声音返回字段格式会不一样)
        接口地址 : /search 或者 /cloudsearch(更全)
        调用例子 : /search?keywords=海阔天空 /cloudsearch?keywords=海阔天空
        """
        return self.request(
            "/search",
            cookie,
            env,
            keywords=keywords,
            limit=limit,
            offset=offset,
            type=type,
        )

    def search_default(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        默认搜索关键词
        说明 : 调用此接口 , 可获取默认搜索关键词
        接口地址 : /search/default
        """
        return self.request("/search/default", cookie, env)

    def search_hot(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        热搜列表(简略)
        说明 : 调用此接口,可获取热门搜索列表
        接口地址 : /search/hot
        调用例子 : /search/hot
        """
        return self.request("/search/hot", cookie, env)

    def search_hot_detail(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        热搜列表(详细)
        说明 : 调用此接口,可获取热门搜索列表
        接口地址 : /search/hot/detail
        调用例子 : /search/hot/detail
        """
        return self.request("/search/hot/detail", cookie, env)

    def search_suggest(
        self, keywords, type=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        搜索建议
        说明 : 调用此接口 , 传入搜索关键词可获得搜索建议 , 搜索结果同时包含单曲 , 歌手 , 歌单信息
        必选参数 : keywords : 关键词
        可选参数 : type : 如果传 'mobile' 则返回移动端数据
        接口地址 : /search/suggest
        调用例子 : /search/suggest?keywords=海阔天空 /search/suggest?keywords=海阔天空&type=mobile
        """
        return self.request(
            "/search/suggest", cookie, env, keywords=keywords, type=type
        )

    def search_multimatch(
        self, keywords, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        搜索多重匹配
        说明 : 调用此接口 , 传入搜索关键词可获得搜索结果
        必选参数 : keywords : 关键词
        接口地址 : /search/multimatch
        调用例子 : /search/multimatch?keywords=海阔天空
        """
        return self.request("/search/multimatch", cookie, env, keywords=keywords)

    def playlist_create(
        self, name, privacy=None, type=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        新建歌单
        说明 : 调用此接口 , 传入歌单名字可新建歌单
        必选参数 : name : 歌单名
        可选参数 :
        privacy : 是否设置为隐私歌单，默认否，传'10'则设置成隐私歌单
        type : 歌单类型,默认'NORMAL',传 'VIDEO'则为视频歌单,传 'SHARED'则为共享歌单
        接口地址 : /playlist/create
        调用例子 : /playlist/create?name=测试歌单,/playlist/create?name=test&type=VIDEO
        """
        return self.request(
            "/playlist/create", cookie, env, name=name, privacy=privacy, type=type
        )

    def playlist_delete(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        删除歌单
        说明 : 调用此接口 , 传入歌单 id 可删除歌单
        必选参数 : id : 歌单 id,可多个,用逗号隔开
        接口地址 : /playlist/delete
        调用例子 : /playlist/delete?id=2947311456 , /playlist/delete?id=5013464397,5013427772
        """
        return self.request("/playlist/delete", cookie, env, id=id)

    def playlist_subscribe(
        self, t, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        收藏/取消收藏歌单
        说明 : 调用此接口 , 传入类型和歌单 id 可收藏歌单或者取消收藏歌单
        必选参数 :
        t : 类型,1:收藏,2:取消收藏
        id : 歌单 id
        接口地址 : /playlist/subscribe
        调用例子 : /playlist/subscribe?t=1&id=106697785 /playlist/subscribe?t=2&id=106697785
        """
        return self.request("/playlist/subscribe", cookie, env, t=t, id=id)

    def playlist_subscribers(
        self, id, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌单收藏者
        说明 : 调用此接口 , 传入歌单 id 可获取歌单的所有收藏者
        必选参数 :
        id : 歌单 id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        接口地址 : /playlist/subscribers
        调用例子 : /playlist/subscribers?id=544215255&limit=30
        """
        return self.request(
            "/playlist/subscribers", cookie, env, id=id, limit=limit, offset=offset
        )

    def playlist_tracks(
        self, op, pid, tracks, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        对歌单添加或删除歌曲
        说明 : 调用此接口 , 可以添加歌曲到歌单或者从歌单删除某首歌曲 ( 需要登录 )
        必选参数 :
        op: 从歌单增加单曲为 add, 删除为 del
        pid: 歌单 id
        tracks: 歌曲 id,可多个,用逗号隔开
        接口地址 : /playlist/tracks
        调用例子 : /playlist/tracks?op=add&pid=24381616&tracks=347231 ( 对应把歌曲添加到 ' 我 ' 的歌单 , 测试的时候请把这里的 pid 换成你自己的, id 和 tracks 不对可能会报 502 错误)
        """
        return self.request(
            "/playlist/tracks", cookie, env, op=op, pid=pid, tracks=tracks
        )

    def playlist_track_add(
        self, pid, ids, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        收藏视频到视频歌单
        说明 : 调用此接口 , 可收藏视频到视频歌单 ( 需要登录 )
        必选参数 :
        pid : 歌单 id
        ids : 视频 id,支持多个,用,隔开
        接口地址 : /playlist/track/add
        调用例子 : /playlist/track/add?pid=5271999357&ids=186041
        """
        return self.request("/playlist/track/add", cookie, env, pid=pid, ids=ids)

    def playlist_track_delete(
        self, pid, ids, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        删除视频歌单里的视频
        说明 : 调用此接口 , 可删除视频歌单里的视频 ( 需要登录 )
        必选参数 :
        pid : 歌单 id
        ids : 视频 id,支持多个,用,隔开
        接口地址 : /playlist/track/delete
        调用例子 : /playlist/track/delete?pid=5271999357&ids=186041
        """
        return self.request("/playlist/track/delete", cookie, env, pid=pid, ids=ids)

    def playlist_video_recent(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        最近播放的视频
        说明 : 调用此接口 , 可获取最近播放的视频 ( 需要登录 )
        接口地址 : /playlist/video/recent
        调用例子 : /playlist/video/recent
        """
        return self.request("/playlist/video/recent", cookie, env)

    def lyric(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取歌词
        说明 : 调用此接口 , 传入音乐 id 可获得对应音乐的歌词 ( 不需要登录 )
        必选参数 : id: 音乐 id
        接口地址 : /lyric
        调用例子 : /lyric?id=33894312
        """
        return self.request("/lyric", cookie, env, id=id)

    def lyric_new(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取逐字歌词
        说明 : 此接口的 yrc 字段即为逐字歌词 (可能有歌曲不包含逐字歌词)
        必选参数 : id: 音乐 id
        接口地址 : /lyric/new
        调用例子 : /lyric/new?id=1824020871
        相关讨论可见: [Issue](https://github.com/Binaryify/NeteaseCloudMusicApi/issues/1667)
        歌词格式解析 :
        当逐字歌词适用时，yrc的lyric字段包括形式如下的内容
        * （可能存在）JSON 歌曲元数据

        {"t":0,"c":[{"tx":"作曲: "},{"tx":"柳重言","li":"http://p1.music.126.net/Icj0IcaOjH2ZZpyAM-QGoQ==/6665239487822533.jpg","or":"orpheus://nm/artist/home?id=228547&type=artist"}]}
        {"t":5403,"c":[{"tx":"编曲: "},{"tx":"Alex San","li":"http://p1.music.126.net/pSbvYkrzZ1RFKqoh-fA9AQ==/109951166352922615.jpg","or":"orpheus://nm/artist/home?id=28984845&type=artist"}]}
        {"t":10806,"c":[{"tx":"制作人: "},{"tx":"王菲","li":"http://p1.music.126.net/1KQVD6XWbs5IAV0xOj1ZIA==/18764265441342019.jpg","or":"orpheus://nm/artist/home?id=9621&type=artist"},{"tx":"/"},{"tx":"梁荣骏","li":"http://p1.music.126.net/QrD8drwrRcegfKLPoiiG2Q==/109951166288436155.jpg","or":"orpheus://nm/artist/home?id=189294&type=artist"}]}

        该字段不一定出现；可能出现的数据意义有：
        - t : 数据显示开始时间戳 (毫秒)
        - c : 元数据list
        - tx: 文字段
        - li: 艺术家、歌手头像图url
        - or：云音乐app内路径；例中作用即打开艺术家主页
        * 逐字歌词

        [16210,3460](16210,670,0)还(16880,410,0)没...
        ~~~~1 ~~~2  ~~~~3 ~~4 5 ~6 (...)

        由标号解释:
        1. 歌词行显示开始时间戳 (毫秒)
        2. 歌词行显示总时长(毫秒)
        3. 逐字显示开始时间戳 (毫秒)
        4. 逐字显示时长 (厘秒/0.01s)
        5. 未知
        6. 文字
        yrc的version字段貌似与lyric字段格式无关
        """
        return self.request("/lyric/new", cookie, env, id=id)

    def top_song(self, type, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        新歌速递
        说明 : 调用此接口 , 可获取新歌速递
        必选参数 :
        type: 地区类型 id,对应以下:

        全部:0
        华语:7
        欧美:96
        日本:8
        韩国:16

        接口地址 : /top/song
        调用例子 : /top/song?type=96
        """
        return self.request("/top/song", cookie, env, type=type)

    def homepage_block_page(
        self, refresh=None, cursor=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        首页-发现
        说明 : 调用此接口 , 可获取 APP 首页信息
        接口地址 : /homepage/block/page
        可选参数 : refresh: 是否刷新数据,默认为 false
        cursor: 上一条数据返回的 cursor
        """
        return self.request(
            "/homepage/block/page", cookie, env, refresh=refresh, cursor=cursor
        )

    def homepage_dragon_ball(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        首页-发现-圆形图标入口列表
        说明 : 调用此接口 , 可获取 APP 首页圆形图标入口列表
        接口地址 : /homepage/dragon/ball
        """
        return self.request("/homepage/dragon/ball", cookie, env)

    def comment_music(
        self,
        id,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌曲评论
        说明 : 调用此接口 , 传入音乐 id 和 limit 参数 , 可获得该音乐的所有评论 ( 不需要登录 )
        必选参数 : id: 音乐 id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/music
        调用例子 : /comment/music?id=186016&limit=1 对应晴天评论
        """
        return self.request(
            "/comment/music",
            cookie,
            env,
            id=id,
            limit=limit,
            offset=offset,
            before=before,
        )

    def comment_floor(
        self,
        parentCommentId,
        id,
        type,
        limit=None,
        time=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        楼层评论
        说明 : 调用此接口 , 传入资源 parentCommentId 和资源类型 type 和资源 id 参数, 可获得该资源的歌曲楼层评论
        必选参数 :
        parentCommentId: 楼层评论 id
        id : 资源 id
        type: 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台节目
        5: 视频
        6: 动态
        7: 电台

        可选参数 : limit: 取出评论数量 , 默认为 20
        time: 分页参数,取上一页最后一项的 time 获取下一页数据
        接口地址 : /comment/floor
        调用例子 : /comment/floor?parentCommentId=1438569889&id=29764564&type=0
        """
        return self.request(
            "/comment/floor",
            cookie,
            env,
            parentCommentId=parentCommentId,
            id=id,
            type=type,
            limit=limit,
            time=time,
        )

    def comment_album(
        self,
        id,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        专辑评论
        说明 : 调用此接口 , 传入音乐 id 和 limit 参数 , 可获得该专辑的所有评论 ( 不需要
        登录 )
        必选参数 : id: 专辑 id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/album
        调用例子 : /comment/album?id=32311
        """
        return self.request(
            "/comment/album",
            cookie,
            env,
            id=id,
            limit=limit,
            offset=offset,
            before=before,
        )

    def comment_playlist(
        self,
        id,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌单评论
        说明 : 调用此接口 , 传入音乐 id 和 limit 参数 , 可获得该歌单的所有评论 ( 不需要
        登录 )
        必选参数 : id: 歌单 id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/playlist
        调用例子 : /comment/playlist?id=705123491
        """
        return self.request(
            "/comment/playlist",
            cookie,
            env,
            id=id,
            limit=limit,
            offset=offset,
            before=before,
        )

    def comment_mv(
        self,
        id,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        mv 评论
        说明 : 调用此接口 , 传入音乐 id 和 limit 参数 , 可获得该 mv 的所有评论 ( 不需要
        登录 )
        必选参数 : id: mv id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/mv
        调用例子 : /comment/mv?id=5436712
        """
        return self.request(
            "/comment/mv", cookie, env, id=id, limit=limit, offset=offset, before=before
        )

    def comment_dj(
        self,
        id,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        电台节目评论
        说明 : 调用此接口 , 传入音乐 id 和 limit 参数 , 可获得该 电台节目 的所有评论 (
        不需要登录 )
        必选参数 : id: 电台节目的 id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/dj
        调用例子 : /comment/dj?id=794062371
        """
        return self.request(
            "/comment/dj", cookie, env, id=id, limit=limit, offset=offset, before=before
        )

    def comment_video(
        self,
        id,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        视频评论
        说明 : 调用此接口 , 传入音乐 id 和 limit 参数 , 可获得该 视频 的所有评论 (
        不需要登录 )
        必选参数 : id: 视频的 id
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/video
        调用例子 : /comment/video?id=89ADDE33C0AAE8EC14B99F6750DB954D
        """
        return self.request(
            "/comment/video",
            cookie,
            env,
            id=id,
            limit=limit,
            offset=offset,
            before=before,
        )

    def comment_hot(
        self,
        id,
        type,
        limit=None,
        offset=None,
        before=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        热门评论
        说明 : 调用此接口 , 传入 type, 资源 id 可获得对应资源热门评论 ( 不需要登录 )
        必选参数 :
        id : 资源 id
        type: 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台节目
        5: 视频
        6: 动态
        7: 电台

        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*20, 其中 20 为 limit 的值
        before: 分页参数,取上一页最后一项的 time 获取下一页数据(获取超过 5000 条评论的时候需要用到)
        接口地址 : /comment/hot
        调用例子 : /comment/hot?id=186016&type=0
        """
        return self.request(
            "/comment/hot",
            cookie,
            env,
            id=id,
            type=type,
            limit=limit,
            offset=offset,
            before=before,
        )

    def comment_new(
        self,
        id,
        type,
        pageNo=None,
        pageSize=None,
        sortType=None,
        cursor=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        新版评论接口
        说明 : 调用此接口 , 传入资源类型和资源 id,以及排序方式,可获取对应资源的评论
        必选参数 :
        id : 资源 id, 如歌曲 id,mv id
        type: 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台节目
        5: 视频
        6: 动态
        7: 电台

        可选参数 :
        pageNo:分页参数,第 N 页,默认为 1
        pageSize:分页参数,每页多少条数据,默认 20
        sortType: 排序方式, 1:按推荐排序, 2:按热度排序, 3:按时间排序
        cursor: 当sortType为 3 时且页数不是第一页时需传入,值为上一条数据的 time
        接口地址 : /comment/new
        调用例子 : /comment/new?type=0&id=1407551413&sortType=3, /comment/new?type=0&id=1407551413&sortType=3&cursor=1602072870260&pageSize=20&pageNo=2
        """
        return self.request(
            "/comment/new",
            cookie,
            env,
            id=id,
            type=type,
            pageNo=pageNo,
            pageSize=pageSize,
            sortType=sortType,
            cursor=cursor,
        )

    def comment_like(
        self, id, cid, t, type, threadId=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        给评论点赞
        说明 : 调用此接口 , 传入 type, 资源 id, 和评论 id cid 和 是否点赞参数 t 即可给对
        应评论点赞 ( 需要登录 )
        必选参数 : id : 资源 id, 如歌曲 id,mv id
        cid : 评论 id
        t : 是否点赞 , 1 为点赞 ,0 为取消点赞
        type: 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台节目
        5: 视频
        6: 动态
        7: 电台

        接口地址 : /comment/like
        调用例子 : /comment/like?id=29178366&cid=12840183&t=1&type=0 对应给 [https://music.163.com/#/song?id=29178366](https://music.163.com/#/song?id=29178366) 最热门的评论点赞
        注意： 动态点赞不需要传入 id 参数，需要传入动态的 threadId 参数,如：/comment/like?type=6&cid=1419532712&threadId=A_EV_2_6559519868_32953014&t=0， threadId 可通过 /event，/user/event 接口获取
        """
        return self.request(
            "/comment/like",
            cookie,
            env,
            id=id,
            cid=cid,
            t=t,
            type=type,
            threadId=threadId,
        )

    def hug_comment(
        self, uid, cid, sid, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        抱一抱评论
        说明 : 调用此接口,可抱一抱评论
        必选参数 :
        uid: 用户 id
        cid: 评论 id
        sid: 资源 id
        接口地址 : /hug/comment
        调用例子 : /hug/comment?uid=285516405&cid=1167145843&sid=863481066
        """
        return self.request("/hug/comment", cookie, env, uid=uid, cid=cid, sid=sid)

    def comment_hug_list(
        self,
        uid,
        cid,
        sid,
        page=None,
        cursor=None,
        idCursor=None,
        pageSize=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        评论抱一抱列表
        说明 : 调用此接口,可获取评论抱一抱列表
        必选参数 :
        uid: 用户 id
        cid: 评论 id
        sid: 资源 id
        可选参数 :
        page: 页数
        cursor: 上一页返回的 cursor,默认-1,第一页不需要传
        idCursor: 上一页返回的 idCursor,默认-1,第一页不需要传
        pageSize : 每页页数,默认 100
        接口地址 : /comment/hug/list
        调用例子 : /comment/hug/list?uid=285516405&cid=1167145843&sid=863481066&pageSize=2&page=1
        """
        return self.request(
            "/comment/hug/list",
            cookie,
            env,
            uid=uid,
            cid=cid,
            sid=sid,
            page=page,
            cursor=cursor,
            idCursor=idCursor,
            pageSize=pageSize,
        )

    def comment(
        self,
        t,
        type,
        id,
        content,
        commentId=None,
        threadId=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        发送/删除评论
        说明 : 调用此接口,可发送评论或者删除评论
        接口地址 : /comment
        1. 发送评论
        必选参数
        t:1 发送, 2 回复
        type: 数字,资源类型,对应歌曲,mv,专辑,歌单,电台,视频对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台
        5: 视频
        6: 动态

        id:对应资源 id
        content :要发送的内容
        commentId :回复的评论 id (回复评论时必填)
        调用例子 : /comment?t=1&type=1&id=5436712&content=test (往广岛之恋 mv 发送评论: test)
        注意：如给动态发送评论，则不需要传 id，需要传动态的 threadId,如：/comment?t=1&type=6&threadId=A_EV_2_6559519868_32953014&content=test
        2. 删除评论
        必选参数
        t:0 删除
        type: 数字,资源类型,对应歌曲,mv,专辑,歌单,电台,视频对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台节目
        5: 视频
        6: 动态
        7: 电台

        id:对应资源 id
        content :内容 id,可通过 /comment/mv 等接口获取
        调用例子 : /comment?t=0&type=1&id=5436712&commentId=1535550516319 (在广岛之恋 mv 删除评论)
        注意：如给动态删除评论，则不需要传 id，需要传动态的 threadId,如：/comment?t=0&type=6&threadId=A_EV_2_6559519868_32953014&commentId=1419516382
        """
        return self.request(
            "/comment",
            cookie,
            env,
            t=t,
            type=type,
            id=id,
            content=content,
            commentId=commentId,
            threadId=threadId,
        )

    def banner(self, type=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        banner
        说明 : 调用此接口 , 可获取 banner( 轮播图 ) 数据
        可选参数 :
        type:资源类型,对应以下类型,默认为 0 即 PC

        0: pc
        1: android
        2: iphone
        3: ipad

        接口地址 : /banner
        调用例子 : /banner, /banner?type=2
        """
        return self.request("/banner", cookie, env, type=type)

    def resource_like(
        self, type, t, id=None, threadId=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        资源点赞( MV,电台,视频)
        说明 : 调用此接口 , 可对 MV,电台,视频点赞
        必选参数 :
        type:资源类型,对应以下类型

        0: 歌曲
        1: mv
        2: 歌单
        3: 专辑
        4: 电台节目
        5: 视频
        6: 动态
        7: 电台

        t: 操作,1 为点赞,其他为取消点赞
        id: 资源 id
        接口地址 : /resource/like
        调用例子 : /resource/like?t=1&type=1&id=5436712
        注意：如给动态点赞，不需要传入 id，需要传入 threadId,可通过 event,/user/event 接口获取，如：
        /resource/like?t=1&type=6&threadId=A_EV_2_6559519868_32953014
        """
        return self.request(
            "/resource/like", cookie, env, type=type, t=t, id=id, threadId=threadId
        )

    def playlist_mylike(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取点赞过的视频
        说明 : 调用此接口, 可获取获取点赞过的视频
        接口地址 : /playlist/mylike
        调用例子 : /playlist/mylike
        """
        return self.request("/playlist/mylike", cookie, env)

    def song_detail(self, ids, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取歌曲详情
        说明 : 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(dt为歌曲时长)
        必选参数 : ids: 音乐 id, 如 ids=347230
        接口地址 : /song/detail
        调用例子 : /song/detail?ids=347230,/song/detail?ids=347230,347231
        返回字段说明(感谢 [@tuxzz](https://github.com/Binaryify/NeteaseCloudMusicApi/issues/1121#issuecomment-774438040) 整理):

        name: String, 歌曲标题
        id: u64, 歌曲ID
        pst: 0，功能未知
        t: enum,
        0: 一般类型
        1: 通过云盘上传的音乐，网易云不存在公开对应
        如果没有权限将不可用，除了歌曲长度以外大部分信息都为null。
        可以通过 /api/v1/playlist/manipulate/tracks 接口添加到播放列表。
        如果添加到“我喜欢的音乐”，则仅自己可见，除了长度以外各种信息均为未知，且无法播放。
        如果添加到一般播放列表，虽然返回code 200，但是并没有效果。
        网页端打开会看到404画面。
        属于这种歌曲的例子: https://music.163.com/song/1345937107
        2: 通过云盘上传的音乐，网易云存在公开对应
        如果没有权限则只能看到信息，但无法直接获取到文件。
        可以通过 /api/v1/playlist/manipulate/tracks 接口添加到播放列表。
        如果添加到“我喜欢的音乐”，则仅自己可见，且无法播放。
        如果添加到一般播放列表，则自己会看到显示“云盘文件”，且云盘会多出其对应的网易云公开歌曲。其他人看到的是其对应的网易云公开歌曲。
        网页端打开会看到404画面。
        属于这种歌曲的例子: https://music.163.com/song/435005015
        ar: Vec<Artist>, 歌手列表
        alia: Vec<String>,
        别名列表，第一个别名会被显示作副标题
        例子: https://music.163.com/song/536623501
        pop: 小数，常取[0.0, 100.0]中离散的几个数值, 表示歌曲热度
        st: 0: 功能未知
        rt: Option<String>, None、空白字串、或者类似600902000007902089的字符串，功能未知
        fee: enum,
        0: 免费或无版权
        1: VIP 歌曲
        4: 购买专辑
        8: 非会员可免费播放低音质，会员可播放高音质及下载
        fee 为 1 或 8 的歌曲均可单独购买 2 元单曲
        v: u64, 常为[1, ?]任意数字, 代表歌曲当前信息版本
        version: u64, 常为[1, ?]任意数字, 代表歌曲当前信息版本
        crbt: Option<String>, None或字符串表示的十六进制，功能未知
        cf: Option<String>, 空白字串或者None，功能未知
        al: Album, 专辑，如果是DJ节目(dj_type != 0)或者无专辑信息(single == 1)，则专辑id为0
        dt: u64, 歌曲时长
        hr: Option<Quality>, Hi-Res质量文件信息
        sq: Option<Quality>, 无损质量文件信息
        h: Option<Quality>, 高质量文件信息
        m: Option<Quality>, 中质量文件信息
        l: Option<Quality>, 低质量文件信息
        a: Option<未知>, 常为None, 功能未知
        cd: Option<String>, None或如"04", "1/2", "3", "null"的字符串，表示歌曲属于专辑中第几张CD，对应音频文件的Tag
        no: u32, 表示歌曲属于CD中第几曲，0表示没有这个字段，对应音频文件的Tag
        rtUrl: Option<String(?)>, 常为None, 功能未知
        rtUrls: Vec<String(?)>, 常为空列表, 功能未知
        djId: u64,
        0: 不是DJ节目
        其他：是DJ节目，表示DJ ID
        copyright: u32, 0, 1, 2: 功能未知
        s_id: u64, 对于t == 2的歌曲，表示匹配到的公开版本歌曲ID
        mark: u64, 一些歌曲属性，用按位与操作获取对应位置的值
        8192 立体声?(不是很确定)
        131072 纯音乐
        262144 支持 杜比全景声(Dolby Atmos)
        1048576 脏标 🅴
        17179869184 支持 Hi-Res
        其他未知，理论上有从1到2^63共64种不同的信息
        专辑信息的mark字段也同理
        例子:id 1859245776 和 1859306637 为同一首歌，前者 mark & 1048576 == 1048576,后者 mark & 1048576 == 0，因此前者是脏版。
        originCoverType: enum
        0: 未知
        1: 原曲
        2: 翻唱
        originSongSimpleData: Option<SongSimpleData>, 对于翻唱曲，可选提供原曲简单格式的信息
        single: enum,
        0: 有专辑信息或者是DJ节目
        1: 未知专辑
        noCopyrightRcmd: Option<NoCopyrightRcmd>, 不能判断出歌曲有无版权
        mv: u64, 非零表示有MV ID
        rtype: 常为0，功能未知
        rurl: Option<String(?)>, 常为None，功能未知
        mst: u32, 偶尔为0, 常为9，功能未知
        cp: u64, 功能未知
        publishTime: i64, 毫秒为单位的Unix时间戳
        pc: 云盘歌曲信息，如果不存在该字段，则为非云盘歌曲
        privilege:权限相关信息
        cs:bool,是否为云盘歌曲
        st:小于0时为灰色歌曲, 使用上传云盘的方法解灰后 st == 0
        toast:bool,是否「由于版权保护，您所在的地区暂时无法使用。」
        flLevel:免费用户的该歌曲播放音质
        plLevel:当前用户的该歌曲最高试听音质
        dlLevel:当前用户的该歌曲最高下载音质
        maxBrLevel；歌曲最高音质

        """
        return self.request("/song/detail", cookie, env, ids=ids)

    def album(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取专辑内容
        说明 : 调用此接口 , 传入专辑 id, 可获得专辑内容
        必选参数 : id: 专辑 id
        接口地址 : /album
        调用例子 : /album?id=32311
        """
        return self.request("/album", cookie, env, id=id)

    def album_detail_dynamic(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        专辑动态信息
        说明 : 调用此接口 , 传入专辑 id, 可获得专辑动态信息,如是否收藏,收藏数,评论数,分享数
        必选参数 : id: 专辑 id
        接口地址 : /album/detail/dynamic
        调用例子 : /album/detail/dynamic?id=32311
        """
        return self.request("/album/detail/dynamic", cookie, env, id=id)

    def album_sub(self, id, t, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        收藏/取消收藏专辑
        说明 : 调用此接口,可收藏/取消收藏专辑
        必选参数 :
        id : 专辑 id
        t : 1 为收藏,其他为取消收藏
        接口地址 : /album/sub
        调用例子 : /album/sub?t=1 /album/sub?t=0
        """
        return self.request("/album/sub", cookie, env, id=id, t=t)

    def album_sublist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取已收藏专辑列表
        说明 : 调用此接口 , 可获得已收藏专辑列表
        可选参数 :
        limit: 取出数量 , 默认为 25
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*25, 其中 25 为 limit 的值 , 默认
        为 0
        接口地址 : /album/sublist
        调用例子 : /album/sublist ( 周杰伦 )
        """
        return self.request("/album/sublist", cookie, env, limit=limit, offset=offset)

    def artists(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取歌手单曲
        说明 : 调用此接口 , 传入歌手 id, 可获得歌手部分信息和热门歌曲
        必选参数 : id: 歌手 id, 可由搜索接口获得
        接口地址 : /artists
        调用例子 : /artists?id=6452
        """
        return self.request("/artists", cookie, env, id=id)

    def artist_mv(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取歌手 mv
        说明 : 调用此接口 , 传入歌手 id, 可获得歌手 mv 信息 , 具体 mv 播放地址可调
        用/mv传入此接口获得的 mvid 来拿到 , 如 :
        /artist/mv?id=6452,/mv?mvid=5461064
        必选参数 : id: 歌手 id, 可由搜索接口获得
        接口地址 : /artist/mv
        调用例子 : /artist/mv?id=6452
        """
        return self.request("/artist/mv", cookie, env, id=id)

    def artist_album(
        self, id, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取歌手专辑
        说明 : 调用此接口 , 传入歌手 id, 可获得歌手专辑内容
        必选参数 : id: 歌手 id
        可选参数 : limit: 取出数量 , 默认为 30
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认
        为 0
        接口地址 : /artist/album
        调用例子 : /artist/album?id=6452&limit=5 ( 周杰伦 )
        """
        return self.request(
            "/artist/album", cookie, env, id=id, limit=limit, offset=offset
        )

    def artist_desc(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取歌手描述
        说明 : 调用此接口 , 传入歌手 id, 可获得歌手描述
        必选参数 : id: 歌手 id
        接口地址 : /artist/desc
        调用例子 : /artist/desc?id=6452 ( 周杰伦 )
        """
        return self.request("/artist/desc", cookie, env, id=id)

    def artist_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取歌手详情
        说明 : 调用此接口 , 传入歌手 id, 可获得获取歌手详情
        必选参数 : id: 歌手 id
        接口地址 : /artist/detail
        调用例子 : /artist/detail?id=11972054 (Billie Eilish)
        """
        return self.request("/artist/detail", cookie, env, id=id)

    def simi_artist(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取相似歌手
        说明 : 调用此接口 , 传入歌手 id, 可获得相似歌手
        必选参数 : id: 歌手 id
        接口地址 : /simi/artist
        调用例子 : /simi/artist?id=6452 ( 对应和周杰伦相似歌手 )
        """
        return self.request("/simi/artist", cookie, env, id=id)

    def simi_playlist(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取相似歌单
        说明 : 调用此接口 , 传入歌曲 id, 可获得相似歌单
        必选参数 : id: 歌曲 id
        接口地址 : /simi/playlist
        调用例子 : /simi/playlist?id=347230 ( 对应 ' 光辉岁月 ' 相似歌单 )
        """
        return self.request("/simi/playlist", cookie, env, id=id)

    def simi_mv(self, mvid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        相似 mv
        说明 : 调用此接口 , 传入 mvid 可获取相似 mv
        必选参数 : mvid: mv id
        接口地址 : /simi/mv
        调用例子 : /simi/mv?mvid=5436712
        """
        return self.request("/simi/mv", cookie, env, mvid=mvid)

    def simi_song(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取相似音乐
        说明 : 调用此接口 , 传入歌曲 id, 可获得相似歌曲
        必选参数 : id: 歌曲 id
        接口地址 : /simi/song
        调用例子 : /simi/song?id=347230 ( 对应 ' 光辉岁月 ' 相似歌曲 )
        """
        return self.request("/simi/song", cookie, env, id=id)

    def simi_user(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取最近 5 个听了这首歌的用户
        说明 : 调用此接口 , 传入歌曲 id, 最近 5 个听了这首歌的用户
        必选参数 : id: 歌曲 id
        接口地址 : /simi/user
        调用例子 : /simi/user?id=347230 ( 对应 ' 光辉岁月 ' 相似歌曲 )
        """
        return self.request("/simi/user", cookie, env, id=id)

    def recommend_resource(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取每日推荐歌单
        说明 : 调用此接口 , 可获得每日推荐歌单 ( 需要登录 )
        接口地址 : /recommend/resource
        调用例子 : /recommend/resource
        """
        return self.request("/recommend/resource", cookie, env)

    def recommend_songs(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取每日推荐歌曲
        说明 : 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
        接口地址 : /recommend/songs
        调用例子 : /recommend/songs
        """
        return self.request("/recommend/songs", cookie, env)

    def recommend_songs_dislike(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        每日推荐歌曲-不感兴趣
        说明 : 日推歌曲标记为不感兴趣( 同时会返回一个新推荐歌曲, 需要登录 )
        必选参数 : id: 歌曲 id
        接口地址 : /recommend/songs/dislike
        调用例子 : /recommend/songs/dislike?id=168091
        返回数据 :
        json
        {
        "data":{
        "name":"破碎太阳之心",
        "id":2009592201,
        "position":0,
        "alias":[],
        ...
        },
        "code":200
        }

        """
        return self.request("/recommend/songs/dislike", cookie, env, id=id)

    def history_recommend_songs(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取历史日推可用日期列表
        说明 : 调用此接口 , 可获得历史日推可用日期列表
        接口地址 : /history/recommend/songs
        调用例子 : /history/recommend/songs
        """
        return self.request("/history/recommend/songs", cookie, env)

    def history_recommend_songs_detail(
        self, date, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取历史日推详情数据
        说明 : 调用此接口 ,传入当日日期, 可获得当日历史日推数据
        必选参数 : date: 日期,通过历史日推可用日期列表接口获取,不能任意日期
        接口地址 : /history/recommend/songs/detail
        调用例子 : /history/recommend/songs/detail?date=2020-06-21
        """
        return self.request("/history/recommend/songs/detail", cookie, env, date=date)

    def personal_fm(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        私人 FM
        说明 : 私人 FM( 需要登录 )
        接口地址 : /personal_fm
        调用例子 : /personal_fm
        """
        return self.request("/personal_fm", cookie, env)

    def daily_signin(self, type=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        签到
        说明 : 调用此接口 , 传入签到类型 ( 可不传 , 默认安卓端签到 ), 可签到 ( 需要登录
        ), 其中安卓端签到可获得 3 点经验 , web/PC 端签到可获得 2 点经验
        可选参数 : type: 签到类型 , 默认 0, 其中 0 为安卓端签到 ,1 为 web/PC 签到
        接口地址 : /daily_signin
        调用例子 : /daily_signin
        """
        return self.request("/daily_signin", cookie, env, type=type)

    def sign_happy_info(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        乐签信息
        说明 : 调用此接口, 可获取乐签信息
        接口地址 : /sign/happy/info
        """
        return self.request("/sign/happy/info", cookie, env)

    def like(self, id, like=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        喜欢音乐
        说明 : 调用此接口 , 传入音乐 id, 可喜欢该音乐
        必选参数 : id: 歌曲 id
        可选参数 : like: 布尔值 , 默认为 true 即喜欢 , 若传 false, 则取消喜欢
        接口地址 : /like
        调用例子 : /like?id=347230
        喜欢成功则返回数据的 code 为 200, 其余为失败
        """
        return self.request("/like", cookie, env, id=id, like=like)

    def likelist(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        喜欢音乐列表
        说明 : 调用此接口 , 传入用户 id, 可获取已喜欢音乐 id 列表(id 数组)
        必选参数 : uid: 用户 id
        接口地址 : /likelist
        调用例子 : /likelist?uid=32953014
        """
        return self.request("/likelist", cookie, env, uid=uid)

    def fm_trash(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        垃圾桶
        说明 : 调用此接口 , 传入音乐 id, 可把该音乐从私人 FM 中移除至垃圾桶
        必选参数 : id: 歌曲 id
        接口地址 : /fm_trash
        调用例子 : /fm_trash?id=347230
        """
        return self.request("/fm_trash", cookie, env, id=id)

    def top_album(
        self,
        area=None,
        type=None,
        year=None,
        month=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        新碟上架
        说明 : 调用此接口 , 可获取新碟上架列表 , 如需具体音乐信息需要调用获取专辑列表接
        口 /album , 然后传入 id, 如 /album?id=32311
        可选参数 :
        area: ALL:全部,ZH:华语,EA:欧美,KR:韩国,JP:日本
        type : new:全部 hot:热门,默认为 new
        year : 年,默认本年
        month : 月,默认本月
        接口地址 : /top/album
        调用例子 : /top/album?offset=0&limit=30&year=2019&month=6
        """
        return self.request(
            "/top/album", cookie, env, area=area, type=type, year=year, month=month
        )

    def album_new(
        self, limit=None, offset=None, area=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        全部新碟
        说明 : 登录后调用此接口 ,可获取全部新碟
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        area : ALL:全部,ZH:华语,EA:欧美,KR:韩国,JP:日本
        接口地址 : /album/new
        调用例子 : /album/new?area=KR&limit=10
        """
        return self.request(
            "/album/new", cookie, env, limit=limit, offset=offset, area=area
        )

    def album_newest(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        最新专辑
        说明 : 调用此接口 ，获取云音乐首页新碟上架数据
        接口地址 : /album/newest
        调用例子 : /album/newest
        """
        return self.request("/album/newest", cookie, env)

    def scrobble(
        self, id, sourceid, time=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        听歌打卡
        说明 : 调用此接口 , 传入音乐 id, 来源 id，歌曲时间 time，更新听歌排行数据
        必选参数 : id: 歌曲 id, sourceid: 歌单或专辑 id
        可选参数 : time: 歌曲播放时间,单位为秒
        接口地址 : /scrobble
        调用例子 : /scrobble?id=518066366&sourceid=36780169&time=291
        """
        return self.request(
            "/scrobble", cookie, env, id=id, sourceid=sourceid, time=time
        )

    def top_artists(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        热门歌手
        说明 : 调用此接口 , 可获取热门歌手数据
        可选参数 : limit: 取出数量 , 默认为 50
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*50, 其中 50 为 limit 的值 , 默认
        为 0
        接口地址 : /top/artists
        调用例子 : /top/artists?offset=0&limit=30
        """
        return self.request("/top/artists", cookie, env, limit=limit, offset=offset)

    def mv_all(
        self,
        area=None,
        type=None,
        order=None,
        limit=None,
        offset=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        全部 mv
        说明 : 调用此接口 , 可获取全部 mv
        可选参数 :
        area: 地区,可选值为全部,内地,港台,欧美,日本,韩国,不填则为全部
        type: 类型,可选值为全部,官方版,原生,现场版,网易出品,不填则为全部
        order: 排序,可选值为上升最快,最热,最新,不填则为上升最快
        limit: 取出数量 , 默认为 30
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*50, 其中 50 为 limit 的值 , 默认
        为 0
        接口地址 : /mv/all
        调用例子 : /mv/all?area=港台
        """
        return self.request(
            "/mv/all",
            cookie,
            env,
            area=area,
            type=type,
            order=order,
            limit=limit,
            offset=offset,
        )

    def mv_first(
        self, area=None, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最新 mv
        说明 : 调用此接口 , 可获取最新 mv
        可选参数 : area: 地区,可选值为全部,内地,港台,欧美,日本,韩国,不填则为全部
        可选参数 : limit: 取出数量 , 默认为 30
        接口地址 : /mv/first
        调用例子 : /mv/first?limit=10
        """
        return self.request("/mv/first", cookie, env, area=area, limit=limit)

    def mv_exclusive_rcmd(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        网易出品 mv
        说明 : 调用此接口 , 可获取网易出品 mv
        可选参数 : limit: 取出数量 , 默认为 30
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认
        为 0
        接口地址 : /mv/exclusive/rcmd
        调用例子 : /mv/exclusive/rcmd?limit=10
        """
        return self.request(
            "/mv/exclusive/rcmd", cookie, env, limit=limit, offset=offset
        )

    def personalized_mv(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        推荐 mv
        说明 : 调用此接口 , 可获取推荐 mv
        接口地址 : /personalized/mv
        调用例子 : /personalized/mv
        """
        return self.request("/personalized/mv", cookie, env)

    def personalized(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        推荐歌单
        说明 : 调用此接口 , 可获取推荐歌单
        可选参数 : limit: 取出数量 , 默认为 30 (不支持 offset)
        接口地址 : /personalized
        调用例子 : /personalized?limit=1
        """
        return self.request("/personalized", cookie, env, limit=limit)

    def personalized_newsong(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        推荐新音乐
        说明 : 调用此接口 , 可获取推荐新音乐
        可选参数 : limit: 取出数量 , 默认为 10 (不支持 offset)
        接口地址 : /personalized/newsong
        调用例子 : /personalized/newsong
        """
        return self.request("/personalized/newsong", cookie, env, limit=limit)

    def personalized_djprogram(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        推荐电台
        说明 : 调用此接口 , 可获取推荐电台
        接口地址 : /personalized/djprogram
        调用例子 : /personalized/djprogram
        """
        return self.request("/personalized/djprogram", cookie, env)

    def program_recommend(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        推荐节目
        说明 : 调用此接口 , 可获取推荐电台
        接口地址 : /program/recommend
        可选参数 :
        limit: 取出数量 , 默认为 10
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*10, 其中 10 为 limit 的值 , 默认
        为 0
        调用例子 : /program/recommend?limit=5
        """
        return self.request(
            "/program/recommend", cookie, env, limit=limit, offset=offset
        )

    def personalized_privatecontent(
        self, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        独家放送(入口列表)
        说明 : 调用此接口 , 可获取独家放送
        接口地址 : /personalized/privatecontent
        调用例子 : /personalized/privatecontent
        """
        return self.request("/personalized/privatecontent", cookie, env)

    def personalized_privatecontent_list(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        独家放送列表
        说明 : 调用此接口 , 可获取独家放送列表
        可选参数 :
        limit : 返回数量 , 默认为 60
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*60, 其中 60 为 limit 的值 , 默认为 0
        接口地址 : /personalized/privatecontent/list
        调用例子 : /personalized/privatecontent/list?limit=1&offset=2
        """
        return self.request(
            "/personalized/privatecontent/list", cookie, env, limit=limit, offset=offset
        )

    def top_mv(
        self, limit=None, area=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        mv 排行
        说明 : 调用此接口 , 可获取 mv 排行
        可选参数 : limit: 取出数量 , 默认为 30
        area: 地区,可选值为内地,港台,欧美,日本,韩国,不填则为全部
        offset: 偏移数量 , 用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认
        为 0
        接口地址 : /top/mv
        调用例子 : /top/mv?limit=10
        """
        return self.request(
            "/top/mv", cookie, env, limit=limit, area=area, offset=offset
        )

    def mv_detail(self, mvid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取 mv 数据
        说明 : 调用此接口 , 传入 mvid ( 在搜索音乐的时候传 type=1004 获得 ) , 可获取对应
        MV 数据 , 数据包含 mv 名字 , 歌手 , 发布时间 , mv 视频地址等数据 , 其中 mv 视频
        网易做了防盗链处理 , 可能不能直接播放 , 需要播放的话需要调用 ' mv 地址' 接口
        必选参数 : mvid: mv 的 id
        接口地址 : /mv/detail
        调用例子 : /mv/detail?mvid=5436712
        """
        return self.request("/mv/detail", cookie, env, mvid=mvid)

    def mv_detail_info(self, mvid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取 mv 点赞转发评论数数据
        说明 : 调用此接口 , 传入 mvid ( 在搜索音乐的时候传 type=1004 获得 ) , 可获取对应
        MV 点赞转发评论数数据
        必选参数 : mvid: mv 的 id
        接口地址 : /mv/detail/info
        调用例子 : /mv/detail/info?mvid=5436712
        """
        return self.request("/mv/detail/info", cookie, env, mvid=mvid)

    def mv_url(self, id, r=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        mv 地址
        说明 : 调用此接口 , 传入 mv id,可获取 mv 播放地址
        必选参数 : id: mv id
        可选参数 : r: 分辨率,默认 1080,可从 /mv/detail 接口获取分辨率列表
        接口地址 : /mv/url
        调用例子 :
        /mv/url?id=5436712 /mv/url?id=10896407&r=1080
        """
        return self.request("/mv/url", cookie, env, id=id, r=r)

    def video_group_list(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取视频标签列表
        说明 : 调用此接口 , 可获取视频标签列表
        接口地址 : /video/group/list
        调用例子 : /video/group/list
        """
        return self.request("/video/group/list", cookie, env)

    def video_category_list(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取视频分类列表
        说明 : 调用此接口 , 可获取视频分类列表
        接口地址 : /video/category/list
        调用例子 : /video/category/list
        """
        return self.request("/video/category/list", cookie, env)

    def video_group(
        self, id, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取视频标签/分类下的视频
        说明 : 调用此接口 , 传入标签/分类id,可获取到相关的视频,分页参数只能传入 offset
        必选参数 : id: videoGroup 的 id
        可选参数 : offset: 默认 0
        接口地址 : /video/group
        调用例子 : /video/group?id=9104
        """
        return self.request("/video/group", cookie, env, id=id, offset=offset)

    def video_timeline_all(
        self, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取全部视频列表
        说明 : 调用此接口,可获取视频分类列表,分页参数只能传入 offset
        可选参数 : offset: 默认 0
        接口地址 : /video/timeline/all
        调用例子 : /video/timeline/all
        """
        return self.request("/video/timeline/all", cookie, env, offset=offset)

    def video_timeline_recommend(
        self, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取推荐视频
        说明 : 调用此接口, 可获取推荐视频,分页参数只能传入 offset
        可选参数 : offset: 默认 0
        接口地址 : /video/timeline/recommend
        调用例子 : /video/timeline/recommend?offset=10
        """
        return self.request("/video/timeline/recommend", cookie, env, offset=offset)

    def related_allvideo(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        相关视频
        说明 : 调用此接口 , 可获取相关视频
        必选参数 : id: 视频 的 id
        接口地址 : /related/allvideo
        调用例子 : /related/allvideo?id=89ADDE33C0AAE8EC14B99F6750DB954D
        """
        return self.request("/related/allvideo", cookie, env, id=id)

    def video_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        视频详情
        说明 : 调用此接口 , 可获取视频详情
        必选参数 : id: 视频 的 id
        接口地址 : /video/detail
        调用例子 : /video/detail?id=89ADDE33C0AAE8EC14B99F6750DB954D
        """
        return self.request("/video/detail", cookie, env, id=id)

    def video_detail_info(self, vid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取视频点赞转发评论数数据
        说明 : 调用此接口 , 传入 vid ( 视频 id ) , 可获取对应视频点赞转发评论数数据
        必选参数 : vid: 视频 id
        接口地址 : /video/detail/info
        调用例子 : /video/detail/info?vid=89ADDE33C0AAE8EC14B99F6750DB954D
        """
        return self.request("/video/detail/info", cookie, env, vid=vid)

    def video_url(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取视频播放地址
        说明 : 调用此接口 , 传入视频 id,可获取视频播放地址
        必选参数 : id: 视频 的 id
        接口地址 : /video/url
        调用例子 : /video/url?id=89ADDE33C0AAE8EC14B99F6750DB954D
        """
        return self.request("/video/url", cookie, env, id=id)

    def toplist(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        所有榜单
        说明 : 调用此接口,可获取所有榜单
        接口地址 : /toplist
        调用例子 : /toplist
        """
        return self.request("/toplist", cookie, env)

    def top_list(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        排行榜详情
        说明: 请使用[歌单详情](#获取歌单详情)接口,传入排行榜 id 获取排行榜详情数据(排行榜也是歌单的一种)
        ~~说明 : 调用此接口 , 传入榜单 id, 可获取不同排行榜数据(v3.34.0 之后不再支持 idx 参数)~~
        ~~必选参数 : id: 榜单 id,通过所有榜单接口获取~~
        ~~接口地址 : /top/list~~
        ~~调用例子 : /top/list?id=2809577409~~
        """
        return self.request("/top/list", cookie, env, id=id)

    def toplist_detail(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        所有榜单内容摘要
        说明 : 调用此接口,可获取所有榜单内容摘要
        接口地址 : /toplist/detail
        调用例子 : /toplist/detail
        """
        return self.request("/toplist/detail", cookie, env)

    def toplist_artist(
        self, type=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌手榜
        说明 : 调用此接口 , 可获取排行榜中的歌手榜
        可选参数 :

        type : 地区
        1: 华语
        2: 欧美
        3: 韩国
        4: 日本

        接口地址 : /toplist/artist
        调用例子 : /toplist/artist
        """
        return self.request("/toplist/artist", cookie, env, type=type)

    def user_cloud(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云盘
        说明 : 登录后调用此接口 , 可获取云盘数据 , 获取的数据没有对应 url, 需要再调用一
        次 /song/url 获取 url
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*200, 其中 200 为 limit 的值 , 默认为 0
        接口地址 : /user/cloud
        调用例子 : /user/cloud
        """
        return self.request("/user/cloud", cookie, env, limit=limit, offset=offset)

    def user_cloud_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云盘数据详情
        说明 : 登录后调用此接口 , 传入云盘歌曲 id，可获取云盘数据详情
        必选参数 : id: 歌曲 id,可多个,用逗号隔开
        接口地址 : /user/cloud/detail
        调用例子 : /user/cloud/detail?id=5374627
        """
        return self.request("/user/cloud/detail", cookie, env, id=id)

    def user_cloud_del(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云盘歌曲删除
        说明 : 登录后调用此接口 , 可删除云盘歌曲
        必选参数 : id: 歌曲 id,可多个,用逗号隔开
        接口地址 : /user/cloud/del
        调用例子 : /user/cloud/del
        """
        return self.request("/user/cloud/del", cookie, env, id=id)

    def cloud(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云盘上传
        说明 : 登录后调用此接口,使用'Content-Type': 'multipart/form-data'上传 mp3 formData(name 为'songFile'),可上传歌曲到云盘
        参考: https://gitlab.com/Binaryify/NeteaseCloudMusicApi/blob/main/public/cloud.html
        访问地址: http://localhost:3000/cloud.html)
        支持命令行调用,参考 module_example 目录下song_upload.js
        接口地址 : /cloud
        调用例子 : /cloud
        """
        return self.request("/cloud", cookie, env)

    def cloud_match(
        self, uid, sid, asid, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云盘歌曲信息匹配纠正
        说明 : 登录后调用此接口,可对云盘歌曲信息匹配纠正,如需取消匹配,asid 需要传 0
        必选参数 :
        uid: 用户 id
        sid: 云盘的歌曲 id
        asid: 要匹配的歌曲 id
        接口地址 : /cloud/match
        调用例子 : /cloud/match?uid=32953014&sid=aaa&asid=bbb /cloud/match?uid=32953014&sid=bbb&asid=0
        """
        return self.request("/cloud/match", cookie, env, uid=uid, sid=sid, asid=asid)

    def dj_banner(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 banner
        说明 : 调用此接口,可获取电台 banner
        接口地址 : /dj/banner
        调用例子 : /dj/banner
        """
        return self.request("/dj/banner", cookie, env)

    def dj_personalize_recommend(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台个性推荐
        说明 : 调用此接口,可获取电台个性推荐列表
        可选参数 :
        limit : 返回数量,默认为 6,总条数最多 6 条
        接口地址 : /dj/personalize/recommend
        调用例子 : /dj/personalize/recommend?limit=5
        """
        return self.request("/dj/personalize/recommend", cookie, env, limit=limit)

    def dj_subscriber(
        self, id, time=None, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台订阅者列表
        说明 : 调用此接口,可获取电台订阅者列表
        必选参数 : id: 电台 id
        可选参数 :
        time : 分页参数,默认-1,传入上一次返回结果的 time,将会返回下一页的数据
        limit : 返回数量,默认为 20
        接口地址 : /dj/subscriber
        调用例子 : /dj/subscriber?id=335425050 , /dj/subscriber?id=335425050&time=1602761825390
        """
        return self.request(
            "/dj/subscriber", cookie, env, id=id, time=time, limit=limit
        )

    def user_audio(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        用户电台
        说明 : 调用此接口, 传入用户 id 可获取用户创建的电台
        必选参数 : uid: 用户 id
        接口地址 : /user/audio
        调用例子 : /user/audio?uid=32953014
        """
        return self.request("/user/audio", cookie, env, uid=uid)

    def dj_hot(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        热门电台
        说明 : 调用此接口,可获取热门电台
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /dj/hot
        调用例子 : /dj/hot
        """
        return self.request("/dj/hot", cookie, env, limit=limit, offset=offset)

    def dj_program_toplist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 节目榜
        说明 : 登录后调用此接口 , 可获得电台节目榜
        可选参数 :
        limit : 返回数量 , 默认为 100
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*100, 其中 100 为 limit 的值 , 默认为 0
        接口地址 : /dj/program/toplist
        调用例子 : /dj/program/toplist?limit=1
        """
        return self.request(
            "/dj/program/toplist", cookie, env, limit=limit, offset=offset
        )

    def dj_toplist_pay(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 付费精品
        说明 : 调用此接口,可获取付费精品电台
        可选参数 :
        limit : 返回数量 , 默认为 100 (不支持 offset)
        接口地址 : /dj/toplist/pay
        调用例子 : /dj/toplist/pay?limit=30
        """
        return self.request("/dj/toplist/pay", cookie, env, limit=limit)

    def dj_program_toplist_hours(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 24 小时节目榜
        说明 : 调用此接口,可获取 24 小时节目榜
        可选参数 :
        limit : 返回数量 , 默认为 100 (不支持 offset)
        接口地址 : /dj/program/toplist/hours
        调用例子 : /dj/program/toplist/hours?limit=1
        """
        return self.request("/dj/program/toplist/hours", cookie, env, limit=limit)

    def dj_toplist_hours(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 24 小时主播榜
        说明 : 调用此接口,可获取 24 小时主播榜
        可选参数 :
        limit : 返回数量 , 默认为 100 (不支持 offset)
        接口地址 : /dj/toplist/hours
        调用例子 : /dj/toplist/hours?limit=30
        """
        return self.request("/dj/toplist/hours", cookie, env, limit=limit)

    def dj_toplist_newcomer(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 主播新人榜
        说明 : 调用此接口,可获取主播新人榜
        可选参数 :
        limit : 返回数量 , 默认为 100 (不支持 offset)
        接口地址 : /dj/toplist/newcomer
        调用例子 : /dj/toplist/newcomer?limit=30
        """
        return self.request("/dj/toplist/newcomer", cookie, env, limit=limit)

    def dj_toplist_popular(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 最热主播榜
        说明 : 调用此接口,可获取最热主播榜
        可选参数 :
        limit : 返回数量 , 默认为 100 (不支持 offset)
        接口地址 : /dj/toplist/popular
        调用例子 : /dj/toplist/popular?limit=30
        """
        return self.request("/dj/toplist/popular", cookie, env, limit=limit)

    def dj_toplist(
        self, limit=None, offset=None, type=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 新晋电台榜/热门电台榜
        说明 : 登录后调用此接口 , 可获得新晋电台榜/热门电台榜
        可选参数 :
        limit : 返回数量 , 默认为 100
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*100, 其中 100 为 limit 的值 , 默认为 0
        type: 榜单类型, new 为新晋电台榜,hot为热门电台榜
        接口地址 : /dj/toplist
        调用例子 : /dj/toplist?type=hot /dj/toplist?type=new&limit=1
        """
        return self.request(
            "/dj/toplist", cookie, env, limit=limit, offset=offset, type=type
        )

    def dj_radio_hot(
        self, limit=None, offset=None, cateId=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 类别热门电台
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        cateId: 类别 id,可通过 /dj/category/recommend 接口获取
        接口地址 : /dj/radio/hot
        调用例子 : /dj/radio/hot?cateId=2001(创作|翻唱) /dj/radio/hot?cateId=10002 (3D|电子)
        """
        return self.request(
            "/dj/radio/hot", cookie, env, limit=limit, offset=offset, cateId=cateId
        )

    def dj_recommend(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 推荐
        说明 : 登录后调用此接口 , 可获得推荐电台
        接口地址 : /dj/recommend
        调用例子 : /dj/recommend
        """
        return self.request("/dj/recommend", cookie, env)

    def dj_catelist(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 分类
        说明 : 登录后调用此接口 , 可获得电台类型
        接口地址 : /dj/catelist
        调用例子 : /dj/catelist
        """
        return self.request("/dj/catelist", cookie, env)

    def dj_recommend_type(self, type, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 分类推荐
        说明 : 登录后调用此接口 , 传入分类,可获得对应类型电台列表
        必选参数 : type: 电台类型 , 数字 , 可通过/dj/catelist获取 , 对应关系为
        id 对应 此接口的 type, name 对应类型
        接口地址 : /dj/recommend/type
        调用例子 : /dj/recommend/type?type=1(明星做主播) /dj/recommend/type?type=2001 (创作|翻唱)
        """
        return self.request("/dj/recommend/type", cookie, env, type=type)

    def dj_sub(self, rid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 订阅
        说明 : 登录后调用此接口 , 传入rid, 可订阅 dj,dj 的 rid 可通过搜索指定
        type='1009' 获取其 id, 如/search?keywords= 代码时间 &type=1009
        必选参数 : rid: 电台 的 id
        接口地址 : /dj/sub
        调用例子 : /dj/sub?rid=336355127&t=1 ( 对应关注 ' 代码时间 ')
        /dj/sub?rid=336355127&t=0 ( 对应取消关注 ' 代码时间 ')
        """
        return self.request("/dj/sub", cookie, env, rid=rid)

    def dj_sublist(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台的订阅列表
        说明 : 登录后调用此接口 , 可获取订阅的电台列表
        接口地址 : /dj/sublist
        调用例子 : /dj/sublist
        """
        return self.request("/dj/sublist", cookie, env)

    def dj_paygift(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        电台 - 付费精选
        说明 : 可以获取付费精选的电台列表 , 传入 limit 和 offset 可以进行分页
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /dj/paygift
        调用例子 : /dj/paygift?limit=10&offset=20
        """
        return self.request("/dj/paygift", cookie, env, limit=limit, offset=offset)

    def dj_category_excludehot(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 非热门类型
        说明 : 登录后调用此接口, 可获得电台非热门类型
        接口地址 : /dj/category/excludehot
        调用例子 : /dj/category/excludehot
        """
        return self.request("/dj/category/excludehot", cookie, env)

    def dj_category_recommend(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 推荐类型
        说明 : 登录后调用此接口, 可获得电台推荐类型
        接口地址 : /dj/category/recommend
        调用例子 : /dj/category/recommend
        """
        return self.request("/dj/category/recommend", cookie, env)

    def dj_today_perfered(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 今日优选
        说明 : 登录后调用此接口, 可获得电台今日优选
        接口地址 : /dj/today/perfered
        调用例子 : /dj/today/perfered
        """
        return self.request("/dj/today/perfered", cookie, env)

    def dj_detail(self, rid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 详情
        说明 : 登录后调用此接口 , 传入rid, 可获得对应电台的详情介绍
        必选参数 : rid: 电台 的 id
        接口地址 : /dj/detail
        调用例子 : /dj/detail?rid=336355127 ( 对应 ' 代码时间 ' 的详情介绍 )
        """
        return self.request("/dj/detail", cookie, env, rid=rid)

    def dj_program(
        self,
        rid,
        limit=None,
        offset=None,
        asc=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        电台 - 节目
        说明 : 登录后调用此接口 , 传入rid, 可查看对应电台的电台节目以及对应的 id, 需要
        注意的是这个接口返回的 mp3Url 已经无效 , 都为 null, 但是通过调用 /song/url 这
        个接口 , 传入节目 mainTrackId 仍然能获取到节目音频 , 如 /song/url?id=478446370 获取代
        码时间的一个节目的音频
        必选参数 : rid: 电台 的 id
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        asc : 排序方式,默认为 false (新 => 老 ) 设置 true 可改为 老 => 新
        接口地址 : /dj/program
        调用例子 : /dj/program?rid=336355127&limit=40 ( 对应 ' 代码时间 ' 的节目列表 )
        """
        return self.request(
            "/dj/program", cookie, env, rid=rid, limit=limit, offset=offset, asc=asc
        )

    def dj_program_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        电台 - 节目详情
        说明 : 调用此接口传入电台节目 id,可获得电台节目详情
        必选参数 : id: 电台节目 的 id
        接口地址 : /dj/program/detail
        调用例子 : /dj/program/detail?id=1367665101
        """
        return self.request("/dj/program/detail", cookie, env, id=id)

    def msg_private(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        通知 - 私信
        说明 : 登录后调用此接口 ,可获取私信
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /msg/private
        调用例子 : /msg/private?limit=3
        """
        return self.request("/msg/private", cookie, env, limit=limit, offset=offset)

    def send_text(
        self, user_ids, msg, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        发送私信
        说明 : 登录后调用此接口 , 传入用户 id 和要发送的信息, 可以发送私信,返回内容为历史私信,包含带歌单的私信信息(注:不能发送私信给自己)
        必选参数 :
        user_ids : 用户 id,多个需用逗号隔开
        msg : 要发送的信息
        接口地址 : /send/text
        调用例子 : /send/text?user_ids=32953014&msg=test,/send/text?user_ids=32953014,475625142&msg=test
        """
        return self.request("/send/text", cookie, env, user_ids=user_ids, msg=msg)

    def send_song(
        self, user_ids, id, msg, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        发送私信(带歌曲)
        说明 : 登录后调用此接口 , 传入用户 id 和要发送的信息,音乐 id, 可以发送音乐私信,返回内容为历史私信
        必选参数 :
        user_ids : 用户 id,多个需用逗号隔开
        id : 要发送音乐的 id
        msg : 要发送的信息
        接口地址 : /send/song
        调用例子 : /send/song?user_ids=1&id=351318&msg=测试
        """
        return self.request(
            "/send/song", cookie, env, user_ids=user_ids, id=id, msg=msg
        )

    def send_album(
        self, user_ids, id, msg, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        发送私信(带专辑)
        说明 : 登录后调用此接口 , 传入用户 id 和要发送的信息,专辑 id, 可以发送专辑私信,返回内容为消息 id
        必选参数 :
        user_ids : 用户 id,多个需用逗号隔开
        id : 要发送专辑的 id
        msg : 要发送的信息
        接口地址 : /send/album
        调用例子 : /send/album?user_ids=1&id=351318&msg=测试
        """
        return self.request(
            "/send/album", cookie, env, user_ids=user_ids, id=id, msg=msg
        )

    def send_playlist(
        self, user_ids, msg, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        发送私信(带歌单)
        说明 : 登录后调用此接口 , 传入用户 id 和要发送的信息和歌单 id, 可以发送带歌单的私信(注:不能发送重复的歌单)
        必选参数 :
        user_ids : 用户 id,多个需用逗号隔开
        msg : 要发送的信息
        接口地址 : /send/playlist
        调用例子 : /send/playlist?msg=test&user_ids=475625142&playlist=705123491,/send/playlist?msg=test2&user_ids=475625142,32953014&playlist=705123493
        """
        return self.request("/send/playlist", cookie, env, user_ids=user_ids, msg=msg)

    def msg_recentcontact(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        最近联系人
        说明 : 登录后调用此接口 ,可获取最接近联系人
        接口地址 : /msg/recentcontact
        调用例子 : /msg/recentcontact
        """
        return self.request("/msg/recentcontact", cookie, env)

    def msg_private_history(
        self, uid, limit=None, before=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        私信内容
        说明 : 登录后调用此接口 , 可获取私信内容
        必选参数 :
        uid : 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 30
        before : 分页参数,取上一页最后一项的 time 获取下一页数据
        接口地址 :
        /msg/private/history
        调用例子 :
        /msg/private/history?uid=9003 (云音乐小秘书)
        """
        return self.request(
            "/msg/private/history", cookie, env, uid=uid, limit=limit, before=before
        )

    def msg_comments(
        self, uid, limit=None, before=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        通知 - 评论
        说明 : 登录后调用此接口 ,可获取评论
        必选参数 : uid: 用户 的 id，只能和登录账号的 id 一致
        可选参数 :
        limit : 返回数量 , 默认为 30
        before : 分页参数,取上一页最后一个歌单的 updateTime 获取下一页数据
        接口地址 : /msg/comments
        调用例子 : /msg/comments?uid=32953014
        """
        return self.request(
            "/msg/comments", cookie, env, uid=uid, limit=limit, before=before
        )

    def msg_forwards(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        通知 - @我
        说明 : 登录后调用此接口 ,可获取@我数据
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /msg/forwards
        调用例子 : /msg/forwards?limit=3
        """
        return self.request("/msg/forwards", cookie, env, limit=limit, offset=offset)

    def msg_notices(
        self, limit=None, lasttime=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        通知 - 通知
        说明 : 登录后调用此接口 ,可获取通知
        可选参数 :
        limit : 返回数量 , 默认为 30
        lasttime : 返回数据的 time ,默认-1,传入上一次返回结果的 time,将会返回下一页的数据
        接口地址 : /msg/notices
        调用例子 : /msg/notices?limit=3
        """
        return self.request("/msg/notices", cookie, env, limit=limit, lasttime=lasttime)

    def setting(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        设置
        说明 : 登录后调用此接口 ,可获取用户设置
        接口地址 : /setting
        调用例子 : /setting
        """
        return self.request("/setting", cookie, env)

    def album_list(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        数字专辑-新碟上架
        说明 : 调用此接口 ,可获取数字专辑-新碟上架
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /album/list
        调用例子 : /album/list?limit=10
        """
        return self.request("/album/list", cookie, env, limit=limit, offset=offset)

    def album_songsaleboard(
        self,
        limit=None,
        offset=None,
        albumType=None,
        type=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        数字专辑&数字单曲-榜单
        说明 : 调用此接口 ,可获取数字专辑&数字单曲-榜单
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        albumType : 为数字专辑,1 为数字单曲
        type : daily:日榜,week:周榜,year:年榜,total:总榜
        接口地址 : /album_songsaleboard
        调用例子 : /album/songsaleboard?type=year&year=2020&albumType=0
        """
        return self.request(
            "/album_songsaleboard",
            cookie,
            env,
            limit=limit,
            offset=offset,
            albumType=albumType,
            type=type,
        )

    def album_list_style(
        self, limit=None, offset=None, area=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        数字专辑-语种风格馆
        说明 : 调用此接口 ,可获取语种风格馆数字专辑列表
        可选参数 :
        limit : 返回数量 , 默认为 30
        offset : 偏移数量，用于分页 , 如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        area 地区 Z_H:华语,E_A:欧美,KR:韩国,JP:日本
        接口地址 : /album/list/style
        调用例子 : /album/list/style?area=Z_H&offset=2
        """
        return self.request(
            "/album/list/style", cookie, env, limit=limit, offset=offset, area=area
        )

    def album_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        数字专辑详情
        说明 : 调用此接口 ,传入数字专辑 id 可获取数字专辑详情(和歌单详情有差异)
        接口地址 : /album/detail
        调用例子 : /album/detail?id=84547195
        """
        return self.request("/album/detail", cookie, env, id=id)

    def digitalAlbum_purchased(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        我的数字专辑
        说明 : 登录后调用此接口 ,可获取我的数字专辑
        接口地址 : /digitalAlbum/purchased
        调用例子 : /digitalAlbum/purchased?limit=10
        """
        return self.request("/digitalAlbum/purchased", cookie, env, limit=limit)

    def digitalAlbum_ordering(
        self, id, payment, quantity, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        购买数字专辑
        说明 : 登录后调用此接口 ,可获取购买数字专辑的地址,把地址生成二维码后,可扫描购买专辑
        必选参数 :
        id : 专辑的 id
        payment : 支付方式， 0 为支付宝 3 为微信
        quantity : 购买的数量
        接口地址 : /digitalAlbum/ordering
        调用例子 : /digitalAlbum/ordering?id=86286082&payment=3&quantity=1
        """
        return self.request(
            "/digitalAlbum/ordering",
            cookie,
            env,
            id=id,
            payment=payment,
            quantity=quantity,
        )

    def calendar(
        self, startTime, endTime, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        音乐日历
        说明 : 登录后调用此接口,传入开始和结束时间,可获取音乐日历
        接口地址 : /calendar
        调用例子 : /calendar?startTime=1606752000000&endTime=1609430399999
        """
        return self.request(
            "/calendar", cookie, env, startTime=startTime, endTime=endTime
        )

    def yunbei(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云贝
        说明 : 登录后调用此接口可获取云贝签到信息(连续签到天数,第二天全部可获得的云贝)
        接口地址 : /yunbei
        调用例子 : /yunbei
        """
        return self.request("/yunbei", cookie, env)

    def yunbei_today(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云贝今日签到信息
        说明 : 登录后调用此接口可获取云贝今日签到信息(今日签到获取的云贝数)
        接口地址 : /yunbei/today
        调用例子 : /yunbei/today
        """
        return self.request("/yunbei/today", cookie, env)

    def yunbei_sign(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云贝签到
        说明 : 登录后调用此接口可进行云贝签到
        接口地址 : /yunbei/sign
        调用例子 : /yunbei/sign
        """
        return self.request("/yunbei/sign", cookie, env)

    def yunbei_info(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云贝账户信息
        说明 :登录后调用此接口可获取云贝账户信息(账户云贝数)
        接口地址 : /yunbei/info
        调用例子 : /yunbei/info
        """
        return self.request("/yunbei/info", cookie, env)

    def yunbei_tasks(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云贝所有任务
        说明 :登录后调用此接口可获取云贝所有任务
        接口地址 : /yunbei/tasks
        调用例子 : /yunbei/tasks
        """
        return self.request("/yunbei/tasks", cookie, env)

    def yunbei_tasks_todo(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        云贝 todo 任务
        说明 :登录后调用此接口可获取云贝 todo 任务
        接口地址 : /yunbei/tasks/todo
        调用例子 : /yunbei/tasks/todo
        """
        return self.request("/yunbei/tasks/todo", cookie, env)

    def yunbei_task_finish(
        self, userTaskId, depositCode=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云贝完成任务
        必选参数 :
        userTaskId : 任务 id
        可选参数 :
        depositCode: 任务 depositCode
        接口地址 : /yunbei/task/finish
        调用例子 : /yunbei/task/finish?userTaskId=5146243240&depositCode=0
        """
        return self.request(
            "/yunbei/task/finish",
            cookie,
            env,
            userTaskId=userTaskId,
            depositCode=depositCode,
        )

    def yunbei_tasks_receipt(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云贝收入
        说明 :登录后调用此接口可获取云贝收入
        可选参数 : limit: 取出评论数量 , 默认为 10
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*10, 其中 10 为 limit 的值
        接口地址 : /yunbei/tasks/receipt
        调用例子 : /yunbei/tasks/receipt?limit=1
        """
        return self.request(
            "/yunbei/tasks/receipt", cookie, env, limit=limit, offset=offset
        )

    def yunbei_tasks_expense(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云贝支出
        说明 :登录后调用此接口可获取云贝支出
        可选参数 : limit: 取出评论数量 , 默认为 10
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*10, 其中 10 为 limit 的值
        接口地址 : /yunbei/tasks/expense
        调用例子 : /yunbei/tasks/expense?limit=1
        """
        return self.request(
            "/yunbei/tasks/expense", cookie, env, limit=limit, offset=offset
        )

    def artist_new_song(
        self, limit=None, before=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        关注歌手新歌
        说明 :登录后调用此接口可获取关注歌手新歌
        可选参数 : limit: 取出评论数量 , 默认为 20
        before: 上一页数据返回的 publishTime 的数据
        接口地址 : /artist/new/song
        调用例子 : /artist/new/song?limit=1 /artist/new/song?limit=1&before=1602777625000
        """
        return self.request("/artist/new/song", cookie, env, limit=limit, before=before)

    def artist_new_mv(
        self, limit=None, before=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        关注歌手新 MV
        说明 :登录后调用此接口可获取关注歌手新 MV
        可选参数 : limit: 取出评论数量 , 默认为 20
        before: 上一页数据返回的 publishTime 的数据
        接口地址 : /artist/new/mv
        调用例子 : /artist/new/mv?limit=1 /artist/new/mv?limit=1&before=1602777625000
        """
        return self.request("/artist/new/mv", cookie, env, limit=limit, before=before)

    def listentogether_room_check(
        self, roomId, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        一起听相关
        主机模式: 检查房间当前状态
        从机模式: 待整理
        """
        return self.request("/listentogether/room/check", cookie, env, roomId=roomId)

    def listentogether_accept(
        self, roomId, inviterId, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        一起听相关
        主机模式: 用户加入房间
        从机模式: 待整理
        """
        return self.request(
            "/listentogether/accept", cookie, env, roomId=roomId, inviterId=inviterId
        )

    def listentogether_room_create(
        self, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        一起听相关
        主机模式: 创建新房间
        从机模式: 待整理
        """
        return self.request("/listentogether/room/create", cookie, env)

    def listentogether_sync_playlist_get(
        self, roomId, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        一起听相关
        主机模式: 获取房间同步歌单
        从机模式: 待整理
        """
        return self.request(
            "/listentogether/sync/playlist/get", cookie, env, roomId=roomId
        )

    def listentogether_status(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        一起听相关
        主机模式: 获取房间在线用户
        从机模式: 待整理
        """
        return self.request("/listentogether/status", cookie, env)

    def listentogether_end(
        self, roomId, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        一起听相关
        主机模式: 关闭房间
        从机模式: 待整理
        """
        return self.request("/listentogether/end", cookie, env, roomId=roomId)

    def listentogether_sync_list_command(
        self,
        roomId,
        commandType,
        userId,
        version,
        playMode,
        displayList,
        randomList,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        一起听相关
        主机模式: 歌单同步到房间
        从机模式: 待整理
        """
        return self.request(
            "/listentogether/sync/list/command",
            cookie,
            env,
            roomId=roomId,
            commandType=commandType,
            userId=userId,
            version=version,
            playMode=playMode,
            displayList=displayList,
            randomList=randomList,
        )

    def listentogether_play_command(
        self,
        roomId,
        progress,
        commandType,
        formerSongId,
        targetSongId,
        clientSeq,
        playStatus,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        一起听相关
        主机模式: 播放控制同步
        从机模式: 待整理
        """
        return self.request(
            "/listentogether/play/command",
            cookie,
            env,
            roomId=roomId,
            progress=progress,
            commandType=commandType,
            formerSongId=formerSongId,
            targetSongId=targetSongId,
            clientSeq=clientSeq,
            playStatus=playStatus,
        )

    def batch(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        batch 批量请求接口
        说明 : 登录后调用此接口 ,传入接口和对应原始参数(原始参数非文档里写的参数,需参考源码),可批量请求接口
        接口地址 : /batch
        调用例子 : 使用 GET 方式:/batch?/api/v2/banner/get={"clientType":"pc"} 使用 POST 方式传入参数:{ "/api/v2/banner/get": {"clientType":"pc"} }
        """
        return self.request("/batch", cookie, env)

    def yunbei_rcmd_song(
        self, id, reason=None, yunbeiNum=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云贝推歌
        说明 : 登录后调用此接口 , 传入歌曲 id, 可以进行云贝推歌
        必选参数 : id : 歌曲 id
        可选参数 : reason : 推歌理由
        yunbeiNum: 云贝数量,默认10
        接口地址 : /yunbei/rcmd/song
        调用例子 : /yunbei/rcmd/song?id=65528 /yunbei/rcmd/song?id=65528&reason=人间好声音推荐给你听
        """
        return self.request(
            "/yunbei/rcmd/song", cookie, env, id=id, reason=reason, yunbeiNum=yunbeiNum
        )

    def yunbei_rcmd_song_history(
        self, size=None, cursor=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云贝推歌历史记录
        说明 : 登录后调用此接口 , 可以获得云贝推歌历史记录
        可选参数 : size : 返回数量 , 默认为 20
        cursor : 返回数据的 cursor, 默认为 '' , 传入上一次返回结果的 cursor,将会返回下一页的数据
        接口地址 : /yunbei/rcmd/song/history
        调用例子 : /yunbei/rcmd/song/history?size=10
        """
        return self.request(
            "/yunbei/rcmd/song/history", cookie, env, size=size, cursor=cursor
        )

    def song_purchased(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        已购单曲
        说明 :登录后调用此接口可获取已购买的单曲
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*10, 其中 10 为 limit 的值
        接口地址 : /song/purchased
        调用例子 : /song/purchased?limit=10
        """
        return self.request("/song/purchased", cookie, env, limit=limit, offset=offset)

    def mlog_url(self, id, res=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取 mlog 播放地址
        说明 : 调用此接口 , 传入 mlog id, 可获取 mlog 播放地址
        必选参数 : id : mlog id
        可选参数 : res: 分辨率 , 默认为 1080
        接口地址 : /mlog/url
        调用例子 : /mlog/url?id=a1qOVPTWKS1ZrK8
        """
        return self.request("/mlog/url", cookie, env, id=id, res=res)

    def mlog_to_video(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        将 mlog id 转为视频 id
        说明 : 调用此接口 , 传入 mlog id, 可获取 video id，然后通过video/url 获取播放地址
        必选参数 : id : mlog id
        接口地址 : /mlog/to/video
        调用例子 : /mlog/to/video?id=a1qOVPTWKS1ZrK8
        """
        return self.request("/mlog/to/video", cookie, env, id=id)

    def vip_growthpoint(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        vip 成长值
        说明 : 登录后调用此接口 , 可获取当前会员成长值
        接口地址 : /vip/growthpoint
        调用例子 : /vip/growthpoint
        """
        return self.request("/vip/growthpoint", cookie, env)

    def vip_growthpoint_details(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        vip 成长值获取记录
        说明 :登录后调用此接口可获取会员成长值领取记录
        可选参数 : limit: 取出评论数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*10, 其中 10 为 limit 的值
        接口地址 : /vip/growthpoint/details
        调用例子 : /vip/growthpoint/details?limit=10
        """
        return self.request(
            "/vip/growthpoint/details", cookie, env, limit=limit, offset=offset
        )

    def vip_tasks(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        vip 任务
        说明 : 登录后调用此接口 , 可获取会员任务
        接口地址 : /vip/tasks
        调用例子 : /vip/tasks
        """
        return self.request("/vip/tasks", cookie, env)

    def vip_growthpoint_get(
        self, ids, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        领取 vip 成长值
        说明 : 登录后调用此接口 , 可获取已完成的会员任务的成长值奖励
        必选参数 : ids : 通过/vip/tasks获取到的unGetIds
        接口地址 : /vip/growthpoint/get
        调用例子 : /vip/growthpoint/get?ids=7043206830_7 /vip/growthpoint/get?ids=8613118351_1,8607552957_1
        """
        return self.request("/vip/growthpoint/get", cookie, env, ids=ids)

    def artist_fans(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌手粉丝
        说明 : 调用此接口 , 传入歌手 id, 可获取歌手粉丝
        必选参数 : id : 歌手 id
        接口地址 : /artist/fans
        调用例子 : /artist/fans?id=2116&limit=10&offset=0
        """
        return self.request("/artist/fans", cookie, env, id=id)

    def artist_follow_count(
        self, id, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌手粉丝数量
        说明 : 调用此接口 , 传入歌手 id, 可获取歌手粉丝数量
        必选参数 : id : 歌手 id
        可选参数 : limit: 取出粉丝数量 , 默认为 20
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*10, 其中 10 为 limit 的值
        接口地址 : /artist/follow/count
        调用例子 : /artist/follow/count?id=2116
        """
        return self.request(
            "/artist/follow/count", cookie, env, id=id, limit=limit, offset=offset
        )

    def digitalAlbum_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        数字专辑详情
        说明 : 调用此接口 , 传入专辑 id, 可获取数字专辑信息
        必选参数 : id : 专辑 id
        接口地址 : /digitalAlbum/detail
        调用例子 : /digitalAlbum/detail?id=120605500
        """
        return self.request("/digitalAlbum/detail", cookie, env, id=id)

    def digitalAlbum_sales(self, ids, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        数字专辑销量
        说明 : 调用此接口 , 传入专辑 id, 可获取数字专辑销量
        必选参数 : ids : 专辑 id, 支持多个,用,隔开
        接口地址 : /digitalAlbum/sales
        调用例子 : /digitalAlbum/sales?ids=120605500 /digitalAlbum/sales?ids=120605500,125080528
        """
        return self.request("/digitalAlbum/sales", cookie, env, ids=ids)

    def musician_data_overview(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        音乐人数据概况
        说明 : 音乐人登录后调用此接口 , 可获取统计数据概况
        接口地址 : /musician/data/overview
        调用例子 : /musician/data/overview
        """
        return self.request("/musician/data/overview", cookie, env)

    def musician_play_trend(
        self, startTime, endTime, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        音乐人播放趋势
        说明 : 音乐人登录后调用此接口 , 可获取歌曲播放趋势
        必选参数 : startTime : 开始时间
        endTime : 结束时间
        接口地址 : /musician/play/trend
        调用例子 : /musician/play/trend?startTime=2021-05-24&endTime=2021-05-30
        """
        return self.request(
            "/musician/play/trend", cookie, env, startTime=startTime, endTime=endTime
        )

    def musician_tasks(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        音乐人任务
        说明 : 音乐人登录后调用此接口 , 可获取音乐人任务。返回的数据中status字段为任务状态，0 表示任务未开始，10 表示任务正在进行中，20 表示任务完成，但未领取云豆，100 表示任务完成，并且已经领取了相应的云豆(貌似只能获取到做过的任务了)
        接口地址 : /musician/tasks
        调用例子 : /musician/tasks
        """
        return self.request("/musician/tasks", cookie, env)

    def musician_tasks_new(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        音乐人任务(新)
        说明 : 音乐人登录后调用此接口 , 可获取音乐人任务。返回的数据中status字段为任务状态，0 表示任务未开始，10 表示任务正在进行中，20 表示任务完成，但未领取云豆，100 表示任务完成，并且已经领取了相应的云豆
        接口地址 : /musician/tasks/new
        调用例子 : /musician/tasks/new
        """
        return self.request("/musician/tasks/new", cookie, env)

    def musician_cloudbean(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        账号云豆数
        说明 : 音乐人登录后调用此接口 , 可获取账号云豆数
        接口地址 : /musician/cloudbean
        调用例子 : /musician/cloudbean
        """
        return self.request("/musician/cloudbean", cookie, env)

    def musician_cloudbean_obtain(
        self, id, period, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        领取云豆
        说明 : 音乐人登录后调用此接口 , 可领取已完成的音乐人任务的云豆奖励
        必选参数 : id : 任务 id，通过/musician/tasks获取到的userMissionId即为任务 id
        period : 通过/musician/tasks获取
        接口地址 : /musician/cloudbean/obtain
        调用例子 : /musician/cloudbean/obtain?id=7036416928&period=1
        """
        return self.request(
            "/musician/cloudbean/obtain", cookie, env, id=id, period=period
        )

    def vip_info(self, uid=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取 VIP 信息
        说明: 登录后调用此接口，可获取当前 VIP 信息。
        可选参数 : uid : 用户 id
        接口地址 : /vip/info
        调用例子 : /vip/info, /vip/info?uid=32953014
        """
        return self.request("/vip/info", cookie, env, uid=uid)

    def vip_info_v2(self, uid=None, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取 VIP 信息(app端)
        说明: 登录后调用此接口，可获取当前 VIP 信息。
        可选参数 : uid : 用户 id
        接口地址 : /vip/info/v2
        调用例子 : /vip/info/v2, /vip/info/v2?uid=32953014
        """
        return self.request("/vip/info/v2", cookie, env, uid=uid)

    def musician_sign(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        音乐人签到
        说明: 音乐人登录后调用此接口，可以完成“登录音乐人中心”任务，然后通过/musician/cloudbean/obtain接口可以领取相应的云豆。
        接口地址 : /musician/sign
        调用例子 : /musician/sign
        """
        return self.request("/musician/sign", cookie, env)

    def mlog_music_rcmd(
        self, songid, mvid=None, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌曲相关视频
        说明： 可以调用此接口获取歌曲相关视频 (区别于 MV)， 有些歌曲没有 MV 但是有用户上传的与此歌曲相关的 Mlog。 此功能仅在 网易云音乐 APP 上存在。
        请注意：此接口偶尔会在相关视频后返回不相关视频，请合理使用。
        必选参数 : songid : 歌曲 ID
        可选参数 : mvid : 如果定义，此 mvid 对应的 MV 将会作为第一个返回。
        limit : 取出的 Mlog 数量, 不包含第一个 mvid
        接口地址 : /mlog/music/rcmd
        """
        return self.request(
            "/mlog/music/rcmd", cookie, env, songid=songid, mvid=mvid, limit=limit
        )

    def playlist_privacy(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        公开隐私歌单
        说明: 可以调用此接口将当前用户的隐私歌单公开。
        必选参数 : id : 歌单 ID
        接口地址 : /playlist/privacy
        """
        return self.request("/playlist/privacy", cookie, env, id=id)

    def song_download_url(
        self, id, br=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取客户端歌曲下载 url
        说明 : 使用 /song/url 接口获取的是歌曲试听 url, 但存在部分歌曲在非 VIP 账号上可以下载无损音质而不能试听无损音质, 使用此接口可使非 VIP 账号获取这些歌曲的无损音频
        必选参数 : id : 音乐 id (仅支持单首歌曲)
        可选参数 : br : 码率, 默认设置了 999000 即最大码率, 如果要 320k 则可设置为 320000, 其他类推
        接口地址 : /song/download/url
        """
        return self.request("/song/download/url", cookie, env, id=id, br=br)

    def artist_video(
        self,
        id,
        size=None,
        cursor=None,
        order=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        获取歌手视频
        说明 : 调用此接口 , 传入歌手 id, 可获得歌手视频
        必选参数 : id : 歌手 id
        可选参数 : size : 返回数量 , 默认为 10
        cursor : 返回数据的 cursor, 默认为 0 , 传入上一次返回结果的 cursor,将会返回下一页的数据
        order : 排序方法, 0 表示按时间排序, 1 表示按热度排序, 默认为 0
        接口地址 : /artist/video
        调用例子 : /artist/video?id=2116
        """
        return self.request(
            "/artist/video", cookie, env, id=id, size=size, cursor=cursor, order=order
        )

    def record_recent_song(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最近播放-歌曲
        说明 : 调用此接口 , 可获得最近播放-歌曲
        可选参数 : limit : 返回数量 , 默认为 100
        接口地址 : /record/recent/song
        调用例子 : /record/recent/song?limit=1
        """
        return self.request("/record/recent/song", cookie, env, limit=limit)

    def record_recent_video(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最近播放-视频
        说明 : 调用此接口 , 可获得最近播放-视频
        可选参数 : limit : 返回数量 , 默认为 100
        接口地址 : /record/recent/video
        调用例子 : /record/recent/video?limit=1
        """
        return self.request("/record/recent/video", cookie, env, limit=limit)

    def record_recent_voice(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最近播放-声音
        说明 : 调用此接口 , 可获得最近播放-声音
        可选参数 : limit : 返回数量 , 默认为 100
        接口地址 : /record/recent/voice
        调用例子 : /record/recent/voice?limit=1
        """
        return self.request("/record/recent/voice", cookie, env, limit=limit)

    def record_recent_playlist(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最近播放-歌单
        说明 : 调用此接口 , 可获得最近播放-歌单
        可选参数 : limit : 返回数量 , 默认为 100
        接口地址 : /record/recent/playlist
        调用例子 : /record/recent/playlist?limit=1
        """
        return self.request("/record/recent/playlist", cookie, env, limit=limit)

    def record_recent_album(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最近播放-专辑
        说明 : 调用此接口 , 可获得最近播放-专辑
        可选参数 : limit : 返回数量 , 默认为 100
        接口地址 : /record/recent/album
        调用例子 : /record/recent/album?limit=1
        """
        return self.request("/record/recent/album", cookie, env, limit=limit)

    def record_recent_dj(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        最近播放-播客
        说明 : 调用此接口 , 可获得最近播放-播客
        可选参数 : limit : 返回数量 , 默认为 100
        接口地址 : /record/recent/dj
        调用例子 : /record/recent/dj?limit=1
        """
        return self.request("/record/recent/dj", cookie, env, limit=limit)

    def signin_progress(
        self, moduleId=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        签到进度
        说明 : 调用此接口 , 可获得签到进度
        可选参数 : moduleId : 模块 id，默认为 '1207signin-1207signin'
        接口地址 : /signin/progress
        调用例子 : /signin/progress?moduleId=1207signin-1207signin
        """
        return self.request("/signin/progress", cookie, env, moduleId=moduleId)

    def inner_version(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        内部版本接口
        说明 : 调用此接口 , 可获得内部版本号(从package.json读取)
        接口地址 : /inner/version
        调用例子 : /inner/version
        """
        return self.request("/inner/version", cookie, env)

    def vip_timemachine(
        self,
        startTime=None,
        endTime=None,
        limit=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        黑胶时光机
        说明 : 调用此接口 , 可获得黑胶时光机数据
        可选参数 : startTime : 开始时间
        endTime : 结束时间
        limit : 返回数量 , 默认为 60
        接口地址 : /vip/timemachine
        调用例子 : /vip/timemachine /vip/timemachine?startTime=1638288000000&endTime=1640966399999&limit=10（2021年12月） /vip/timemachine?startTime=1609430400&endTime=1640966399999&limit=60(2021年)
        """
        return self.request(
            "/vip/timemachine",
            cookie,
            env,
            startTime=startTime,
            endTime=endTime,
            limit=limit,
        )

    def song_wiki_summary(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        音乐百科 - 简要信息
        说明: 调用此接口可以获取歌曲的音乐百科简要信息
        由于此接口返回内容过于复杂, 请按需取用
        接口地址: /song/wiki/summary
        必选参数: id: 歌曲 ID
        调用例子: /song/wiki/summary?id=1958384591
        """
        return self.request("/song/wiki/summary", cookie, env, id=id)

    def sheet_list(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        乐谱列表
        说明: 调用此接口可以获取歌曲的乐谱列表
        接口地址: /sheet/list
        必选参数: id: 歌曲 ID
        调用例子: /sheet/list?id=1815684465
        """
        return self.request("/sheet/list", cookie, env, id=id)

    def sheet_preview(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        乐谱内容
        说明: 登录后调用此接口获取乐谱的内容
        接口地址: /sheet/preview
        必选参数: id: 乐谱 ID
        调用例子: /sheet/preview?id=143190
        """
        return self.request("/sheet/preview", cookie, env, id=id)

    def style_list(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        曲风列表
        说明: 调用此接口获取曲风列表及其对应的 tagId
        接口地址: /style/list
        调用例子: /style/list
        """
        return self.request("/style/list", cookie, env)

    def style_preference(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        曲风偏好
        说明: 登录后调用此接口获取我的曲风偏好
        接口地址: /style/preference
        调用例子: /style/preference
        """
        return self.request("/style/preference", cookie, env)

    def style_detail(self, tagId, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        曲风详情
        说明: 调用此接口可以获取该曲风的描述信息
        接口地址: /style/detail
        必选参数: tagId: 曲风 ID
        调用例子: /style/detail?tagId=1000
        """
        return self.request("/style/detail", cookie, env, tagId=tagId)

    def style_song(
        self,
        tagId,
        size=None,
        cursor=None,
        sort=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        曲风-歌曲
        说明: 调用此接口可以获取该曲风对应的歌曲
        接口地址: /style/song
        必选参数: tagId: 曲风 ID
        可选参数 : size : 返回数量 , 默认为 20
        cursor : 返回数据的 cursor, 默认为 0 , 传入上一次返回结果的 cursor,将会返回下一页的数据
        sort: 排序方式，0: 按热度排序，1: 按时间排序
        调用例子: /style/song?tagId=1000 /style/song?tagId=1010&sort=1
        """
        return self.request(
            "/style/song", cookie, env, tagId=tagId, size=size, cursor=cursor, sort=sort
        )

    def style_album(
        self,
        tagId,
        size=None,
        cursor=None,
        sort=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        曲风-专辑
        说明: 调用此接口可以获取该曲风对应的专辑
        接口地址: /style/album
        必选参数: tagId: 曲风 ID
        可选参数 : size : 返回数量 , 默认为 20
        cursor : 返回数据的 cursor, 默认为 0 , 传入上一次返回结果的 cursor,将会返回下一页的数据
        sort: 排序方式，0: 按热度排序，1: 按时间排序
        调用例子: /style/album?tagId=1000 /style/album?tagId=1010&sort=1
        """
        return self.request(
            "/style/album",
            cookie,
            env,
            tagId=tagId,
            size=size,
            cursor=cursor,
            sort=sort,
        )

    def style_playlist(
        self, tagId, size=None, cursor=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        曲风-歌单
        说明: 调用此接口可以获取该曲风对应的歌单
        接口地址: /style/playlist
        必选参数: tagId: 曲风 ID
        可选参数 : size : 返回数量 , 默认为 20
        cursor : 返回数据的 cursor, 默认为 0 , 传入上一次返回结果的 cursor,将会返回下一页的数据
        调用例子: /style/playlist?tagId=1000
        """
        return self.request(
            "/style/playlist", cookie, env, tagId=tagId, size=size, cursor=cursor
        )

    def style_artist(
        self, tagId, size=None, cursor=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        曲风-歌手
        说明: 调用此接口可以获取该曲风对应的歌手
        接口地址: /style/artist
        必选参数: tagId: 曲风 ID
        可选参数 : size : 返回数量 , 默认为 20
        cursor : 返回数据的 cursor, 默认为 0 , 传入上一次返回结果的 cursor,将会返回下一页的数据
        调用例子: /style/artist?tagId=1000
        """
        return self.request(
            "/style/artist", cookie, env, tagId=tagId, size=size, cursor=cursor
        )

    def starpick_comments_summary(
        self, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        云村星评馆 - 简要评论
        说明: 调用此接口可以获取首页推荐的星评馆评论信息
        接口地址: /starpick/comments/summary
        """
        return self.request("/starpick/comments/summary", cookie, env)

    def aidj_content_rcmd(
        self, longitude=None, latitude=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        私人 DJ
        说明: 调用此接口可以获取私人 DJ 的推荐内容 (包括 DJ 声音和推荐歌曲)
        接口地址: /aidj/content/rcmd
        可选参数： longitude latitude : 当前的经纬度
        """
        return self.request(
            "/aidj/content/rcmd", cookie, env, longitude=longitude, latitude=latitude
        )

    def music_first_listen_info(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        回忆坐标
        说明: 可以获取当前歌曲的回忆坐标信息 (见手机 APP 百科页的回忆坐标功能)
        接口地址: /music/first/listen/info
        必选参数： id : 歌曲 ID
        """
        return self.request("/music/first/listen/info", cookie, env, id=id)

    def voicelist_search(
        self,
        limit=None,
        offset=None,
        podcastName=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        播客列表
        说明: 可以获取播客列表
        接口地址: /voicelist/search
        可选参数：
        limit: 取出歌单数量 , 默认为 200
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*200, 其中 200 为 limit 的值
        podcastName: 播客名称
        """
        return self.request(
            "/voicelist/search",
            cookie,
            env,
            limit=limit,
            offset=offset,
            podcastName=podcastName,
        )

    def voicelist_list(
        self, voiceListId, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        播客声音列表
        说明: 可以获取播客里的声音
        接口地址: /voicelist/list
        必选参数：
        voiceListId: 播客id
        返回结果的displayStatus参数对应:

        AUDITING 审核中
        ONLY_SELF_SEE 仅自己可见
        ONLINE 已发布

        可选参数：
        limit: 取出歌单数量 , 默认为 200
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*200, 其中 200 为 limit 的值
        """
        return self.request(
            "/voicelist/list",
            cookie,
            env,
            voiceListId=voiceListId,
            limit=limit,
            offset=offset,
        )

    def voicelist_list_search(
        self,
        displayStatus=None,
        limit=None,
        name=None,
        offset=None,
        radioId=None,
        type=None,
        voiceFeeType=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        播客声音搜索
        说明: 可以搜索播客里的声音
        接口地址: /voicelist/list/search
        可选参数
        - 状态（非必填）：
        - displayStatus: null（默认）：返回所有状态的声音
        - displayStatus: "ONLINE"：已发布的声音
        - displayStatus: "AUDITING"：审核中的声音
        - displayStatus: "ONLY_SELF_SEE"：尽自己可见的声音
        - displayStatus: "SCHEDULE_PUBLISH"：定时发布的声音
        - displayStatus: "TRANSCODE_FAILED"：上传失败的声音
        - displayStatus: "PUBLISHING"：发布中的声音
        - displayStatus: "FAILED"：发布失败的声音
        - limit: 20：每次返回的声音数量（最多200个）
        - 搜索关键词：
        - name: null：返回所有的声音
        - name: [关键词]：返回包含指定关键词的声音文件
        - offset: 0：偏移量，用于分页，默认为0，表示从第一个声音开始获取
        - 博客：
        - radioId: null：返回所有电台的声音
        - radioId: [播客id]：返回特定播客的声音
        - 是否公开：
        - type: null：返回所有类型的声音
        - type: "PUBLIC"：返回公开的声音
        - type: "PRIVATE"：返回隐私的声音
        - 是否付费：
        - voiceFeeType: null（默认）：返回所有类型的声音
        - voiceFeeType: -1：返回所有类型的声音
        - voiceFeeType: 0：返回免费的声音
        - voiceFeeType: 1：返回收费的声音
        """
        return self.request(
            "/voicelist/list/search",
            cookie,
            env,
            displayStatus=displayStatus,
            limit=limit,
            name=name,
            offset=offset,
            radioId=radioId,
            type=type,
            voiceFeeType=voiceFeeType,
        )

    def voice_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        播客声音详情
        说明: 获取播客里的声音详情
        接口地址: /voice/detail
        必选参数：
        id: 播客声音id(voiceId)
        返回结果的displayStatus参数对应:

        同上

        """
        return self.request("/voice/detail", cookie, env, id=id)

    def voicelist_trans(
        self,
        limit,
        offset,
        position,
        programId,
        radioId,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        播客声音排序
        说明: 调整声音在列表中的顺序, 每个声音都有固定的序号, 例如将4的声音移动到1后, 原来的1、2、3增加为2、3、4, 其他不变
        接口地址: /voicelist/trans
        必选参数：
        limit: 取出歌单数量 , 默认为 200
        offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)\*200, 其中 200 为 limit 的值
        position: 位置, 最小为1, 最大为歌曲数量, 超过最大则为移动到最底, 小于1报错
        programId: 播客声音id, 即voiceId
        radioId: 电台id, 即voiceListId
        """
        return self.request(
            "/voicelist/trans",
            cookie,
            env,
            limit=limit,
            offset=offset,
            position=position,
            programId=programId,
            radioId=radioId,
        )

    def voicelist_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        播客列表详情
        说明: 可以获取播客封面、分类、名称、简介等
        接口地址: /voicelist/detail
        必选参数：
        id: 播客id，即voiceListId
        """
        return self.request("/voicelist/detail", cookie, env, id=id)

    def voice_delete(self, ids, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        播客删除
        说明: 可以删除播客
        接口地址: /voice/delete
        必选参数：
        ids: 播客id，即voiceListId,多个以逗号隔开
        """
        return self.request("/voice/delete", cookie, env, ids=ids)

    def voice_upload(
        self,
        voiceListId,
        coverImgId,
        categoryId,
        secondCategoryId,
        description,
        songName=None,
        privacy=None,
        publishTime=None,
        autoPublish=None,
        autoPublishText=None,
        orderNo=None,
        composedSongs=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        播客上传声音
        说明: 可以上传声音到播客,例子在 /public/voice_upload.html 访问地址: <a href="/voice_upload.html" target="_blank">/voice_upload.html</a>
        接口地址: /voice/upload
        必选参数：
        voiceListId: 播客 id
        coverImgId: 播客封面
        categoryId: 分类id
        secondCategoryId:次级分类id
        description: 声音介绍
        可选参数：
        songName: 声音名称
        privacy: 设为隐私声音,播客如果是隐私博客,则必须设为1
        publishTime:默认立即发布,定时发布的话需传入时间戳
        autoPublish: 是否发布动态,是则传入1
        autoPublishText: 动态文案
        orderNo: 排序,默认为1
        composedSongs: 包含歌曲(歌曲id),多个用逗号隔开
        """
        return self.request(
            "/voice/upload",
            cookie,
            env,
            voiceListId=voiceListId,
            coverImgId=coverImgId,
            categoryId=categoryId,
            secondCategoryId=secondCategoryId,
            description=description,
            songName=songName,
            privacy=privacy,
            publishTime=publishTime,
            autoPublish=autoPublish,
            autoPublishText=autoPublishText,
            orderNo=orderNo,
            composedSongs=composedSongs,
        )

    def djRadio_top(
        self,
        djRadioId=None,
        sortIndex=None,
        dataGapDays=None,
        dataType=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        电台排行榜获取
        说明: 调用此接口可以获取电台排行榜
        接口地址: /djRadio/top
        可选参数：
        djRadioId : 电台id
        sortIndex: 排序 1:播放数 2:点赞数 3：评论数 4：分享数 5：收藏数 默认 1
        dataGapDays: 天数 7:一周 30:一个月 90:三个月 默认 7
        dataType: 未知,默认 3
        """
        return self.request(
            "/djRadio/top",
            cookie,
            env,
            djRadioId=djRadioId,
            sortIndex=sortIndex,
            dataGapDays=dataGapDays,
            dataType=dataType,
        )

    def voice_lyric(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取声音歌词
        说明: 调用此接口可以获取声音歌词
        接口地址: /voice/lyric
        必选参数：
        id: 声音id
        """
        return self.request("/voice/lyric", cookie, env, id=id)

    def verify_getQr(
        self, vid, type, token, evid, sign, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        验证接口-二维码生成
        说明: 进行某些操作,如关注用户,可能会触发验证,可调用这个接口生成二维码,使用app扫码后可解除验证
        接口地址: /verify/getQr
        必选参数：
        vid: 触发验证后,接口返回的verifyId
        type:触发验证后,接口返回的verifyType
        token:触发验证后,接口返回的verifyToken
        evid:触发验证后,接口返回的params的event_id
        sign:触发验证后,接口返回的params的sign
        """
        return self.request(
            "/verify/getQr",
            cookie,
            env,
            vid=vid,
            type=type,
            token=token,
            evid=evid,
            sign=sign,
        )

    def verify_qrcodestatus(self, qr, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        验证接口-二维码检测
        说明: 使用此接口,传入/verify/getQr接口返回的qr字符串,可检测二维码扫描状态
        接口地址: /verify/qrcodestatus
        必选参数：
        qr: /verify/getQr接口返回的qr字符串
        返回结果说明:
        qrCodeStatus:0,detailReason:0 二维码生成成功
        qrCodeStatus:0,detailReason:303 账号不一致
        qrCodeStatus:10,detailReason:0  二维码已扫描,并且手机号相同
        qrCodeStatus:20,detailReason:0  验证成功qrCodeStatus:21,detailReason:0 二维码已失效
        """
        return self.request("/verify/qrcodestatus", cookie, env, qr=qr)

    def audio_match(
        self, duration, audioFP, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        听歌识曲
        说明: 使用此接口,上传音频文件或者麦克风采集声音可识别对应歌曲信息,具体调用例子参考 /audio_match_demo/index.html (项目文件: public/audio_match_demo/index.html)
        接口地址: /audio/match
        必选参数：
        duration: 音频时长,单位秒
        audioFP: 音频指纹,参考项目调用例子获取
        """
        return self.request(
            "/audio/match", cookie, env, duration=duration, audioFP=audioFP
        )

    def get_userids(self, nicknames, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        根据nickname获取userid
        说明: 使用此接口,传入用户昵称,可获取对应的用户id,支持批量获取,多个昵称用分号(;)隔开
        必选参数：
        nicknames: 用户昵称,多个用分号(;)隔开
        接口地址: /get/userids
        调用例子: /get/userids?nicknames=binaryify /get/userids?nicknames=binaryify;binaryify2
        """
        return self.request("/get/userids", cookie, env, nicknames=nicknames)

    def ugc_album_get(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        专辑简要百科信息
        说明: 登录后调用此接口,使用此接口,传入专辑id,可获取对应的专辑简要百科信息
        必选参数：
        id: 专辑id
        接口地址: /ugc/album/get
        调用例子: /ugc/album/get?id=168223858
        """
        return self.request("/ugc/album/get", cookie, env, id=id)

    def ugc_song_get(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌曲简要百科信息
        说明: 登录后调用此接口,使用此接口,传入歌曲id,可获取对应的歌曲简要百科信息
        必选参数：
        id: 歌曲id
        接口地址: /ugc/song/get
        调用例子: /ugc/song/get?id=2058263032
        """
        return self.request("/ugc/song/get", cookie, env, id=id)

    def ugc_artist_get(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌手简要百科信息
        说明: 登录后调用此接口,使用此接口,传入歌手id,可获取对应的歌手简要百科信息
        必选参数：
        id: 歌手id
        接口地址: /ugc/artist/get
        调用例子: /ugc/artist/get?id=15396
        """
        return self.request("/ugc/artist/get", cookie, env, id=id)

    def ugc_mv_get(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        mv简要百科信息
        说明: 登录后调用此接口,使用此接口,传入mv id,可获取对应的mv简要百科信息
        必选参数：
        id: mv id
        接口地址: /ugc/mv/get
        调用例子: /ugc/mv/get?id=14572641
        """
        return self.request("/ugc/mv/get", cookie, env, id=id)

    def ugc_artist_search(
        self, keyword, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        搜索歌手
        说明: 登录后调用此接口,使用此接口,传入歌手名关键字或者歌手id,可获取搜索到的歌手信息
        必选参数：
        keyword: 关键字或歌手id
        可选参数：
        limit: 取出条目数量 , 默认为 40
        接口地址: /ugc/artist/search
        调用例子: /ugc/artist/search?keyword=sasakure
        """
        return self.request(
            "/ugc/artist/search", cookie, env, keyword=keyword, limit=limit
        )

    def ugc_detail(
        self,
        type,
        limit=None,
        offset=None,
        auditStatus=None,
        order=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        用户贡献内容
        说明: 登录后调用此接口,使用此接口,可获取当前登录用户贡献内容
        必选参数：
        type: 内容种类
        分为以下几种类型:
        曲库纠错 歌手:1 专辑:2 歌曲:3 MV:4 歌词:5 翻译:6
        曲库补充 专辑:101 MV:103
        可选参数：
        limit: 取出条目数量 , 默认为 10
        offset: 偏移数量
        auditStatus: 审核状态
        待审核:0 未采纳:-5 审核中:1 部分审核通过:4 审核通过:5
        order: 排序,默认为降序 降序:desc 顺序:asc
        接口地址: /ugc/detail
        调用例子: /ugc/detail
        """
        return self.request(
            "/ugc/detail",
            cookie,
            env,
            type=type,
            limit=limit,
            offset=offset,
            auditStatus=auditStatus,
            order=order,
        )

    def ugc_user_devote(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        用户贡献条目、积分、云贝数量
        说明: 登录后调用此接口,使用此接口,可获取当前登录用户贡献条目、积分、云贝数量
        接口地址: /ugc/user/devote
        调用例子: /ugc/user/devote
        """
        return self.request("/ugc/user/devote", cookie, env)

    def summary_annual(self, year, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        年度听歌报告
        说明: 登录后调用此接口,使用此接口,可获取当前登录用户年度听歌报告，目前支持2017-2024年的报告
        必选参数：
        year: 报告年份
        接口地址: /summary/annual
        调用例子: /summary/annual?year=2024
        """
        return self.request("/summary/annual", cookie, env, year=year)

    def search_match(
        self, title, album, artist, duration, md5, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        本地歌曲文件匹配网易云歌曲信息
        说明: 调用此接口可以为本地歌曲文件搜索匹配歌曲ID、专辑封面等信息
        必选参数：
        title: 文件的标题信息，是文件属性里的标题属性，并非文件名
        album: 文件的专辑信息
        artist: 文件的艺术家信息
        duration: 文件的时长，单位为秒
        md5: 文件的md5
        接口地址: /search/match
        调用例子: /search/match?title=富士山下&album=&artist=陈奕迅&duration=259.21&md5=bd708d006912a09d827f02e754cf8e56
        """
        return self.request(
            "/search/match",
            cookie,
            env,
            title=title,
            album=album,
            artist=artist,
            duration=duration,
            md5=md5,
        )

    def song_music_detail(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌曲音质详情
        说明: 调用此接口获取歌曲各个音质的文件信息，与 获取歌曲详情 接口相比，多出 高清环绕声、沉浸环绕声、超清母带等音质的信息
        必选参数：
        id: 歌曲id
        接口地址: /song/music/detail
        调用例子: /song/music/detail?id=2082700997
        返回字段说明 :

        "br": 比特率Bit Rate,
        "size": 文件大小,
        "vd": Volume Delta,
        "sr": 采样率Sample Rate

        """
        return self.request("/song/music/detail", cookie, env, id=id)

    def song_red_count(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌曲红心数量
        说明: 调用此接口获取歌曲的红心用户数量
        必选参数：
        id: 歌曲id
        接口地址: /song/red/count
        调用例子: /song/red/count?id=186016
        """
        return self.request("/song/red/count", cookie, env, id=id)

    def personal_fm_mode(
        self, mode, submode=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        私人 FM 模式选择
        说明: 调用此接口返回私人 FM 内容, 并可以选择模式
        必选参数：
        mode: 模式 (aidj, DEFAULT, FAMILIAR, EXPLORE, SCENE_RCMD)
        可选参数：
        submode: 当 mode 为 SCENE_RCMD 是可为 ( EXERCISE, FOCUS, NIGHT_EMO )
        接口地址: /personal/fm/mode
        """
        return self.request(
            "/personal/fm/mode", cookie, env, mode=mode, submode=submode
        )

    def album_privilege(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        获取专辑歌曲的音质
        说明 : 调用后可获取专辑歌曲的音质
        必选参数 : id : 专辑 id
        接口地址 : /album/privilege
        调用例子 : /album/privilege?id=168223858
        """
        return self.request("/album/privilege", cookie, env, id=id)

    def artist_detail_dynamic(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌手详情动态
        说明 : 调用后可获取歌手详情动态部分,如是否关注,视频数
        必选参数 : id : 歌手 id
        接口地址 : /artist/detail/dynamic
        调用例子 : /artist/detail/dynamic?id=15396
        """
        return self.request("/artist/detail/dynamic", cookie, env, id=id)

    def recent_listen_list(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        最近听歌列表
        说明 : 调用后可获取最近听歌列表
        接口地址 : /recent/listen/list
        """
        return self.request("/recent/listen/list", cookie, env)

    def cloud_import(
        self,
        song,
        fileType,
        fileSize,
        bitrate,
        md5,
        id=None,
        artist=None,
        album=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        云盘导入歌曲
        说明: 登录后调用此接口,使用此接口,可云盘导入歌曲而无需上传文件
        以下情况可导入成功
        1.文件已经有用户上传至云盘
        2.文件是网易云音乐自己的音源
        必选参数：
        song: 歌名/文件名
        fileType: 文件后缀
        fileSize: 文件大小
        bitrate: 文件比特率
        md5: 文件MD5
        可选参数：
        id: 歌曲ID,情况2时必须正确填写
        artist: 歌手 默认为未知
        album: 专辑 默认为未知
        接口地址: /cloud/import
        调用例子: /cloud/import?song=最伟大的作品&artist=周杰伦&album=最伟大的作品&fileType=flac&fileSize=50412168&bitrate=1652&md5=d02b8ab79d91c01167ba31e349fe5275
        为保证成功,请使用 获取音乐url 接口获取各文件属性
        其中比特率bitrate要进行以下转换

        bitrate = Math.floor(br / 1000)

        导入后的文件名后缀均为 .mp3 。但用 获取音乐url 获取到的文件格式仍然是正确的。
        """
        return self.request(
            "/cloud/import",
            cookie,
            env,
            song=song,
            fileType=fileType,
            fileSize=fileSize,
            bitrate=bitrate,
            md5=md5,
            id=id,
            artist=artist,
            album=album,
        )

    def song_download_url_v1(
        self, id, level, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        获取客户端歌曲下载链接 - 新版
        说明 : 使用 /song/url/v1 接口获取的是歌曲试听 url, 非 VIP 账号最高只能获取 极高 音质，但免费类型的歌曲(fee == 0)使用本接口可最高获取Hi-Res音质的url。
        必选参数 : id : 音乐 id
        level: 播放音质等级, 分为 standard => 标准,higher => 较高, exhigh=>极高,
        lossless=>无损, hires=>Hi-Res, jyeffect => 高清环绕声, sky => 沉浸环绕声, dolby => 杜比全景声, jymaster => 超清母带
        接口地址 : /song/download/url/v1
        调用例子 : /song/download/url/v1?id=2155423468&level=hires
        """
        return self.request("/song/download/url/v1", cookie, env, id=id, level=level)

    def user_follow_mixed(
        self, size=None, cursor=None, scene=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        当前账号关注的用户/歌手
        说明 : 调用此接口, 可获得当前账号关注的用户/歌手
        可选参数 : size : 返回数量 , 默认为 30
        cursor : 返回数据的 cursor, 默认为 0 , 传入上一次返回结果的 cursor,将会返回下一页的数据
        scene : 场景, 0 表示所有关注, 1 表示关注的歌手, 2 表示关注的用户, 默认为 0
        接口地址 : /user/follow/mixed
        调用例子 : /user/follow/mixed?scene=1
        """
        return self.request(
            "/user/follow/mixed", cookie, env, size=size, cursor=cursor, scene=scene
        )

    def song_downlist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        会员下载歌曲记录
        说明 : 调用此接口, 可获得当前账号会员下载歌曲记录
        可选参数 :
        limit : 返回数量 , 默认为 20
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /song/downlist
        调用例子 : /song/downlist
        """
        return self.request("/song/downlist", cookie, env, limit=limit, offset=offset)

    def song_monthdownlist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        会员本月下载歌曲记录
        说明 : 调用此接口, 可获得当前账号会员本月下载歌曲记录
        可选参数 :
        limit : 返回数量 , 默认为 20
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /song/monthdownlist
        调用例子 : /song/monthdownlist
        """
        return self.request(
            "/song/monthdownlist", cookie, env, limit=limit, offset=offset
        )

    def song_singledownlist(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        已购买单曲
        说明 : 调用此接口, 可获得当前账号已购买单曲
        可选参数 :
        limit : 返回数量 , 默认为 20
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /song/singledownlist
        调用例子 : /song/singledownlist
        """
        return self.request(
            "/song/singledownlist", cookie, env, limit=limit, offset=offset
        )

    def song_like_check(self, ids, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌曲是否喜爱
        说明 : 登录后调用此接口, 传入歌曲id, 可判断歌曲是否被喜爱;
        若传入一个包含多个歌曲ID的数组, 则接口将返回一个由这些ID中被标记为喜爱的歌曲组成的数组
        必选参数 :
        ids: 歌曲 id 列表
        接口地址 : /song/like/check
        调用例子 : /song/like/check?ids=[2058263032,1497529942]
        """
        return self.request("/song/like/check", cookie, env, ids=ids)

    def user_mutualfollow_get(
        self, uid, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        用户是否互相关注
        说明 : 登录后调用此接口, 传入用户id, 可判断用户是否互相关注
        必选参数 :
        uid: 用户 id
        接口地址 : /user/mutualfollow/get
        调用例子 : /user/mutualfollow/get?uid=32953014
        """
        return self.request("/user/mutualfollow/get", cookie, env, uid=uid)

    def song_dynamic_cover(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌曲动态封面
        说明 : 登录后调用此接口, 传入歌曲id, 获取歌曲动态封面
        必选参数 :
        id: 歌曲 id
        接口地址 : /song/dynamic/cover
        调用例子 : /song/dynamic/cover?id=2101179024
        """
        return self.request("/song/dynamic/cover", cookie, env, id=id)

    def user_medal(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        用户徽章
        说明 : 调用此接口, 传入用户id, 获取用户徽章
        必选参数 :
        uid: 用户 id
        接口地址 : /user/medal
        调用例子 : /user/medal?uid=32953014
        """
        return self.request("/user/medal", cookie, env, uid=uid)

    def user_social_status(self, uid, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        用户状态
        说明 : 登录后调用此接口, 传入用户id, 获取用户状态
        必选参数 :
        uid: 用户 id
        接口地址 : /user/social/status
        调用例子 : /user/social/status?uid=32953014
        """
        return self.request("/user/social/status", cookie, env, uid=uid)

    def user_social_status_support(
        self, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        用户状态 - 支持设置的状态
        说明 : 登录后调用此接口, 获取支持设置的状态
        接口地址 : /user/social/status/support
        """
        return self.request("/user/social/status/support", cookie, env)

    def user_social_status_rcmd(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        用户状态 - 相同状态的用户
        说明 : 登录后调用此接口, 获取相同状态的用户
        接口地址 : /user/social/status/rcmd
        """
        return self.request("/user/social/status/rcmd", cookie, env)

    def user_social_status_edit(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        用户状态 - 编辑
        说明 : 登录后调用此接口, 编辑当前用户状态， 所需参数可在接口/user/social/status/support获取
        接口地址 : /user/social/status/edit
        """
        return self.request("/user/social/status/edit", cookie, env)

    def listen_data_year_report(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        听歌足迹 - 年度听歌足迹
        说明 : 登录后调用此接口, 获取年度听歌足迹
        接口地址 : /listen/data/year/report
        """
        return self.request("/listen/data/year/report", cookie, env)

    def listen_data_today_song(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        听歌足迹 - 今日收听
        说明 : 登录后调用此接口, 获取今日收听
        接口地址 : /listen/data/today/song
        """
        return self.request("/listen/data/today/song", cookie, env)

    def listen_data_total(self, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        听歌足迹 - 总收听时长
        说明 : 登录后调用此接口, 获取总收听时长; 相关接口可能需要vip权限
        接口地址 : /listen/data/total
        """
        return self.request("/listen/data/total", cookie, env)

    def listen_data_realtime_report(
        self, type, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        听歌足迹 - 本周/本月收听时长
        说明 : 登录后调用此接口, 获取本周/本月收听时长
        必选参数 :
        type: 维度类型 周 week 月 month; 今年没结束，不支持今年的数据
        接口地址 : /listen/data/realtime/report
        调用例子 : /listen/data/realtime/report?type=month
        """
        return self.request("/listen/data/realtime/report", cookie, env, type=type)

    def listen_data_report(
        self, type, endTime=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        听歌足迹 - 周/月/年收听报告
        说明 : 登录后调用此接口, 获取周/月/年收听报告
        必选参数 :
        type: 维度类型 周 week 月 month 年 year
        可选参数 :
        endTime : 周: 每周周六0点的时间戳 月: 每月最后一天0点的时间戳 年: 每年最后一天0点的时间戳
        不填就是本周/月的, 今年没结束，则没有今年的数据
        接口地址 : /listen/data/report
        调用例子 : /listen/data/report?type=month
        """
        return self.request(
            "/listen/data/report", cookie, env, type=type, endTime=endTime
        )

    def playlist_import_name_task_create(
        self,
        importStarPlaylist=None,
        playlistName=None,
        local=None,
        text=None,
        link=None,
        cookie={},
        env: NcmProcessEnv = None,
    ) -> Response:
        """
        歌单导入 - 元数据/文字/链接导入
        说明 : 登录后调用此接口, 支持通过元数据/文字/链接三种方式生成歌单; 三种方式不可同时调用
        接口地址 : /playlist/import/name/task/create
        可选参数 :
        importStarPlaylist : 是否导入我喜欢的音乐, 此项为true则不生成新的歌单
        playlistName : 生成的歌单名, 仅文字导入和链接导入支持, 默认为'导入音乐 '.concat(new Date().toLocaleString())
        元数据导入 :
        local: json类型的字符串, 如：
        javascript
        let local = encodeURIComponent(
        JSON.stringify([
        {
        name: 'アイニーブルー', // 歌曲名称
        artist: 'ZLMS',        // 艺术家名称
        album: 'アイニーブルー',// 专辑名称
        },
        {
        name: 'ファンタズマ',
        artist: 'sasakure.UK',
        album: '未来イヴ',
        },
        ]),
        )

        调用例子 : /playlist/import/name/task/create?local=${local}
        文字导入 :
        text: 导入的文字, 如：
        javascript
        let text = encodeURIComponent(アイニーブルー ZLMS
        ファンタズマ sasakure.UK)

        调用例子 : /playlist/import/name/task/create?text=${text}
        链接导入 :
        link: 存有歌单链接的数组类型的字符串, 如：
        javascript
        let link = encodeURIComponent(
        JSON.stringify([
        'https://i.y.qq.com/n2/m/share/details/taoge.html?id=7716341988&hosteuin=',
        'https://i.y.qq.com/n2/m/share/details/taoge.html?id=8010042041&hosteuin=',
        ]),
        )

        歌单链接来源:
        1. 将歌单分享到微信/微博/QQ后复制链接
        2. 直接复制歌单/个人主页链接
        3. 直接复制文章链接
        调用例子 : /playlist/import/name/task/create?link=${link}
        """
        return self.request(
            "/playlist/import/name/task/create",
            cookie,
            env,
            importStarPlaylist=importStarPlaylist,
            playlistName=playlistName,
            local=local,
            text=text,
            link=link,
        )

    def playlist_import_task_status(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌单导入 - 任务状态
        说明: 调用此接口, 传入导入歌单任务id, 获取任务状态
        必选参数：
        id: 任务id
        接口地址: /playlist/import/task/status
        调用例子: /playlist/import/task/status?id=123834369
        """
        return self.request("/playlist/import/task/status", cookie, env, id=id)

    def song_chorus(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        副歌时间
        说明: 调用此接口, 传入歌曲id, 获取副歌时间
        必选参数：
        id: 歌曲id
        接口地址: /song/chorus
        调用例子: /song/chorus?id=2058263032
        """
        return self.request("/song/chorus", cookie, env, id=id)

    def playlist_detail_rcmd_get(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        相关歌单推荐
        说明: 调用此接口, 传入歌单id, 获取相关歌单推荐
        必选参数：
        id: 歌单id
        接口地址: /playlist/detail/rcmd/get
        调用例子: /playlist/detail/rcmd/get?id=8039587836
        """
        return self.request("/playlist/detail/rcmd/get", cookie, env, id=id)

    def song_lyrics_mark(self, id, cookie={}, env: NcmProcessEnv = None) -> Response:
        """
        歌词摘录 - 歌词摘录信息
        说明: 登录后调用此接口, 传入歌曲id, 获取歌词摘录信息
        必选参数：
        id: 歌曲id
        接口地址: /song/lyrics/mark
        调用例子: /song/lyrics/mark?id=2058263032
        """
        return self.request("/song/lyrics/mark", cookie, env, id=id)

    def song_lyrics_mark_user_page(
        self, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌词摘录 - 我的歌词本
        说明: 登录后调用此接口, 获取我的歌词本
        可选参数 :
        limit : 返回数量 , 默认为 20
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址: /song/lyrics/mark/user/page
        调用例子: /song/lyrics/mark/user/page
        """
        return self.request(
            "/song/lyrics/mark/user/page", cookie, env, limit=limit, offset=offset
        )

    def song_lyrics_mark_add(
        self, id, data, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌词摘录 - 添加/修改摘录歌词
        说明: 登录后调用此接口, 传入歌曲id, 可以添加/修改摘录歌词
        必选参数：
        id: 歌曲id
        data: 存储歌词摘录信息的对象数组的字符串，如:
        javascript
        let data = encodeURIComponent(
        JSON.stringify([
        {
        "translateType": 1,
        "startTimeStamp": 800,
        "translateLyricsText": "让我逃走吧、声音已经枯萎",
        "originalLyricsText": "逃がし てくれって声を枯らした"
        }
        ]),
        )

        若需要修改摘录信息, 则需要填入参数markId, 修改对应的摘录信息
        接口地址: /song/lyrics/mark/add
        """
        return self.request("/song/lyrics/mark/add", cookie, env, id=id, data=data)

    def song_lyrics_mark_del(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        歌词摘录 - 删除摘录歌词
        说明: 登录后调用此接口, 传入摘录歌词id, 删除摘录歌词
        必选参数：
        id: 摘录歌词id
        接口地址: /song/lyrics/mark/del
        调用例子: /song/lyrics/mark?id=2083850
        """
        return self.request("/song/lyrics/mark/del", cookie, env, id=id)

    def broadcast_category_region_get(
        self, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        广播电台 - 分类/地区信息
        说明: 调用此接口, 获取广播电台 - 分类/地区信息
        接口地址: /broadcast/category/region/get
        调用例子: /broadcast/category/region/get
        """
        return self.request("/broadcast/category/region/get", cookie, env)

    def broadcast_channel_collect_list(
        self, limit=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        广播电台 - 我的收藏
        说明: 调用此接口, 获取广播电台 - 我的收藏
        可选参数 :
        limit : 返回数量 , 默认为 99999
        接口地址: /broadcast/channel/collect/list
        调用例子: /broadcast/channel/collect/list
        """
        return self.request("/broadcast/channel/collect/list", cookie, env, limit=limit)

    def broadcast_channel_currentinfo(
        self, id, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        广播电台 - 电台信息
        说明: 调用此接口, 传入电台id, 获取广播电台 - 电台信息
        必选参数：
        id: 电台id
        接口地址: /broadcast/channel/currentinfo
        调用例子: /broadcast/channel/currentinfo?id=5
        """
        return self.request("/broadcast/channel/currentinfo", cookie, env, id=id)

    def broadcast_channel_list(
        self, categoryId=None, regionId=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        广播电台 - 全部电台
        说明: 调用此接口, 获取广播电台 - 全部电台
        可选参数 :
        categoryId : 类别id, 默认为 0，可从“广播电台 - 分类/地区信息”接口获取
        regionId : 地区id, 默认为 0，可从“广播电台 - 分类/地区信息”接口获取
        接口地址: /broadcast/channel/list
        调用例子: /broadcast/channel/list
        """
        return self.request(
            "/broadcast/channel/list",
            cookie,
            env,
            categoryId=categoryId,
            regionId=regionId,
        )

    def user_playlist_create(
        self, uid, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        用户的创建歌单列表
        说明 : 调用此接口, 传入用户id, 获取用户的创建歌单列表
        必选参数 :
        uid: 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 100
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /user/playlist/create
        调用例子 : /user/playlist/create?uid=32953014
        """
        return self.request(
            "/user/playlist/create", cookie, env, uid=uid, limit=limit, offset=offset
        )

    def user_playlist_collect(
        self, uid, limit=None, offset=None, cookie={}, env: NcmProcessEnv = None
    ) -> Response:
        """
        用户的收藏歌单列表
        说明 : 调用此接口, 传入用户id, 获取用户的收藏歌单列表
        必选参数 :
        uid: 用户 id
        可选参数 :
        limit : 返回数量 , 默认为 100
        offset : 偏移数量，用于分页 ,如 :( 页数 -1)\*30, 其中 30 为 limit 的值 , 默认为 0
        接口地址 : /user/playlist/collect
        调用例子 : /user/playlist/collect?uid=32953014
        """
        return self.request(
            "/user/playlist/collect", cookie, env, uid=uid, limit=limit, offset=offset
        )
