document.getElementById("scanBtn").addEventListener("click", fetchTikTokData);

async function fetchTikTokData() {
  const username = document.getElementById("username").value.trim();
  const count = document.getElementById("count").value.trim();
  const statusDiv = document.getElementById("status");
  const csvBtn = document.getElementById("downloadCsvBtn");
  const xlsxBtn = document.getElementById("downloadXlsxBtn");

  if (!username) {
    statusDiv.textContent = "⚠️ Vui lòng nhập username TikTok";
    return;
  }

  statusDiv.textContent = "⏳ Đang quét dữ liệu...";
  csvBtn.setAttribute("disabled", true);
  xlsxBtn.setAttribute("disabled", true);

  try {
    // 🔹 Gọi API thật
    const apiUrl = `https://tiktok-proxy.thanhnhut201294.workers.dev/?username=${username}&count=${count}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();
    if (!data || !data.videos || data.videos.length === 0) {
      statusDiv.textContent = "❌ Không tìm thấy video nào!";
      return;
    }

    const videos = data.videos.map(v => ({
      Caption: v.caption || "",
      Views: v.playCount || 0,
      Likes: v.diggCount || 0,
      Comments: v.commentCount || 0,
      Shares: v.shareCount || 0,
      Saves: v.collectCount || 0,
      Date: v.createTime ? new Date(v.createTime * 1000).toLocaleString("vi-VN") : "",
      VideoURL: v.webVideoUrl || ""
    }));

    // 🟢 Xuất CSV
    const csvContent = [
      ["Caption", "Views", "Likes", "Comments", "Shares", "Saves", "Date", "VideoURL"],
      ...videos.map(v => Object.values(v))
    ]
      .map(row => row.map(String).map(val => `"${val.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(csvBlob);
    csvBtn.href = csvUrl;
    csvBtn.download = `${username}_tiktok_data.csv`;
    csvBtn.removeAttribute("disabled");

    // 🟣 Xuất XLSX
    const ws = XLSX.utils.json_to_sheet(videos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TikTok Data");
    const xlsxBlob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const xlsxUrl = URL.createObjectURL(new Blob([xlsxBlob]));
    xlsxBtn.href = xlsxUrl;
    xlsxBtn.download = `${username}_tiktok_data.xlsx`;
    xlsxBtn.removeAttribute("disabled");

    statusDiv.style.color = "#00b894";
    statusDiv.textContent = `✅ Quét thành công ${videos.length} video!`;

  } catch (error) {
    console.error(error);
    statusDiv.textContent = "❌ Lỗi: Failed to fetch (không thể kết nối API)";
  }
}
