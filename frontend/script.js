// =================== 전역 설정 ===================
const API_KEY = "AIzaSyAha_6aQl5ph9YMBh9Pa9UwhxJ8aLALDlE";

let shortsVideos = [];
let currentPage = 1;
const perPage = 15;
let currentSort = "views";
let searchQuery = "";
let currentModalVideoId = null;

// =================== 유틸 함수 ===================
function parseISODuration(iso) {
  const m = parseInt((iso.match(/PT(?:(\d+)M)/) || [])[1] || 0, 10);
  const s = parseInt((iso.match(/PT(?:\d+M)?(?:(\d+)S)/) || [])[1] || 0, 10);
  return m * 60 + s;
}
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function resetForm() {
  document.getElementById("channelInput").value = "";
  document.getElementById("resultSection").classList.add("hidden");
  document.getElementById("resultSection").innerHTML = "";
}

// =================== 모달 관련 ===================
function openModal(videoId, title, views, likes, comments) {
  currentModalVideoId = videoId;
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalStats").innerHTML = `
    <span class="flex items-center"><i class="fas fa-eye mr-1 text-red-500"></i>${views.toLocaleString()}회</span>
    <span class="flex items-center"><i class="fas fa-thumbs-up mr-1 text-red-500"></i>${likes.toLocaleString()}개</span>
    <span class="flex items-center"><i class="fas fa-comment mr-1 text-red-500"></i>${comments.toLocaleString()}개</span>
  `;
  document.getElementById("modalVideo").innerHTML =
    `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
  document.getElementById("videoTranscript").textContent = "원본 대본이 여기에 표시됩니다.";
  document.getElementById("videoModal").classList.remove("hidden");
  document.getElementById("videoModal").classList.add("flex");
}
function closeModal() {
  document.getElementById("videoModal").classList.add("hidden");
  document.getElementById("videoModal").classList.remove("flex");
  document.getElementById("modalVideo").innerHTML = "";
  currentModalVideoId = null;
}
function handleBackdropClick(e) {
  if (e.target.id === "videoModal") closeModal();
}

// =================== 자막 가져오기 ===================
async function fetchTranscript(videoId) {
  const transcriptEl = document.getElementById("videoTranscript");
  transcriptEl.textContent = "대본을 불러오는 중입니다...";
  try {
    const res = await fetch("/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    transcriptEl.textContent = data.transcript || "자막이 없습니다.";
  } catch (err) {
    console.error(err);
    transcriptEl.textContent = "❗ 자막을 불러올 수 없습니다.";
  }
}

// =================== 🔍 검색 처리 ===================
function handleSearch() {
  searchQuery = document.getElementById("searchInput").value.trim();
  currentPage = 1;
  sortAndRender(currentSort);
}
function clearSearch() {
  searchQuery = "";
  const input = document.getElementById("searchInput");
  if (input) input.value = "";
  currentPage = 1;
  sortAndRender(currentSort);
}

// =================== 정렬·렌더 ===================
function sortAndRender(key) {
  currentSort = key;
  const sorted = [...shortsVideos];
  if (key === "views") sorted.sort((a, b) => b.views - a.views);
  else sorted.sort((a, b) => b.published - a.published);

  const filtered = searchQuery
    ? sorted.filter(v =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sorted;

  renderPage(filtered);
}

function renderPage(videos) {
  const grid = document.getElementById("videoGrid");
  const pagination = document.getElementById("pagination");
  if (!grid || !pagination) return;

  const totalPages = Math.ceil(videos.length / perPage) || 1;
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * perPage;
  const slice = videos.slice(start, start + perPage);

  grid.innerHTML = slice.map(v => `
    <div onclick="openModal('${v.id}', \`${v.title.replace(/`/g, "'")}\`, ${v.views}, ${v.likes}, ${v.comments})"
         class="cursor-pointer border rounded shadow hover:shadow-md transition overflow-hidden">
      <img src="${v.thumbnail}" alt="${v.title}" class="w-full h-48 object-cover">
      <div class="p-3">
        <p class="font-semibold text-sm truncate mb-1">${v.title}</p>
        <p class="text-xs text-gray-600">${v.published.toISOString().split("T")[0]}</p>
        <p class="text-xs text-gray-500">조회수: ${v.views.toLocaleString()}회</p>
      </div>
    </div>
  `).join("");

  pagination.innerHTML = "";
  const makeBtn = (label, page, active = false) =>
    `<button onclick="goToPage(${page})"
             class="px-3 py-1 rounded ${active ? "bg-red-500 text-white" : "bg-gray-200"}">${label}</button>`;
  if (totalPages > 1) {
    pagination.innerHTML += makeBtn("처음", 1);
    const groupStart = Math.floor((currentPage - 1) / 3) * 3 + 1;
    for (let i = groupStart; i <= Math.min(groupStart + 2, totalPages); i++) {
      pagination.innerHTML += makeBtn(i, i, i === currentPage);
    }
    if (groupStart + 3 <= totalPages) {
      pagination.innerHTML += makeBtn("다음", groupStart + 3);
    }
  }
}

function goToPage(page) {
  currentPage = page;
  sortAndRender(currentSort);
}
