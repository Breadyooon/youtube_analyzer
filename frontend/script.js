script.js (최종백업)

// =================== 전역 설정 ===================
const API_KEY = "AIzaSyAha_6aQl5ph9YMBh9Pa9UwhxJ8aLALDlE";

let shortsVideos = [];      // 분석된 숏츠 영상 전체
let currentPage   = 1;      // 페이지네이션
const perPage     = 15;
let currentSort   = "views";
let searchQuery   = "";     // 🔍 검색어
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
  if (key === "views") sorted.sort((a, b) => b.views     - a.views);
  else                  sorted.sort((a, b) => b.published - a.published);

  const filtered = searchQuery
    ? sorted.filter(v =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sorted;

  renderPage(filtered);
}

function renderPage(videos) {
  const grid       = document.getElementById("videoGrid");
  const pagination = document.getElementById("pagination");
  if (!grid || !pagination) return;

  // 페이지 계산
  const totalPages = Math.ceil(videos.length / perPage) || 1;
  currentPage = Math.min(currentPage, totalPages);
  const start  = (currentPage - 1) * perPage;
  const slice  = videos.slice(start, start + perPage);

  // 썸네일 출력
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

  // 페이지네이션
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

// =================== 채널 분석 ===================
async function analyze() {
  const input  = document.getElementById("channelInput").value.trim();
  const result = document.getElementById("resultSection");
  const loading = document.getElementById("loadingModal");

  if (!input) return alert("채널 URL을 입력해주세요.");
  result.innerHTML = "";
  loading.classList.remove("hidden");

  try {
    // 1) 채널 정보 조회
    let channelRes;
    if (input.includes("/channel/")) {
      const channelId = input.split("/channel/")[1].split(/[/?]/)[0];
      channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${API_KEY}`);
    } else if (input.includes("@")) {
      const handle = decodeURIComponent(input).split("@")[1].split(/[/?]/)[0];
      channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${handle}&key=${API_KEY}`);
    } else {
      throw new Error("URL 형식이 올바르지 않습니다.");
    }
    const channelData = await channelRes.json();
    if (!channelData.items?.length) throw new Error("채널을 찾을 수 없습니다.");
    const channel = channelData.items[0];
    const uploadsId = channel.contentDetails.relatedPlaylists.uploads;

    // 2) 업로드 영상 목록 가져오기
    const videoIds = [];
    let nextToken = "";
    do {
      const listRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploadsId}&pageToken=${nextToken}&key=${API_KEY}`);
      const list = await listRes.json();
      list.items.forEach(i => videoIds.push(i.contentDetails.videoId));
      nextToken = list.nextPageToken;
    } while (nextToken);

    // 3) 영상 상세정보 조회
    const videos = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch  = videoIds.slice(i, i + 50).join(",");
      const vRes   = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batch}&key=${API_KEY}`);
      const vData  = await vRes.json();
      vData.items.forEach(v => {
        const dur = parseISODuration(v.contentDetails.duration);
        if (dur <= 60) {
          videos.push({
            id:        v.id,
            title:     v.snippet.title,
            views:     +v.statistics.viewCount || 0,
            likes:     +v.statistics.likeCount  || 0,
            comments:  +v.statistics.commentCount || 0,
            published: new Date(v.snippet.publishedAt),
            thumbnail: v.snippet.thumbnails.medium.url,
            duration:  dur
          });
        }
      });
    }
    shortsVideos = videos;
    currentPage  = 1;
    searchQuery  = "";

    // 4) 채널/지표 요약
    const now = new Date();
    const views30   = shortsVideos.filter(v => (now - v.published)/86400000 <= 30).reduce((s,v)=>s+v.views, 0);
    const uploads30 = shortsVideos.filter(v => (now - v.published)/86400000 <= 30).length;
    const avgDur    = shortsVideos.length ? formatDuration(shortsVideos.reduce((s,v)=>s+v.duration,0)/shortsVideos.length) : "0:00";
    const totalViews= shortsVideos.reduce((s,v)=>s+v.views,0);
    const revenue   = Math.round(totalViews * 0.1).toLocaleString();
    const revenue30 = Math.round(views30  * 0.1).toLocaleString();
    const over100k  = shortsVideos.filter(v=>v.views>=100000).length;
    const over500k  = shortsVideos.filter(v=>v.views>=500000).length;
    const over1M    = shortsVideos.filter(v=>v.views>=1000000).length;
    const latest    = shortsVideos.sort((a,b)=>b.published-a.published)[0];
    const daysAgo   = latest ? Math.floor((now - latest.published)/86400000) : "-";

    // 5) 결과 HTML 동적 생성
    result.classList.remove("hidden");
    result.innerHTML = `
      <h2 class="text-2xl font-bold mb-4">분석 결과</h2>
      <div class="mb-6 flex items-center gap-4">
        <img src="${channel.snippet.thumbnails.default.url}" class="w-12 h-12 rounded-full" />
        <div>
          <p class="text-xl font-semibold">${channel.snippet.title}</p>
          <p class="text-sm text-gray-600">구독자: ${(+channel.statistics.subscriberCount).toLocaleString()} | 총 영상: ${channel.statistics.videoCount}</p>
        </div>
      </div>

      <h3 class="text-xl font-bold mb-4">핵심 지표</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-10">
        <div><strong>총 조회수</strong><br>${totalViews.toLocaleString()}</div>
        <div><strong>총 예상 수익</strong><br>${revenue}원</div>
        <div><strong>신규 조회수(30일)</strong><br>${views30.toLocaleString()}</div>
        <div><strong>신규 수익(30일)</strong><br>${revenue30}원</div>
        <div><strong>평균 영상 길이</strong><br>${avgDur}</div>
        <div><strong>10만+ 영상</strong><br>${over100k}개</div>
        <div><strong>50만+ 영상</strong><br>${over500k}개</div>
        <div><strong>100만+ 영상</strong><br>${over1M}개</div>
        <div><strong>업로드 빈도</strong><br>${uploads30}/30일</div>
        <div><strong>일일 평균 업로드</strong><br>${(uploads30/30).toFixed(2)}개</div>
        <div><strong>최근 업로드</strong><br>${daysAgo}일 전</div>
        <div><strong>최근 업로드 날짜</strong><br>${latest?.published.toISOString().split("T")[0]}</div>
      </div>

      <h3 class="text-xl font-bold mb-2">채널 숏츠 영상</h3>

      <!-- ✅ 정렬 + 검색 바 -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div class="flex gap-2">
          <button onclick="sortAndRender('views')" class="bg-gray-200 px-3 py-1 rounded">인기순</button>
          <button onclick="sortAndRender('date')"  class="bg-gray-200 px-3 py-1 rounded">최신순</button>
        </div>
        <div class="flex items-center gap-2">
          <input id="searchInput" type="text" placeholder="영상 제목 검색"
                 class="border rounded px-3 py-1 text-sm w-48" oninput="handleSearch()">
          <button onclick="clearSearch()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times-circle"></i>
          </button>
        </div>
      </div>

      <div id="videoGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"></div>
      <div id="pagination" class="flex justify-center mt-6 gap-2 text-sm"></div>
    `;
    sortAndRender("views");
  } catch (e) {
    alert("오류 발생: " + e.message);
    console.error(e);
  } finally {
    loading.classList.add("hidden");
  }
}
