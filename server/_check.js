const mysql = require('mysql2/promise');
async function check() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345678',
    database: 'music_dashboard'
  });

  const [chartDist] = await pool.execute('SELECT chart_type, COUNT(*) as cnt FROM hot_songs GROUP BY chart_type');
  console.log('=== chart distribution ===');
  console.log(chartDist);

  const [artists] = await pool.execute('SELECT id, name FROM artists');
  console.log('=== artists ===');
  console.log(artists.map(a => ({ id: a.id, name: a.name })));

  if (artists.length > 0) {
    const artistIds = artists.map(a => Number(a.id));
    const [songs] = await pool.execute('SELECT id, name, artists, chart_type FROM hot_songs LIMIT 50');
    console.log('=== matches in first 50 songs ===');
    let matchCount = 0;
    songs.forEach(s => {
      const songArtists = JSON.parse(s.artists || '[]');
      const matched = songArtists.filter(a => artistIds.includes(Number(a.id)));
      if (matched.length > 0) {
        matchCount++;
        console.log(`MATCH: [${s.chart_type}] "${s.name}" -> ${matched.map(a => `${a.name}(id=${a.id})`).join(', ')}`);
      }
    });
    console.log(`Total matches: ${matchCount} / ${songs.length} songs`);

    // Also check total songs per chart
    const [totalPerChart] = await pool.execute('SELECT chart_type, COUNT(*) as cnt FROM hot_songs GROUP BY chart_type');
    console.log('=== total per chart ===');
    console.log(totalPerChart);
  }

  await pool.end();
}
check().catch(e => console.error(e));
