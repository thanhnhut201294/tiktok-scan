const WORKER_URL = "https://tiktok-proxy.thanhnhut201294.workers.dev/";

const fetchBtn = document.getElementById("fetchBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadXlsBtn = document.getElementById("downloadXlsBtn");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");

let latestCsvUrl = null;
let latestXlsUrl = null;

function formatDate(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  return d.toLocaleDateString('vi-VN') + " " + d.toLocaleTimeString('vi-VN');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function fetchViaWorker(username, cursor, count) {
  const url = new URL(WORKER_URL);
  url.searchParams.set('unique_id', username);
  url.searchParams.set('count', count);
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Worker error: ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Worker không trả về JSON");
  return res.json();
}

async function fetchTikTokVideos(username, maxVideos) {
  const allVideos = [];
  const processedIds = new Set();
  let cursor = 0;
  let hasMore = true;
  const countPerRequest = 30;

  while (hasMore) {
    const data = await fetchViaWorker(username, cursor, countPerRequest);
    if (!data?.data?.videos) break;
    const videos = data.data.videos;

    for (const v of videos) {
      if (!v.video_id || processedIds.has(v.video_id)) continue;
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

function renderTable(videos, username) {
  if (!videos.length) {
    outputDiv.innerHTML = "<div>Không có video nào được tìm thấy.</div>";
    return;
  }

  let html = `<table><tr>
      <th>Video URL</th><th>Caption</th><th>Ngày đăng</th>
      <th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th>
    </tr>`;

  for (const v of videos) {
    html += `<tr>
      <td><a class="link" href="https://www.tiktok.com/@${username}/video/${v.video_id}" target="_blank">Xem</a></td>
      <td>${escapeHtml(v.title || '(Không có caption)')}</td>
      <td>${formatDate(v.create_time)}</td>
      <td>${v.play_count || 0}</td>
      <td>${v.digg_count || 0}</td>
      <td>${v.comment_count || 0}</td>
      <td>${v.share_count || 0}</td>
    </tr>`;
  }

  html += "</table>";
  outputDiv.innerHTML = html;
}

function prepareDownloads(videos, username) {
  if (!videos.length) return;

  // CSV
  const rows = [["VideoURL","Caption","Date","Views","Likes","Comments","Shares"]];
  for (const v of videos) {
    rows.push([
      `https://www.tiktok.com/@${username}/video/${v.video_id}`,
      (v.title || "").replace(/\r?\n|\r/g, " "),
      formatDate(v.create_time),
      v.play_count || 0,
      v.digg_count || 0,
      v.comment_count || 0,
      v.share_count || 0
    ]);
  }

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const csvBlob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  latestCsvUrl = URL.createObjectURL(csvBlob);
  downloadCsvBtn.href = latestCsvUrl;
  downloadCsvBtn.download = `tiktok_${username}.csv`;
  downloadCsvBtn.classList.remove("disabled");

  // XLSX
  const json = videos.map(v => ({
    VideoURL: `https://www.tiktok.com/@${username}/video/${v.video_id}`,
    Caption: v.title || "",
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
  latestXlsUrl = URL.createObjectURL(xlsBlob);
  downloadXlsBtn.href = latestXlsUrl;
  downloadXlsBtn.download = `tiktok_${username}.xlsx`;
  downloadXlsBtn.classList.remove("disabled");
}

fetchBtn.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const limit = parseInt(document.getElementById("limit").value) || 30;
  if (!username) return alert("Vui lòng nhập username!");

  statusDiv.textContent = "⏳ Đang quét dữ liệu...";
  outputDiv.innerHTML = "";
  fetchBtn.disabled = true;

  try {
    const videos = await fetchTikTokVideos(username, limit);
    statusDiv.textContent = `✅ Lấy được ${videos.length} video.`;
    renderTable(videos, username);
    prepareDownloads(videos, username);
  } catch (err) {
    statusDiv.textContent = "❌ Lỗi: " + err.message;
  } finally {
    fetchBtn.disabled = false;
  }
});
