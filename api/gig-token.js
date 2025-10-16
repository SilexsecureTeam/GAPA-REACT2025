// Vercel edge/serverless function to proxy GIG static token endpoint
// Avoids browser CORS when calling external domain directly.
// GET /api/gig-token -> { token: string }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const upstream = 'https://stockmgt.gapaautoparts.com/api/gig/access-token'
    const r = await fetch(upstream, { method: 'GET' })
    if (!r.ok) {
      const txt = await r.text().catch(()=> '')
      res.status(r.status).json({ error: 'Upstream error', detail: txt.slice(0,200) })
      return
    }
    const data = await r.json().catch(()=> ({}))
    const token = data?.token || data?.access_token
    if (!token) {
      res.status(502).json({ error: 'No token in upstream response' })
      return
    }
    // Cache for 20 minutes at edge/CDN
    res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=300')
    res.status(200).json({ token })
  } catch (e) {
    res.status(500).json({ error: 'Proxy failure', message: e?.message })
  }
}
