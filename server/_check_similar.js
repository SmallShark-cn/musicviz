const mysql = require('mysql2/promise');
async function check() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345678',
    database: 'music_dashboard'
  });

  // Check if similar_artists table exists
  try {
    const [tables] = await pool.execute("SHOW TABLES LIKE 'similar_artists'");
    console.log('similar_artists table exists:', tables.length > 0);
  } catch (e) {
    console.log('Error checking table:', e.message);
  }

  // Check data
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as cnt FROM similar_artists');
    console.log('similar_artists count:', rows[0].cnt);

    const [samples] = await pool.execute(
      `SELECT sa.artist_id, sa.similar_artist_id, sa.similarity_score, a.name as artist_name, b.name as similar_name
       FROM similar_artists sa
       JOIN artists a ON a.id = sa.artist_id
       JOIN artists b ON b.id = sa.similar_artist_id
       LIMIT 10`
    );
    console.log('Sample similar artists:');
    samples.forEach(s => {
      console.log(`  ${s.artist_name} -> ${s.similar_name} (score: ${s.similarity_score})`);
    });
  } catch (e) {
    console.log('Error querying data:', e.message);
  }

  await pool.end();
}
check().catch(console.error);
