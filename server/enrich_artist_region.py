"""
从百度百科爬取歌手地区信息，补充到数据库
用法: python3 server/enrich_artist_region.py [--limit N] [--dry-run]
"""
import argparse
import re
import time
import requests
from bs4 import BeautifulSoup
import pymysql

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '12345678',
    'database': 'music_dashboard',
    'charset': 'utf8mb4'
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

# 出生地/国籍 -> 数据库 region 字段的映射
REGION_MAP = {
    # 中国大陆
    '中国': '中国',
    '中国大陆': '中国',
    '北京': '中国',
    '上海': '中国',
    '广东': '中国',
    '四川': '中国',
    '湖南': '中国',
    '浙江': '中国',
    '江苏': '中国',
    '山东': '中国',
    '湖北': '中国',
    '福建': '中国',
    '河南': '中国',
    '河北': '中国',
    '辽宁': '中国',
    '陕西': '中国',
    '重庆': '中国',
    '天津': '中国',
    '黑龙江': '中国',
    '吉林': '中国',
    '山西': '中国',
    '安徽': '中国',
    '江西': '中国',
    '广西': '中国',
    '云南': '中国',
    '贵州': '中国',
    '甘肃': '中国',
    '海南': '中国',
    '内蒙古': '中国',
    '新疆': '中国',
    '西藏': '中国',
    '宁夏': '中国',
    '青海': '中国',
    # 台湾
    '台湾': '中国台湾',
    '中国台湾': '中国台湾',
    '台湾省': '中国台湾',
    '台北': '中国台湾',
    '新北': '中国台湾',
    '高雄': '中国台湾',
    '台中': '中国台湾',
    '台南': '中国台湾',
    '桃园': '中国台湾',
    # 香港
    '香港': '中国香港',
    '中国香港': '中国香港',
    '香港特别行政区': '中国香港',
    # 澳门
    '澳门': '中国澳门',
    '中国澳门': '中国澳门',
    # 其他国家
    '美国': '美国',
    '英国': '英国',
    '日本': '日本',
    '韩国': '韩国',
    '法国': '法国',
    '德国': '德国',
    '意大利': '意大利',
    '加拿大': '加拿大',
    '澳大利亚': '澳大利亚',
    '新西兰': '新西兰',
    '新加坡': '新加坡',
    '马来西亚': '马来西亚',
    '泰国': '泰国',
    '越南': '越南',
    '印度尼西亚': '印度尼西亚',
    '菲律宾': '菲律宾',
    '印度': '印度',
    '俄罗斯': '俄罗斯',
    '巴西': '巴西',
    '墨西哥': '墨西哥',
    '西班牙': '西班牙',
    '荷兰': '荷兰',
    '瑞典': '瑞典',
    '挪威': '挪威',
    '丹麦': '丹麦',
    '芬兰': '芬兰',
    '瑞士': '瑞士',
    '奥地利': '奥地利',
    '比利时': '比利时',
    '葡萄牙': '葡萄牙',
    '爱尔兰': '爱尔兰',
    '波兰': '波兰',
    '乌克兰': '乌克兰',
    '土耳其': '土耳其',
    '以色列': '以色列',
    '南非': '南非',
    '埃及': '埃及',
    '尼日利亚': '尼日利亚',
    '阿根廷': '阿根廷',
    '智利': '智利',
    '哥伦比亚': '哥伦比亚',
    '秘鲁': '秘鲁',
    '古巴': '古巴',
    '牙买加': '牙买加',
    '巴基斯坦': '巴基斯坦',
    '孟加拉': '孟加拉',
    '缅甸': '缅甸',
    '柬埔寨': '柬埔寨',
    '老挝': '老挝',
}


def get_artist_region(artist_name):
    """从百度百科获取歌手的地区信息"""
    try:
        url = f'https://baike.baidu.com/item/{artist_name}'
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')

        # 查找所有 dt/dd 对
        for dt in soup.find_all('dt'):
            key = dt.get_text(strip=True).replace('\xa0', '').replace(' ', '')
            dd = dt.find_next_sibling('dd')
            if not dd:
                continue
            value = dd.get_text(strip=True)

            # 优先匹配出生地
            if key in ('出生地', '出生地点'):
                return _parse_location(value)
            # 其次匹配国籍
            if key in ('国籍',):
                return _parse_location(value)

        return None
    except Exception as e:
        print(f"  [ERROR] {artist_name}: {e}")
        return None


def _parse_location(text):
    """从地点文本中提取 region"""
    if not text:
        return None

    # 清理文本
    text = text.strip()

    # 精确匹配
    if text in REGION_MAP:
        return REGION_MAP[text]

    # 模糊匹配：检查文本中是否包含某个 key
    for key, region in REGION_MAP.items():
        if key in text:
            return region

    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=100, help='最多处理多少歌手')
    parser.add_argument('--dry-run', action='store_true', help='只查询不更新数据库')
    args = parser.parse_args()

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # 获取没有 region 的歌手，优先处理歌曲数多的
    cursor.execute("""
        SELECT id, name, music_size 
        FROM artists 
        WHERE (region IS NULL OR region = '')
        ORDER BY music_size DESC
        LIMIT %s
    """, (args.limit,))
    artists = cursor.fetchall()

    print(f"共 {len(artists)} 位歌手待处理")

    updated = 0
    skipped = 0
    failed = 0

    for i, (artist_id, name, music_size) in enumerate(artists):
        print(f"[{i+1}/{len(artists)}] {name} (歌曲数: {music_size})...", end=' ')

        region = get_artist_region(name)

        if region:
            print(f"-> {region}")
            if not args.dry_run:
                cursor.execute(
                    "UPDATE artists SET region = %s WHERE id = %s",
                    (region, artist_id)
                )
            updated += 1
        else:
            print("-> 未找到")
            skipped += 1

        # 每 10 个提交一次，并延迟避免被封
        if (i + 1) % 10 == 0:
            if not args.dry_run:
                conn.commit()
            time.sleep(2)
        else:
            time.sleep(0.5)

    if not args.dry_run:
        conn.commit()

    print(f"\n完成! 更新: {updated}, 未找到: {skipped}, 失败: {failed}")

    # 统计更新后的地区分布
    if not args.dry_run:
        cursor.execute("""
            SELECT region, COUNT(*) AS cnt 
            FROM artists 
            WHERE region IS NOT NULL AND region != '' 
            GROUP BY region 
            ORDER BY cnt DESC
        """)
        print("\n地区分布:")
        for region, cnt in cursor.fetchall():
            print(f"  {region}: {cnt}")

    cursor.close()
    conn.close()


if __name__ == '__main__':
    main()
