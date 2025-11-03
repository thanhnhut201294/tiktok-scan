addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(req) {
  try {
    const url = new URL(req.url);
    // Nếu Worker dùng URL direct with params, ví dụ: https://xxx.workers.dev?unique_id=...&count=...
    const unique_id = url.searchParams.get('unique_id');
    const count = url.searchParams.get('count') || '30';
    const cursor = url.searchParams.get('cursor') || '';

    if (!unique_id) {
      return new Response(JSON.stringify({ error: 'missing unique_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build tikwm URL
    let apiUrl = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(unique_id)}&count=${encodeURIComponent(count)}`;
    if (cursor) apiUrl += `&cursor=${encodeURIComponent(cursor)}`;

    // Proxy call
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TikTokScanner/1.0)',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const text = await res.text();
    // Trả về nguyên vẹn body (JSON) kèm CORS header cho client
    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
