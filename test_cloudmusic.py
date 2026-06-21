import sys
sys.path.insert(0, '/Users/smallshark/Desktop/works/Data Visualization/期末/cloudmusic-master')

import cloudmusic
import json

# 测试歌曲ID（周杰伦的《晴天》）
song_id = "186166"

try:
    # 直接调用API查看返回格式
    api = cloudmusic.api.Api()
    result = api.get_commets({"ID": song_id, "offset": "0", "total": "true", "limit": "10"})
    print("API返回数据结构:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
except Exception as e:
    import traceback
    print(f"❌ 出错: {e}")
    traceback.print_exc()
