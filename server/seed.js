// ============================================================
// 一键插入演示歌手数据
// 运行: cd server && node seed.js
// ============================================================

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "12345678",
  database: "music_dashboard",
  charset: "utf8mb4",
});

const data = [
  [
    "artists",
    `
    INSERT INTO artists (id, name, avatar_url, followers, description, region, region_code) VALUES
    (2116, '陈奕迅', 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg', 12500000, '香港金曲歌王', '香港', 'HK'),
    (2112, '周杰伦', 'https://p1.music.126.net/BbR3TJnPABKFymZBEjx_SA==/109951168773461338.jpg', 36800000, '华语乐坛天王', '台湾', 'TW'),
    (3684, '林俊杰', 'https://p1.music.126.net/78Y7LgD6G4KAw6H36qDj4g==/109951167989559538.jpg', 22100000, '行走的CD', '新加坡', 'SG'),
    (6460, '邓紫棋', 'https://p1.music.126.net/fq1O8ZRT5_FHzg_uLEtUQA==/109951167773880633.jpg', 13700000, '创作型女歌手', '香港', 'HK'),
    (10559, '五月天', 'https://p1.music.126.net/2bP0HNGhcjGgD0cT7b5iRA==/109951167773343594.jpg', 18200000, '台湾摇滚乐团', '台湾', 'TW'),
    (5344, '蔡依林', 'https://p1.music.126.net/_q4E0QRPoxWPyDUFMfSJVA==/109951167773357283.jpg', 10800000, '亚洲舞娘', '台湾', 'TW'),
    (4292, '王力宏', 'https://p1.music.126.net/1tOUJb7g9cQPqOZMJpOBnA==/109951167773417031.jpg', 8900000, '全能音乐人', '台湾', 'TW'),
    (6066, '孙燕姿', 'https://p1.music.126.net/n6GsBMnSXhEdi6sZ0E8KjQ==/109951167772859066.jpg', 7600000, '新加坡天后', '新加坡', 'SG')
    ON DUPLICATE KEY UPDATE name=VALUES(name)
  `,
  ],
  [
    "styles",
    `
    INSERT INTO styles (name, category) VALUES
    ('流行', '主流'), ('摇滚', '主流'), ('民谣', '主流'), ('R&B', '主流'),
    ('说唱', '嘻哈'), ('电子', '电子'), ('古典', '古典'), ('爵士', '爵士')
    ON DUPLICATE KEY UPDATE name=VALUES(name)
  `,
  ],
  [
    "artist_styles",
    `
    INSERT INTO artist_styles VALUES
    (2116,1),(2116,4),(2112,1),(2112,4),(3684,1),
    (6460,1),(6460,4),(10559,2),(5344,1),(4292,1),
    (6066,1),(6066,4)
    ON DUPLICATE KEY UPDATE style_id=VALUES(style_id)
  `,
  ],
  [
    "songs",
    `
    INSERT INTO songs (id, name, artist_id, album_name, plays, comments_count, publish_year, ranking) VALUES
    (186016, '七里香', 2112, '七里香', 285000000, 125000, 2004, 1),
    (191232, '晴天', 2112, '叶惠美', 312000000, 198000, 2003, 2),
    (186001, '夜曲', 2112, '十一月的萧邦', 256000000, 145000, 2005, 3),
    (186009, '稻香', 2112, '魔杰座', 278000000, 132000, 2008, 4),
    (186435, '十年', 2116, '黑白灰', 234000000, 168000, 2003, 1),
    (186453, '富士山下', 2116, 'What''s Going On...?', 198000000, 112000, 2006, 2),
    (36270426, '修炼爱情', 3684, '因你而在', 187000000, 98000, 2013, 1),
    (36270449, '不为谁而作的歌', 3684, '和自己对话', 156000000, 89000, 2015, 2),
    (441491828, '光年之外', 6460, '光年之外', 352000000, 215000, 2016, 1),
    (441491976, '泡沫', 6460, 'Xposed', 298000000, 178000, 2012, 2),
    (10559001, '突然好想你', 10559, '后青春期的诗', 189000000, 105000, 2008, 1),
    (5344001, '日不落', 5344, '特务J', 165000000, 76000, 2007, 1),
    (4292001, '唯一', 4292, '唯一', 143000000, 68000, 2001, 1),
    (6066001, '天黑黑', 6066, '孙燕姿同名专辑', 128000000, 92000, 2000, 1)
    ON DUPLICATE KEY UPDATE name=VALUES(name)
  `,
  ],
];

async function seed() {
  try {
    for (const [label, sql] of data) {
      await pool.execute(sql);
      console.log(`✅ ${label}`);
    }
    console.log("\n🎉 演示数据导入完成！重启 server 即可搜索和查看图表");
  } catch (err) {
    console.error("❌", err.message);
  }
  await pool.end();
}

seed();
