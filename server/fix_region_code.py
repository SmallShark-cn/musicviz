"""根据已有的 region 字段，批量回填 region_code"""
import pymysql

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "12345678",
    "database": "music_dashboard",
    "charset": "utf8mb4",
}

REGION_TO_CODE = {
    "中国": "CN", "中国台湾": "TW", "中国香港": "HK",
    "美国": "US", "英国": "GB", "日本": "JP", "韩国": "KR",
    "新加坡": "SG", "马来西亚": "MY", "加拿大": "CA",
    "澳大利亚": "AU", "德国": "DE", "法国": "FR", "意大利": "IT",
    "西班牙": "ES", "荷兰": "NL", "瑞典": "SE", "挪威": "NO",
    "丹麦": "DK", "芬兰": "FI", "爱尔兰": "IE", "比利时": "BE",
    "瑞士": "CH", "奥地利": "AT", "俄罗斯": "RU", "巴西": "BR",
    "墨西哥": "MX", "阿根廷": "AR", "哥伦比亚": "CO", "秘鲁": "PE",
    "南非": "ZA", "泰国": "TH", "菲律宾": "PH", "新西兰": "NZ",
    "希腊": "GR", "克罗地亚": "HR", "爱沙尼亚": "EE", "乌干达": "UG",
    "巴巴多斯": "BB",
}

conn = pymysql.connect(**DB_CONFIG)
cur = conn.cursor()

updated = 0
for region, code in REGION_TO_CODE.items():
    r = cur.execute(
        "UPDATE artists SET region_code = %s WHERE region = %s AND (region_code IS NULL OR region_code = '')",
        (code, region)
    )
    updated += r

conn.commit()
print(f"回填 region_code: {updated} 条")

# 验证
cur.execute("SELECT COUNT(*) FROM artists WHERE region IS NOT NULL AND region != '' AND region_code IS NOT NULL AND region_code != ''")
print(f"有 region + region_code 的歌手: {cur.fetchone()[0]}")

cur.execute("SELECT region, region_code, COUNT(*) FROM artists WHERE region IS NOT NULL AND region != '' GROUP BY region ORDER BY COUNT(*) DESC")
for row in cur.fetchall():
    print(f"  {row[0]:10s} {row[1]:5s} {row[2]}")

conn.close()
