// --- DOM Elements ---
const canvas = document.getElementById("scratch-canvas");
const ctx = canvas.getContext("2d");
const resultText = document.getElementById("result-text");
const guideText = document.getElementById("guide-text");
const scratchArea = document.getElementById("scratch-area");
const actionButtons = document.getElementById("action-buttons");
const reloadBtn = document.getElementById("reload-btn");

// --- State ---
let isScratching = false;

// --- Functions ---

/**
 * 1. NATIVE -> WEB
 * Called by native app to initialize the page with event data.
 * @param {object} data - The event data from the backend.
 */
function initializeEvent(data) {
  console.log("Initializing event with data:", data);
  // Reset state
  eventResultData = null;

  // Setup canvas using data from bridge
  setupCanvas(data.scratchArea);
}

/**
 * 2. NATIVE -> WEB
 * Called by native app to show the participation result.
 * @param {object} result - The participation result.
 */
function showResult(result) {
  console.log("Showing result:", result);

  // Display result text
  resultText.textContent = result.message;
  resultText.style.color = result.status === 'WIN' ? "#2ecc71" : "#e74c3c";
  resultText.classList.add("result-visible");

  // Disable scratching
  canvas.removeEventListener("mousedown", handleStart);
  canvas.removeEventListener("mousemove", handleMove);
  canvas.removeEventListener("mouseup", handleEnd);
  canvas.removeEventListener("touchstart", handleStart);
  canvas.removeEventListener("touchmove", handleMove);
  canvas.removeEventListener("touchend", handleEnd);

  // Show action buttons
  actionButtons.style.display = "flex";
}

// --- Canvas & Event Logic ---

function setupCanvas(scratchAreaConfig) {
  // 1. 디바이스 픽셀 비율(DPR)을 가져옵니다.
  const dpr = window.devicePixelRatio || 1;

  // 2. CSS 픽셀 크기를 가져옵니다.
  const rect = scratchArea.getBoundingClientRect();

  // 3. CSS 크기에 DPR을 곱하여 실제 픽셀 크기를 설정합니다. (선명한 렌더링)
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // 4. 캔버스 요소의 스타일(CSS) 크기는 원래대로 유지합니다.
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  // 5. 캔버스 컨텍스트를 DPR만큼 확대하여 좌표계를 일치시킵니다.
  ctx.scale(dpr, dpr);

  // 이제 모든 그리기 작업은 CSS 픽셀 기준으로 동작합니다.
  ctx.fillStyle = scratchAreaConfig?.coverColor || "#A7B9C6";
  // 그릴 때 너비와 높이는 CSS 픽셀 크기(rect.width)를 사용해야 합니다.
  ctx.fillRect(0, 0, rect.width, rect.height);

  guideText.textContent = scratchAreaConfig?.guideText || "여기를 긁어보세요";
  guideText.style.opacity = "1";

  resultText.classList.remove("result-visible");
  actionButtons.style.display = "none";

  // Add event listeners
  canvas.addEventListener("mousedown", handleStart);
  canvas.addEventListener("mousemove", handleMove);
  canvas.addEventListener("mouseup", handleEnd);
  canvas.addEventListener("touchstart", handleStart);
  canvas.addEventListener("touchmove", handleMove);
  canvas.addEventListener("touchend", handleEnd);
}

function handleStart(e) {
  e.preventDefault();
  isScratching = true;
  guideText.style.opacity = "0";

  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX || e.touches[0].clientX;
  const clientY = e.clientY || e.touches[0].clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  scratch(x, y);
}

function handleMove(e) {
  e.preventDefault();
  if (!isScratching) return;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX || e.touches[0].clientX;
  const clientY = e.clientY || e.touches[0].clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  scratch(x, y);
}

function handleEnd() {
  if (!isScratching) return;
  isScratching = false;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  let transparentPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) {
      transparentPixels++;
    }
  }
  const totalPixels = canvas.width * canvas.height;
  if (transparentPixels / totalPixels > 0.6) {
    // 3. WEB -> NATIVE: Notify native app to participate
    if (window.nativeApp && window.nativeApp.participateEvent) {
      window.nativeApp.participateEvent();
    } else {
      console.log("Not in App context. Simulating result.");
      const isWin = Math.random() < 0.5;
      showResult({
        status: isWin ? 'WIN' : 'LOSE',
        message: isWin ? '1,000 포인트 당첨!' : '아쉽지만 꽝이에요...',
        prize: isWin ? { grade: '3등', name: '1,000 포인트' } : null
      });
    }
  }
}

function scratch(x, y) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, 2 * Math.PI);
  ctx.fill();
}

// --- Button Event Listeners ---

reloadBtn.addEventListener("click", () => {
  // Re-initialization should be triggered by the native app.
  // We just signal that the page is ready again.
  if (window.nativeApp && window.nativeApp.onPageReady) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    window.nativeApp.onPageReady(eventId);
  } else {
    console.log("Simulating reload");
    location.reload();
  }
});



window.addEventListener('load', () => {
  // 5. WEB -> NATIVE: Notify native app that the page is ready
  if (window.nativeApp && window.nativeApp.onPageReady) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    if (eventId) {
      window.nativeApp.onPageReady(eventId);
    } else {
      console.error("Event ID not found in URL.");
    }
  } else {
    // Fallback for testing in a browser without the native app context
    console.log("Not in App context. Simulating initializeEvent for testing.");
    initializeEvent({
      eventId: "evt_test_123",
      title: "식권을 긁어보세요",
      subtitle: "식권대장 이벤트",
      scratchArea: {
        coverColor: "#A7B9C6",
        guideText: "여기를 긁어보세요"
      },
      rules: [],
      prizes: [
        { grade: "1등", name: "프리미엄 세트 (1명)" },
        { grade: "2등", name: "1박스 (3명)" },
        { grade: "3등", name: "1,000 포인트 (5명)" }
      ]
    });
  }
});
