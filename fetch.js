fetch('https://dev.mattr.art/create', {
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
