"""
用已知歌手地区数据批量更新数据库
不依赖外部爬取，基于公开信息手动维护
"""
import pymysql

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '12345678',
    'database': 'music_dashboard',
    'charset': 'utf8mb4'
}

# 已知歌手 -> 地区映射（基于公开信息）
KNOWN_ARTISTS = {
    # 中国大陆
    '周深': '中国',
    '薛之谦': '中国',
    '李荣浩': '中国',
    '毛不易': '中国',
    '华晨宇': '中国',
    '张杰': '中国',
    '李健': '中国',
    '朴树': '中国',
    '许嵩': '中国',
    '汪峰': '中国',
    '崔健': '中国',
    '郑钧': '中国',
    '韩红': '中国',
    '刘欢': '中国',
    '张靓颖': '中国',
    '周笔畅': '中国',
    '李宇春': '中国',
    '胡彦斌': '中国',
    '大张伟': '中国',
    '任然': '中国',
    '刘惜君': '中国',
    '杨坤': '中国',
    '单依纯': '中国',
    '陈粒': '中国',
    '阿鲲': '中国',
    '王菲': '中国',
    '那英': '中国',
    '宋祖英': '中国',
    '田震': '中国',
    '郁可唯': '中国',
    '谭维维': '中国',
    '尚雯婕': '中国',

    # 中国台湾
    '周杰伦': '中国台湾',
    '蔡依林': '中国台湾',
    '张惠妹': '中国台湾',
    '李宗盛': '中国台湾',
    '罗大佑': '中国台湾',
    '邓丽君': '中国台湾',
    '陶喆': '中国台湾',
    '吴克群': '中国台湾',
    '萧敬腾': '中国台湾',
    '杨宗纬': '中国台湾',
    '林宥嘉': '中国台湾',
    '徐佳莹': '中国台湾',
    'A-Lin': '中国台湾',
    '田馥甄': '中国台湾',
    'S.H.E': '中国台湾',
    '五月天': '中国台湾',
    '苏打绿': '中国台湾',

    # 中国香港
    '陈奕迅': '中国香港',
    '张学友': '中国香港',
    '刘德华': '中国香港',
    '张国荣': '中国香港',
    '梅艳芳': '中国香港',
    'Beyond': '中国香港',
    '谭咏麟': '中国香港',
    '陈百强': '中国香港',
    '许冠杰': '中国香港',
    '林子祥': '中国香港',
    '叶倩文': '中国香港',
    '林忆莲': '中国香港',
    '莫文蔚': '中国香港',
    '容祖儿': '中国香港',
    '杨千嬅': '中国香港',
    '梁咏琪': '中国香港',
    '郑秀文': '中国香港',
    '陈慧琳': '中国香港',
    'Twins': '中国香港',
    '谢霆锋': '中国香港',
    '古巨基': '中国香港',
    '李克勤': '中国香港',
    '陈慧娴': '中国香港',

    # 新加坡
    '林俊杰': '新加坡',
    '孙燕姿': '新加坡',

    # 美国
    '王力宏': '美国',
    '潘玮柏': '美国',
    'Taylor Swift': '美国',
    'Bruno Mars': '美国',
    'Beyoncé': '美国',
    'Billie Eilish': '美国',
    'Ariana Grande': '美国',
    'Lady Gaga': '美国',
    'Katy Perry': '美国',
    'Miley Cyrus': '美国',
    'Selena Gomez': '美国',
    'Charlie Puth': '美国',
    'Maroon 5': '美国',
    'Imagine Dragons': '美国',
    'OneRepublic': '美国',
    'Linkin Park': '美国',
    'Green Day': '美国',
    'Nirvana': '美国',
    'Metallica': '美国',
    'Michael Jackson': '美国',
    'Madonna': '美国',
    'Whitney Houston': '美国',
    'Mariah Carey': '美国',

    # 英国
    'Adele': '英国',
    'Ed Sheeran': '英国',
    'Dua Lipa': '英国',
    'Sam Smith': '英国',
    'Harry Styles': '英国',
    'Coldplay': '英国',
    'Queen': '英国',
    'The Beatles': '英国',
    'Pink Floyd': '英国',
    'David Bowie': '英国',
    'Elton John': '英国',
    'Amy Winehouse': '英国',
    'Arctic Monkeys': '英国',
    'Radiohead': '英国',
    'Oasis': '英国',
    'Muse': '英国',

    # 加拿大
    'Justin Bieber': '加拿大',
    'Drake': '加拿大',
    'The Weeknd': '加拿大',
    'Shawn Mendes': '加拿大',
    'Celine Dion': '加拿大',
    'Avril Lavigne': '加拿大',

    # 韩国
    'BTS': '韩国',
    'BLACKPINK': '韩国',
    'EXO': '韩国',
    'IU': '韩国',
    'PSY': '韩国',
    'BIGBANG': '韩国',
    'Girls Generation': '韩国',
    'TWICE': '韩国',
    'Red Velvet': '韩国',
    'NewJeans': '韩国',
    'aespa': '韩国',
    'IVE': '韩国',
    'LE SSERAFIM': '韩国',
    'Stray Kids': '韩国',
    'SEVENTEEN': '韩国',
    'NCT': '韩国',
    'SHINee': '韩国',
    'Super Junior': '韩国',
    'BoA': '韩国',
    'Rain': '韩国',
    'G-Dragon': '韩国',
    'HyunA': '韩国',

    # 日本
    '宇多田光': '日本',
    '滨崎步': '日本',
    '安室奈美惠': '日本',
    '中岛美嘉': '日本',
    '仓木麻衣': '日本',
    '米津玄师': '日本',
    'YOASOBI': '日本',
    'Official髭男dism': '日本',
    'King Gnu': '日本',
    'RADWIMPS': '日本',
    'ONE OK ROCK': '日本',
    'BABYMETAL': '日本',
    'Perfume': '日本',
    'AKB48': '日本',
    '岚': '日本',
    'SMAP': '日本',

    # 其他国家
    'Rihanna': '巴巴多斯',
    'Shakira': '哥伦比亚',
    'Enrique Iglesias': '西班牙',
    'Rammstein': '德国',
    'Daft Punk': '法国',
    'ABBA': '瑞典',
    'Avicii': '瑞典',
    'Kygo': '挪威',
    'A-ha': '挪威',
    'Aqua': '丹麦',
    'Enya': '爱尔兰',
    'U2': '爱尔兰',
    'AC/DC': '澳大利亚',
}


def main():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    updated = 0
    not_found = 0

    for name, region in KNOWN_ARTISTS.items():
        cursor.execute(
            "UPDATE artists SET region = %s WHERE name = %s AND (region IS NULL OR region = '')",
            (region, name)
        )
        if cursor.rowcount > 0:
            updated += 1
            print(f"  ✓ {name} -> {region}")
        else:
            not_found += 1

    conn.commit()

    print(f"\n完成! 更新: {updated}, 未找到: {not_found}")

    # 统计
    cursor.execute("""
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN region IS NOT NULL AND region != '' THEN 1 ELSE 0 END) AS has_region
        FROM artists
    """)
    total, has_region = cursor.fetchone()
    print(f"\n数据库统计: 总歌手 {total}, 有地区 {has_region} ({has_region/total*100:.1f}%)")

    # 地区分布
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
