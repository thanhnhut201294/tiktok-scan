// =========================
// Cấu hình Worker Proxy
// =========================
const WORKER_URL = "https://tiktok-proxy.thanhnhut201294.workers.dev/"; // <--- worker của bạn

// UI elements
const fetchBtn = document.getElementById("fetchBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadXlsBtn = document.getElementById("downloadXlsBtn");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");

let latestCsvUrl = null;
let latestXlsUrl = null;

// =========================
// Tiện ích
// =========================
function formatDate(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  return `${d.toLocaleTimeString('vi-VN')} ${d.toLocaleDateString('vi-VN')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// =========================
// Gọi Worker (proxy)
// =========================
async function fetchViaWorker(username, cursor, count) {
  const url = new URL(WORKER_URL);
  url.searchParams.set('unique_id', username);
  url.searchParams.set('count', count);
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url.toString(), { method: 'GET' });
  // nếu server trả HTML lỗi, báo cho user
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Worker error ${res.status}: ${text.slice(0,200)}`);
  }
  if (!ct.includes('application/json')) {
    // có thể tikwm trả text/html (lỗi) -> show first part
    const text = await res.text();
    throw new Error('Worker trả về không phải JSON: ' + text.slice(0,200));
  }
  return res.json();
}

// =========================
// Lấy video với phân trang & chống trùng
// =========================
async function fetchTikTokVideos(username, maxVideos, startDate, endDate) {
  const allVideos = [];
  const processedIds = new Set();
  let cursor = 0;
  let hasMore = true;
  const countPerRequest = 30;

  while (hasMore) {
    const data = await fetchViaWorker(username, cursor, countPerRequest);
    if (!data?.data?.videos) {
      throw new Error('Không tìm thấy videos trong phản hồi API.');
    }

    const current = data.data.videos;
    for (const v of current) {
      if (!v.video_id || processedIds.has(v.video_id)) continue;
      const postDate = new Date(v.create_time * 1000);
      if (startDate && endDate && (postDate < startDate || postDate > endDate)) continue;
      if (allVideos.length >= maxVideos) { hasMore = false; break; }
      allVideos.push(v);
      processedIds.add(v.video_id);
    }

    cursor = data.data.sec_cursor || data.data.cursor || null;
    if (!cursor || allVideos.length >= maxVideos) hasMore = false;
    else await new Promise(r => setTimeout(r, 400)); // tránh gọi quá nhanh
  }

  return allVideos;
}

// =========================
// Render bảng kết quả
// =========================
function renderTable(videos, username) {
  if (!videos.length) {
    outputDiv.innerHTML = '<div>Không tìm thấy video nào.</div>';
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = `<tr>
    <th>Video URL</th><th>Caption</th><th>Ngày đăng</th>
    <th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th>
  </tr>`;

  for (const v of videos) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a class="link" href="https://www.tiktok.com/@${username}/video/${v.video_id}" target="_blank">Xem</a></td>
      <td>${escapeHtml(v.title || '(Không có caption)')}</td>
      <td>${formatDate(v.create_time)}</td>
      <td>${v.play_count || 0}</td>
      <td>${v.digg_count || 0}</td>
      <td>${v.comment_count || 0}</td>
      <td>${v.share_count || 0}</td>
    `;
    table.appendChild(tr);
  }

  outputDiv.innerHTML = '';
  outputDiv.appendChild(table);
}

// =========================
// Chuẩn bị & gán link tải CSV + XLSX
// =========================
function revokeLatestUrlsLater() {
  // revoke cũ sau 30s
  if (latestCsvUrl) {
    const url = latestCsvUrl;
    setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
    latestCsvUrl = null;
  }
  if (latestXlsUrl) {
    const url = latestXlsUrl;
    setTimeout(() => URL.revokeObjectURL(url), 30 * 1000);
    latestXlsUrl = null;
  }
}

function prepareDownloads(videos, username) {
  if (!videos.length) return;

  // CSV
  const rows = [['VideoURL','Caption','Date','Views','Likes','Comments','Shares']];
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

  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  // add BOM để Excel nhận UTF-8
  const csvBlob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const csvUrl = URL.createObjectURL(csvBlob);
  // revoke old urls to avoid leak
  revokeLatestUrlsLater();
  latestCsvUrl = csvUrl;

  downloadCsvBtn.href = csvUrl;
  downloadCsvBtn.download = `tiktok_${username}.csv`;
  downloadCsvBtn.classList.remove('disabled');

  // XLSX (SheetJS)
  const json = videos.map(v => ({
    VideoURL: `https://www.tiktok.com/@${username}/video/${v.video_id}`,
    Caption: v.title || '',
    Date: formatDate(v.create_time),
    Views: v.play_count || 0,
    Likes: v.digg_count || 0,
    Comments: v.comment_count || 0,
    Shares: v.share_count || 0
  }));

  const ws = XLSX.utils.json_to_sheet(json);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TikTok Data");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const xlsBlob = new Blob([wbout], { type: "application/octet-stream" });
  const xlsUrl = URL.createObjectURL(xlsBlob);
  latestXlsUrl = xlsUrl;

  downloadXlsBtn.href = xlsUrl;
  downloadXlsBtn.download = `tiktok_${username}.xlsx`;
  downloadXlsBtn.classList.remove('disabled');
}

// =========================
// Xử lý click "Bắt đầu quét"
// =========================
fetchBtn.addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const limitRaw = document.getElementById('limit').value;
  const startVal = document.getElementById('start').value;
  const endVal = document.getElementById('end').value;

  if (!username) {
    alert('Vui lòng nhập username TikTok!');
    return;
  }
  const maxVideos = parseInt(limitRaw) || 30;
  const startDate = startVal ? new Date(startVal) : null;
  const endDate = endVal ? new Date(endVal) : null;

  // reset UI
  statusDiv.textContent = '⏳ Đang quét...';
  outputDiv.innerHTML = '';
  downloadCsvBtn.classList.add('disabled');
  downloadXlsBtn.classList.add('disabled');
  fetchBtn.disabled = true;

  try {
    const videos = await fetchTikTokVideos(username, maxVideos, startDate, endDate);
    statusDiv.textContent = `✅ Đã lấy ${videos.length} video.`;
    renderTable(videos, username);
    prepareDownloads(videos, username);
  } catch (err) {
    console.error(err);
    statusDiv.textContent = '❌ Lỗi: ' + (err.message || err);
    outputDiv.innerText = (typeof err === 'string') ? err : (err.stack || JSON.stringify(err, null, 2));
  } finally {
    fetchBtn.disabled = false;
  }
});
