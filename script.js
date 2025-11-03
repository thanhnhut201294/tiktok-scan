async function fetchTikTokVideos(username, maxVideos, startDate, endDate) {
  const allVideos = [];
  const processedIds = new Set();
  let cursor = 0;
  let hasMore = true;
  const countPerRequest = 30;

  while (hasMore) {
    let apiUrl = `https://www.tikwm.com/api/user/posts?unique_id=${username}&count=${countPerRequest}`;
    if (cursor) apiUrl += `&cursor=${cursor}`;

    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data?.data?.videos) {
      alert("❌ Lỗi API hoặc không tìm thấy video.");
      break;
    }

    for (const v of data.data.videos) {
      if (!v.video_id || processedIds.has(v.video_id)) continue;

      const postDate = new Date(v.create_time * 1000);
      if (startDate && endDate) {
        if (postDate < startDate || postDate > endDate) continue;
      }

      if (allVideos.length >= maxVideos) {
        hasMore = false;
        break;
      }

      allVideos.push(v);
      processedIds.add(v.video_id);
    }

    cursor = data.data.sec_cursor || data.data.cursor || null;
    if (!cursor || allVideos.length >= maxVideos) hasMore = false;
    else await new Promise(r => setTimeout(r, 500)); // nghỉ 0.5s
  }

  return allVideos;
}

document.getElementById("fetchBtn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const limit = parseInt(document.getElementById("limit").value);
  const start = document.getElementById("start").value ? new Date(document.getElementById("start").value) : null;
  const end = document.getElementById("end").value ? new Date(document.getElementById("end").value) : null;
  const output = document.getElementById("output");

  if (!username || !limit) {
    alert("⚠️ Vui lòng nhập Username và số lượng video!");
    return;
  }

  output.innerHTML = "<p>⏳ Đang tải dữ liệu...</p>";
  const videos = await fetchTikTokVideos(username, limit, start, end);

  if (!videos.length) {
    output.innerHTML = "<p>⚠️ Không có video nào được tìm thấy!</p>";
    return;
  }

  // Hiển thị bảng
  const table = document.createElement("table");
  table.innerHTML = `
    <tr>
      <th>Video URL</th>
      <th>Caption</th>
      <th>Ngày đăng</th>
      <th>Views</th>
      <th>Likes</th>
      <th>Comments</th>
      <th>Shares</th>
    </tr>
  `;

  videos.forEach(v => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="https://www.tiktok.com/@${username}/video/${v.video_id}" target="_blank">Xem</a></td>
      <td>${v.title || "(Không có caption)"}</td>
      <td>${new Date(v.create_time * 1000).toLocaleDateString()}</td>
      <td>${v.play_count || 0}</td>
      <td>${v.digg_count || 0}</td>
      <td>${v.comment_count || 0}</td>
      <td>${v.share_count || 0}</td>
    `;
    table.appendChild(tr);
  });

  output.innerHTML = `<p>✅ Đã lấy ${videos.length} video của @${username}.</p>`;
  output.appendChild(table);
});
