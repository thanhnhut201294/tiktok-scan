// =========================
// ⚙️ Cấu hình Worker Proxy
// =========================
const WORKER_URL = "https://tiktok-proxy.thanhnhut201294.workers.dev/"; // Thay bằng URL Worker của bạn

// =========================
// 🕒 Hàm tiện ích định dạng ngày
// =========================
function formatDate(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  return `${d.toLocaleTimeString('vi-VN')} ${d.toLocaleDateString('vi-VN')}`;
}

// =========================
// 📡 Gọi API qua Worker
// =========================
async function fetchViaWorker(username, cursor, count) {
  const url = new URL(WORKER_URL || window.location.origin + '/api/proxy');
  url.searchParams.set('unique_id', username);
  url.searchParams.set('count', count);
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Network response not ok: ' + res.status);
  return res.json();
}

// =========================
// 🎥 Lấy danh sách video
// =========================
async function fetchTikTokVideos(username, maxVideos, startDate, endDate) {
  const allVideos = [];
  const processedIds = new Set();
  let cursor = 0;
  let hasMore = true;
  const countPerRequest = 30;

  while (hasMore) {
    const data = await fetchViaWorker(username, cursor, countPerRequest);
    if (!data?.data?.videos) throw new Error('Lỗi API hoặc không có videos');

    for (const v of data.data.videos) {
      if (!v.video_id || processedIds.has(v.video_id)) continue;

      const postDate = new Date(v.create_time * 1000);
      if (startDate && endDate && (postDate < startDate || postDate > endDate)) continue;
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

// =========================
// 🧱 Render bảng kết quả
// =========================
function renderTable(videos, username) {
  const output = document.getElementById('output');
  const table = document.createElement('table');
  table.innerHTML = `<tr>
    <th>Video URL</th><th>Caption</th><th>Ngày đăng</th>
    <th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th>
  </tr>`;

  for (const v of videos) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="https://www.tiktok.com/@${username}/video/${v.video_id}" target="_blank">Xem</a></td>
      <td>${escapeHtml(v.title || '(Không có caption)')}</td>
      <td>${formatDate(v.create_time)}</td>
      <td>${v.play_count || 0}</td>
      <td>${v.digg_count || 0}</td>
      <td>${v.comment_count || 0}</td>
      <td>${v.share_count || 0}</td>`;
    table.appendChild(tr);
  }

  output.innerHTML = '';
  output.appendChild(table);
}

// =========================
// 🔒 Escape HTML caption
// =========================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// =========================
// 📦 Chuẩn bị tải CSV & XLS
// =========================
function prepareDownloads(videos, username) {
  if (!videos.length) return;

  // Dữ liệu chung
  const rows = [['VideoURL', 'Caption', 'Date', 'Views', 'Likes', 'Comments', 'Shares']];
  for (const v of videos) {
    rows.push([
      `https://www.tiktok.com/@${username}/video/${v.video_id}`,
      (v.title || '').replace(/(\r\n|\n|\r)/gm, ' '),
      formatDate(v.create_time),
      v.play_count || 0,
      v.digg_count || 0,
      v.comment_count || 0,
      v.share_count || 0
    ]);
  }

  // === CSV ===
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const csvUrl = URL.createObjectURL(csvBlob);

  const csvBtn = document.getElementById('downloadCsvBtn');
  csvBtn.href = csvUrl;
  csvBtn.download = `tiktok_${username}.csv`;
  csvBtn.classList.remove('disabled');

  // === XLS (dùng thư viện XLSX) ===
  const json = videos.map(v => ({
    VideoURL: `https://www.tiktok.com/@${username}/video/${v.video_id}`,
    Caption: v.title || '',
    Date: formatDate(v.create_time),
    Views: v.play_count || 0,
    Likes: v.digg_count || 0,
    Comments: v.comment_count || 0,
    Shares: v.share_count || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(json);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TikTok Data");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const xlsBlob = new Blob([wbout], { type: "application/octet-stream" });
  const xlsUrl = URL.createObjectURL(xlsBlob);

  const xlsBtn = document.getElementById('downloadXlsBtn');
  xlsBtn.href = xlsUrl;
  xlsBtn.download = `tiktok_${username}.xlsx`;
  xlsBtn.classList.remove('disabled');
}

// =========================
// 🧭 Sự kiện nút "Bắt đầu quét"
// =========================
document.getElementById('fetchBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const limit = parseInt(document.getElementById('limit').value);
  const start = document.getElementById('start').value ? new Date(document.getElementById('start').value) : null;
  const end = document.getElementById('end').value ? new Date(document.getElementById('end').value) : null;
  const status = document.getElementById('status');
  const output = document.getElementById('output');

  // Reset UI
  document.getElementById('downloadCsvBtn').classList.add('disabled');
  document.getElementById('downloadXlsBtn').classList.add('disabled');
  output.innerHTML = '';

  if (!username || !limit) {
    alert('Vui lòng nhập username và số lượng video!');
    return;
  }

  status.textContent = '⏳ Đang tải...';
  try {
    const videos = await fetchTikTokVideos(username, limit, start, end);
    status.innerHTML = `✅ Đã lấy ${videos.length} video.`;
    renderTable(videos, username);
    prepareDownloads(videos, username);
  } catch (e) {
    console.error(e);
    status.textContent = '❌ ' + e.message;
  }
});
