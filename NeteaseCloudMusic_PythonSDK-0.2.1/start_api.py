#!/usr/bin/env python3
"""
网易云音乐API服务启动脚本
提供HTTP接口供Node.js后端调用
默认端口：4000
"""

from flask import Flask, jsonify, request
from MusicLibrary.neteaseCloudMusicApi import NeteaseCloudMusicApi

app = Flask(__name__)
ncm_api = NeteaseCloudMusicApi()

@app.route('/search/hot/detail', methods=['GET'])
def search_hot_detail():
    """获取热搜详情列表"""
    try:
        response = ncm_api.search_hot_detail()
        data = response.data
        if data.get('code') == 200 or data.get('data', {}).get('code') == 200:
            return jsonify(data)
        else:
            return jsonify({"code": 500, "msg": "API调用失败"})
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)})

@app.route('/search/hot', methods=['GET'])
def search_hot():
    """获取热搜列表（简略版）"""
    try:
        response = ncm_api.search_hot()
        data = response.data
        if data.get('code') == 200 or data.get('data', {}).get('code') == 200:
            return jsonify(data)
        else:
            return jsonify({"code": 500, "msg": "API调用失败"})
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)})

@app.route('/artist/detail', methods=['GET'])
def artist_detail():
    """获取歌手详情"""
    try:
        artist_id = request.args.get('id')
        if not artist_id:
            return jsonify({"code": 400, "msg": "缺少歌手ID"})
        
        response = ncm_api.artist_detail(id=artist_id)
        data = response.data
        return jsonify(data)
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)})

@app.route('/artist/top/song', methods=['GET'])
def artist_top_song():
    """获取歌手热门歌曲"""
    try:
        artist_id = request.args.get('id')
        if not artist_id:
            return jsonify({"code": 400, "msg": "缺少歌手ID"})
        
        response = ncm_api.artist_top_song(id=artist_id)
        data = response.data
        return jsonify(data)
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)})

@app.route('/song/detail', methods=['GET'])
def song_detail():
    """获取歌曲详情"""
    try:
        ids = request.args.get('ids')
        if not ids:
            return jsonify({"code": 400, "msg": "缺少歌曲ID"})
        
        response = ncm_api.song_detail(ids=ids)
        data = response.data
        return jsonify(data)
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)})

@app.route('/')
def index():
    return "网易云音乐API服务运行中"

if __name__ == '__main__':
    print("🚀 网易云音乐API服务启动...")
    print("📡 服务地址: http://localhost:4000")
    print("🔗 热搜接口: http://localhost:4000/search/hot/detail")
    print("=" * 50)
    app.run(host='0.0.0.0', port=4000, debug=False)
