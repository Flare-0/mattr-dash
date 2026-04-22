fetch('http://localhost:8787/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'dev',
    url: 'dev.mattr.art'
  })
})
.then(res => res.text())
.then(console.log);