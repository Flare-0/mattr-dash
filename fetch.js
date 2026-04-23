fetch('http://127.0.0.1:8787/create', {
  method: 'POST',
  headers: { 'X-Auth-Key': '77737774', 'Content-Type': 'application/json', },
  body: JSON.stringify({
    id: null,
    url: 'youtube.com'
  })
})
  .then(res => {
    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} ${res.statusText}`);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.text();
  })
  .then(console.log)
  .catch(err => console.error('Fetch error:', err));

  let e = {
    url: "antigravity.google",
    clicks: [
      {
        IP: "Unknown",
        timestamp: "2026-04-23T05:27:53.398Z",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        latitude: "24.85098",
        longitude: "89.37108",
        ISP: "Unknown"
      },
      {
        IP: "Unknown",
        timestamp: "2026-04-23T05:29:19.256Z",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        latitude: "24.85098",
        longitude: "89.37108",
        ISP: "Unknown"
      }
    ]
  }