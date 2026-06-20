const mysql = require("mysql2/promise");

// MySQL 连接池配置
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "12345678",
  database: "music_dashboard",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 初始化数据库和表结构
async function initDatabase() {
  const initPool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "12345678",
  });

  try {
    // 创建数据库
    await initPool.execute(`
      CREATE DATABASE IF NOT EXISTS music_dashboard
      DEFAULT CHARACTER SET utf8mb4
      DEFAULT COLLATE utf8mb4_unicode_ci
    `);
    console.log("✅ 数据库 music_dashboard 已就绪");

    // 切换到目标数据库
    const db = mysql.createPool({
      host: "localhost",
      user: "root",
      password: "12345678",
      database: "music_dashboard",
      multipleStatements: true,
    });

    // 歌手表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS artists (
        id BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        followers BIGINT DEFAULT 0,
        description TEXT,
        region VARCHAR(100),
        region_code VARCHAR(20),
        album_size INT DEFAULT 0,
        music_size INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_followers (followers),
        INDEX idx_region (region)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 风格标签表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS styles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        category VARCHAR(50)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 歌手-风格关联表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS artist_styles (
        artist_id BIGINT NOT NULL,
        style_id INT NOT NULL,
        PRIMARY KEY (artist_id, style_id),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        FOREIGN KEY (style_id) REFERENCES styles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 歌曲表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS songs (
        id BIGINT PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        artist_id BIGINT NOT NULL,
        album_name VARCHAR(500),
        album_id BIGINT,
        plays BIGINT DEFAULT 0,
        comments_count INT DEFAULT 0,
        duration INT DEFAULT 0,
        publish_year INT,
        ranking INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_artist (artist_id),
        INDEX idx_plays (plays),
        INDEX idx_year (publish_year),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 评论表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id BIGINT PRIMARY KEY,
        song_id BIGINT NOT NULL,
        content TEXT,
        likes INT DEFAULT 0,
        comment_time DATETIME,
        user_nickname VARCHAR(255),
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
        INDEX idx_song (song_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 相似歌手表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS similar_artists (
        artist_id BIGINT NOT NULL,
        similar_artist_id BIGINT NOT NULL,
        similarity_score DOUBLE DEFAULT 0,
        PRIMARY KEY (artist_id, similar_artist_id),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        FOREIGN KEY (similar_artist_id) REFERENCES artists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 专辑表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS albums (
        id BIGINT PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        artist_id BIGINT NOT NULL,
        publish_time DATE,
        song_count INT DEFAULT 0,
        comment_count BIGINT DEFAULT 0,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        INDEX idx_artist (artist_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("✅ 所有数据表已就绪");
    await initPool.end();
    await db.end();
  } catch (err) {
    console.error("❌ 数据库初始化失败:", err.message);
    await initPool.end();
    throw err;
  }
}

module.exports = { pool, initDatabase };
