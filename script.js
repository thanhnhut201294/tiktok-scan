// Cấu hình: nếu bạn dùng Worker, set WORKER_URL = 'https://xxxxx.workers.dev'
const WORKER_URL = 'https://tiktok-proxy.thanhnhut201294.workers.dev/'; // <-- sau khi deploy Worker, dán URL ở đây hoặc gọi trực tiếp worker từ client

function formatDate(tsSeconds) {
  return new Date(tsSeconds * 1000).toLocaleString();
}

async function fetchViaWorker(username, cursor, count) {
  // Worker sẽ nhận query và proxy sang tikwm
  const url = new URL(WORKER_URL || window.location.origin + '/api/proxy');
  url.searchParams.set('unique_id', username);
  url.searchParams.set('count', count);
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Network response not ok: ' + res.status);
  return res.json();
}

async function fetchTikTokVideos(username, maxVideos, startDate, endDate) {
  const allVideos = [];
  const processedIds = new Set();
  let cursor = 0;
  let hasMore = true;
  const countPerRequest = 30;

  while (hasMore) {
    const data = await fetchViaWorker(username, cursor, countPerRequest);
    if (!data?.data?.videos) {
      throw new Error('Lỗi API hoặc không có videos');
    }
    for (const v of data.data.videos) {
      if (!v.video_id || processedIds.has(v.video_id)) continue;
      const postDate = new Date(v.create_time * 1000);
      if (startDate && endDate) {
        if (postDate < startDate || postDate > endDate) continue;
      }
      if (allVideos.length >= maxVideos) { hasMore = false; break; }
      allVideos.push(v);
      processedIds.add(v.video_id);
    }
    cursor = data.data.sec_cursor || data.data.cursor || null;
    if (!cursor || allVideos.length >= maxVideos) hasMore = false;
    else await new Promise(r => setTimeout(r, 400));
  }
  return allVideos;
}

// UI handlers
document.getElementById('fetchBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const limit = parseInt(document.getElementById('limit').value);
  const start = document.getElementById('start').value ? new Date(document.getElementById('start').value) : null;
  const end = document.getElementById('end').value ? new Date(document.getElementById('end').value) : null;
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  document.getElementById('downloadCsvBtn').disabled = true;
  output.innerHTML = '';
  if (!username || !limit) { alert('Nhập username và số lượng!'); return; }
  status.textContent = '⏳ Đang tải...';
  try {
    const videos = await fetchTikTokVideos(username, limit, start, end);
    status.textContent = `✅ Đã lấy ${videos.length} video.`;
    renderTable(videos, username);
    prepareCsvDownload(videos, username);
  } catch (e) {
    status.textContent = '❌ ' + e.message;
  }
});

function renderTable(videos, username) {
  const output = document.getElementById('output');
  const table = document.createElement('table');
  table.innerHTML = `<tr>
    <th>Video URL</th><th>Caption</th><th>Ngày đăng</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th>
  </tr>`;
  for (const v of videos) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><a href="https://www.tiktok.com/@${username}/video/${v.video_id}" target="_blank">Xem</a></td>
      <td>${escapeHtml(v.title || '(Không có caption)')}</td>
      <td>${formatDate(v.create_time)}</td>
      <td>${v.play_count||0}</td>
      <td>${v.digg_count||0}</td>
      <td>${v.comment_count||0}</td>
      <td>${v.share_count||0}</td>`;
    table.appendChild(tr);
  }
  output.innerHTML = '';
  output.appendChild(table);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// CSV
function prepareCsvDownload(videos, username) {
  if (!videos.length) return;
  const rows = [['VideoURL','Caption','Date','Views','Likes','Comments','Shares']];
  for (const v of videos) {
    rows.push([
      `https://www.tiktok.com/@${username}/video/${v.video_id}`,
      (v.title||'').replace(/(\r\n|\n|\r)/gm,' '),
      formatDate(v.create_time),
      v.play_count||0, v.digg_count||0, v.comment_count||0, v.share_count||0
    ]);
  }
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const dl = document.getElementById('downloadCsvBtn');
  dl.href = url;
  dl.download = `tiktok_${username}.csv`;
  dl.disabled = false;
  dl.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 1000);
}
