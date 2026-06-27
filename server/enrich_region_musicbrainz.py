"""
通过 MusicBrainz API 批量获取歌手地区信息
MusicBrainz 是开放的音乐数据库，提供歌手国家信息
要求: 每秒最多 1 个请求
"""
import time
import requests
import pymysql

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '12345678',
    'database': 'music_dashboard',
    'charset': 'utf8mb4'
}

HEADERS = {
    'User-Agent': 'MusicViz/1.0 (https://github.com/student/musicviz) student project'
}

# ISO 3166-1 alpha-2 -> 中文地区名
COUNTRY_MAP = {
    'CN': '中国',
    'TW': '中国台湾',
    'HK': '中国香港',
    'MO': '中国澳门',
    'US': '美国',
    'GB': '英国',
    'CA': '加拿大',
    'AU': '澳大利亚',
    'NZ': '新西兰',
    'JP': '日本',
    'KR': '韩国',
    'SG': '新加坡',
    'MY': '马来西亚',
    'TH': '泰国',
    'VN': '越南',
    'ID': '印度尼西亚',
    'PH': '菲律宾',
    'IN': '印度',
    'RU': '俄罗斯',
    'FR': '法国',
    'DE': '德国',
    'IT': '意大利',
    'ES': '西班牙',
    'PT': '葡萄牙',
    'NL': '荷兰',
    'BE': '比利时',
    'CH': '瑞士',
    'AT': '奥地利',
    'SE': '瑞典',
    'NO': '挪威',
    'DK': '丹麦',
    'FI': '芬兰',
    'IE': '爱尔兰',
    'PL': '波兰',
    'CZ': '捷克',
    'HU': '匈牙利',
    'RO': '罗马尼亚',
    'BG': '保加利亚',
    'GR': '希腊',
    'TR': '土耳其',
    'IL': '以色列',
    'EG': '埃及',
    'ZA': '南非',
    'NG': '尼日利亚',
    'BR': '巴西',
    'AR': '阿根廷',
    'MX': '墨西哥',
    'CL': '智利',
    'CO': '哥伦比亚',
    'PE': '秘鲁',
    'CU': '古巴',
    'JM': '牙买加',
    'BB': '巴巴多斯',
    'PR': '波多黎各',
    'PK': '巴基斯坦',
    'BD': '孟加拉',
    'MM': '缅甸',
    'KH': '柬埔寨',
    'LA': '老挝',
    'UA': '乌克兰',
    'HR': '克罗地亚',
    'RS': '塞尔维亚',
    'LT': '立陶宛',
    'LV': '拉脱维亚',
    'EE': '爱沙尼亚',
    'IS': '冰岛',
    'LU': '卢森堡',
    'MT': '马耳他',
    'CY': '塞浦路斯',
    'SK': '斯洛伐克',
    'SI': '斯洛文尼亚',
    'AL': '阿尔巴尼亚',
    'MK': '北马其顿',
    'BA': '波黑',
    'ME': '黑山',
    'MD': '摩尔多瓦',
    'BY': '白俄罗斯',
    'KZ': '哈萨克斯坦',
    'UZ': '乌兹别克斯坦',
    'GE': '格鲁吉亚',
    'AM': '亚美尼亚',
    'AZ': '阿塞拜疆',
    'IR': '伊朗',
    'IQ': '伊拉克',
    'SA': '沙特阿拉伯',
    'AE': '阿联酋',
    'QA': '卡塔尔',
    'KW': '科威特',
    'BH': '巴林',
    'OM': '阿曼',
    'JO': '约旦',
    'LB': '黎巴嫩',
    'SY': '叙利亚',
    'PS': '巴勒斯坦',
    'YE': '也门',
    'AF': '阿富汗',
    'NP': '尼泊尔',
    'LK': '斯里兰卡',
    'MV': '马尔代夫',
    'BT': '不丹',
    'MN': '蒙古',
    'KP': '朝鲜',
    'TJ': '塔吉克斯坦',
    'KG': '吉尔吉斯斯坦',
    'TM': '土库曼斯坦',
    'VE': '委内瑞拉',
    'EC': '厄瓜多尔',
    'BO': '玻利维亚',
    'PY': '巴拉圭',
    'UY': '乌拉圭',
    'GY': '圭亚那',
    'SR': '苏里南',
    'TT': '特立尼达和多巴哥',
    'BS': '巴哈马',
    'BZ': '伯利兹',
    'CR': '哥斯达黎加',
    'PA': '巴拿马',
    'NI': '尼加拉瓜',
    'HN': '洪都拉斯',
    'GT': '危地马拉',
    'SV': '萨尔瓦多',
    'DO': '多米尼加',
    'HT': '海地',
    'KE': '肯尼亚',
    'TZ': '坦桑尼亚',
    'UG': '乌干达',
    'GH': '加纳',
    'CI': '科特迪瓦',
    'CM': '喀麦隆',
    'SN': '塞内加尔',
    'ML': '马里',
    'BF': '布基纳法索',
    'NE': '尼日尔',
    'TD': '乍得',
    'SD': '苏丹',
    'ET': '埃塞俄比亚',
    'SO': '索马里',
    'DJ': '吉布提',
    'ER': '厄立特里亚',
    'SS': '南苏丹',
    'CF': '中非',
    'CG': '刚果(布)',
    'CD': '刚果(金)',
    'GA': '加蓬',
    'GQ': '赤道几内亚',
    'ST': '圣多美和普林西比',
    'AO': '安哥拉',
    'ZM': '赞比亚',
    'ZW': '津巴布韦',
    'BW': '博茨瓦纳',
    'NA': '纳米比亚',
    'MZ': '莫桑比克',
    'MG': '马达加斯加',
    'MU': '毛里求斯',
    'SC': '塞舌尔',
    'KM': '科摩罗',
    'CV': '佛得角',
    'GW': '几内亚比绍',
    'GN': '几内亚',
    'SL': '塞拉利昂',
    'LR': '利比里亚',
    'BJ': '贝宁',
    'TG': '多哥',
    'RW': '卢旺达',
    'BI': '布隆迪',
    'LS': '莱索托',
    'SZ': '斯威士兰',
    'MW': '马拉维',
    'FJ': '斐济',
    'PG': '巴布亚新几内亚',
    'SB': '所罗门群岛',
    'VU': '瓦努阿图',
    'NC': '新喀里多尼亚',
    'PF': '法属波利尼西亚',
    'WS': '萨摩亚',
    'TO': '汤加',
    'KI': '基里巴斯',
    'TV': '图瓦卢',
    'NR': '瑙鲁',
    'MH': '马绍尔群岛',
    'FM': '密克罗尼西亚',
    'PW': '帕劳',
    'GU': '关岛',
    'AS': '美属萨摩亚',
    'MP': '北马里亚纳群岛',
    'VI': '美属维尔京群岛',
    'PR': '波多黎各',
}


def search_musicbrainz(artist_name):
    """搜索 MusicBrainz 获取歌手国家"""
    try:
        url = 'https://musicbrainz.org/ws/2/artist/'
        params = {
            'query': artist_name,
            'fmt': 'json',
            'limit': 5
        }
        resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        data = resp.json()
        artists = data.get('artists', [])

        # 找最匹配的结果（类型是 Person 或 Group，且有 country）
        for a in artists:
            country = a.get('country')
            artist_type = a.get('type', '')
            if country and artist_type in ('Person', 'Group', None):
                # 优先精确匹配名字
                if a.get('name', '').lower() == artist_name.lower():
                    return country
                # 也接受包含关系
                if artist_name.lower() in a.get('name', '').lower() or a.get('name', '').lower() in artist_name.lower():
                    return country

        # 如果没有精确匹配，返回第一个有 country 的
        for a in artists:
            country = a.get('country')
            if country:
                return country

        return None
    except Exception as e:
        print(f"  [ERROR] {artist_name}: {e}")
        return None


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=1000, help='最多处理多少歌手')
    parser.add_argument('--dry-run', action='store_true', help='只查询不更新数据库')
    args = parser.parse_args()

    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # 获取没有 region 的歌手，优先处理歌曲数多的
    cursor.execute("""
        SELECT id, name, music_size 
        FROM artists 
        WHERE (region IS NULL OR region = '')
          AND name IS NOT NULL AND name != ''
        ORDER BY music_size DESC
        LIMIT %s
    """, (args.limit,))
    artists = cursor.fetchall()

    print(f"共 {len(artists)} 位歌手待处理")

    updated = 0
    skipped = 0
    failed = 0

    for i, (artist_id, name, music_size) in enumerate(artists):
        print(f"[{i+1}/{len(artists)}] {name} (歌曲数: {music_size})...", end=' ', flush=True)

        country_code = search_musicbrainz(name)

        if country_code and country_code in COUNTRY_MAP:
            region = COUNTRY_MAP[country_code]
            print(f"-> {region} ({country_code})")
            if not args.dry_run:
                cursor.execute(
                    "UPDATE artists SET region = %s, region_code = %s WHERE id = %s",
                    (region, country_code, artist_id)
                )
            updated += 1
        elif country_code:
            print(f"-> 未知国家代码: {country_code}")
            skipped += 1
        else:
            print("-> 未找到")
            skipped += 1

        # MusicBrainz 要求每秒最多 1 个请求
        if (i + 1) % 50 == 0:
            if not args.dry_run:
                conn.commit()
            print(f"  ... 已提交，休息 5 秒 ...")
            time.sleep(5)
        else:
            time.sleep(1.1)  # 略大于 1 秒

    if not args.dry_run:
        conn.commit()

    print(f"\n完成! 更新: {updated}, 未找到: {skipped}, 失败: {failed}")

    # 统计
    if not args.dry_run:
        cursor.execute("""
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN region IS NOT NULL AND region != '' THEN 1 ELSE 0 END) AS has_region
            FROM artists
        """)
        total, has_region = cursor.fetchone()
        print(f"\n数据库统计: 总歌手 {total}, 有地区 {has_region} ({has_region/total*100:.1f}%)")

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
