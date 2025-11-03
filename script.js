const apiBase = "https://tiktok-proxy.thanhnhut201294.workers.dev/";

const fetchBtn = document.getElementById("fetchBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadXlsxBtn = document.getElementById("downloadXlsxBtn");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");

let videoData = [];

fetchBtn.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const limit = document.getElementById("limit").value.trim();

  if (!username) {
    alert("Vui lòng nhập username TikTok!");
    return;
  }

  statusDiv.textContent = "⏳ Đang quét dữ liệu...";
  outputDiv.innerHTML = "";
  videoData = [];

  try {
    const response = await fetch(`${apiBase}?username=${username}&limit=${limit}`);
    const json = await response.json();

    if (!json.data || !json.data.videos) throw new Error("Không có dữ liệu video!");

    videoData = json.data.videos.map(v => ({
      "Video URL": v.play || "",
      "Caption": v.title || "",
      "Ngày đăng": new Date(v.create_time * 1000).toLocaleString("vi-VN"),
      "View": v.play_count || 0,
      "Like": v.digg_count || 0,
      "Bình luận": v.comment_count || 0,
      "Lưu": v.collect_count || 0,
      "Chia sẻ": v.share_count || 0,
    }));

    renderTable(videoData);
    statusDiv.textContent = `✅ Đã quét được ${videoData.length} video.`;
    downloadCsvBtn.disabled = false;
    downloadXlsxBtn.disabled = false;
  } catch (err) {
    console.error(err);
    statusDiv.textContent = `❌ Lỗi: ${err.message}`;
  }
});

function renderTable(data) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  let html = "<table><thead><tr>";
  headers.forEach(h => (html += `<th>${h}</th>`));
  html += "</tr></thead><tbody>";

  data.forEach(row => {
    html += "<tr>";
    headers.forEach(h => {
      const cell = row[h];
      if (h === "Video URL")
        html += `<td><a href="${cell}" target="_blank">Xem</a></td>`;
      else html += `<td>${cell}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  outputDiv.innerHTML = html;
}

function exportToCsv(data) {
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(",")
  );
  const csvContent = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tiktok_data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportToXlsx(data) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "TikTok Data");
  XLSX.writeFile(workbook, "tiktok_data.xlsx");
}

downloadCsvBtn.addEventListener("click", () => exportToCsv(videoData));
downloadXlsxBtn.addEventListener("click", () => exportToXlsx(videoData));
