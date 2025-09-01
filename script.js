// --- DOM Elements ---
const canvas = document.getElementById("scratch-canvas");
const ctx = canvas.getContext("2d");
const resultText = document.getElementById("result-text");
const guideText = document.getElementById("guide-text");
const scratchArea = document.getElementById("scratch-area");
const actionButtons = document.getElementById("action-buttons");
const reloadBtn = document.getElementById("reload-btn");
const subtitleElement = document.querySelector(".subtitle");

// --- State ---
let isScratching = false;
let eventDataForSetup = null; // 데이터를 임시 저장할 변수

// --- ResizeObserver ---
// #scratch-area 요소의 크기 변경을 감지하여 캔버스 크기를 다시 설정합니다.
// 웹뷰의 렌더링 지연 문제를 해결하는 가장 확실한 방법입니다.
const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    // entry.contentRect가 실제 요소의 크기입니다.
    if (entry.contentRect.width > 0 && eventDataForSetup) {
      console.log(
        "ResizeObserver triggered. Setting up canvas with size:",
        entry.contentRect
      );
      setupCanvas(eventDataForSetup.scratchArea, entry.contentRect);
      // 캔버스 설정 후에는 관찰을 중단하여 불필요한 재실행을 방지합니다.
      resizeObserver.disconnect();
    }
  }
});

/**
 * 1. NATIVE -> WEB
 * Called by native app to initialize the page with event data.
 * @param {object} data - The event data from the backend.
 */
function initializeEvent(data) {
  console.log("Initializing event with data:", data);

  // subtitle에 eventId 표시
  if (data.eventId && subtitleElement) {
    subtitleElement.textContent = `식권대장 이벤트 - ${data.eventId}`;
  }

  // 데이터를 임시 저장하고, #scratch-area 요소에 대한 크기 감지를 시작합니다.
  eventDataForSetup = data;
  resizeObserver.observe(scratchArea);
}

/**
 * 2. NATIVE -> WEB
 * Called by native app to show the participation result.
 * @param {object} result - The participation result.
 */
function showResult(result) {
  console.log("Showing result:", result);

  resultText.textContent = result.message;
  resultText.style.color = result.status === "WIN" ? "#2ecc71" : "#e74c3c";
  resultText.classList.add("result-visible");

  // revealAll 함수에서 이벤트 리스너가 제거되므로 여기서는 중복 제거
  actionButtons.style.display = "flex";
}

// --- Canvas & Event Logic ---

// setupCanvas 함수가 부모 요소의 실제 크기를 인자로 받도록 수정합니다.
function setupCanvas(scratchAreaConfig, rect) {
  const dpr = window.devicePixelRatio || 1;

  // getBoundingClientRect() 대신 ResizeObserver가 전달한 정확한 크기(rect)를 사용합니다.
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  ctx.scale(dpr, dpr);

  ctx.fillStyle = scratchAreaConfig?.coverColor || "#A7B9C6";
  ctx.fillRect(0, 0, rect.width, rect.height);

  // 캔버스의 opacity를 다시 1로 설정 (다시 시작하기 등)
  canvas.style.opacity = "1";

  guideText.textContent = scratchAreaConfig?.guideText || "여기를 긁어보세요";
  guideText.style.opacity = "1";

  resultText.classList.remove("result-visible");
  actionButtons.style.display = "none";

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

function scratch(x, y) {
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, 2 * Math.PI);
  ctx.fill();
}

// --- 이전 대화에서 개선된 함수들 ---

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
  const scratchedRatio = transparentPixels / totalPixels;

  if (scratchedRatio > 0.3) {
    revealAll();
  }
}

function revealAll() {
  canvas.removeEventListener("mousedown", handleStart);
  canvas.removeEventListener("mousemove", handleMove);
  canvas.removeEventListener("mouseup", handleEnd);
  canvas.removeEventListener("touchstart", handleStart);
  canvas.removeEventListener("touchmove", handleMove);
  canvas.removeEventListener("touchend", handleEnd);

  let opacity = 1;
  const fadeOut = setInterval(() => {
    opacity -= 0.1;
    if (opacity <= 0) {
      clearInterval(fadeOut);
      canvas.style.opacity = "0";
      requestResult();
    } else {
      canvas.style.opacity = opacity.toString();
    }
  }, 20);
}

function requestResult() {
  if (window.nativeApp && window.nativeApp.participateEvent) {
    window.nativeApp.participateEvent();
  } else {
    console.log("Not in App context. Simulating result.");
    const isWin = Math.random() < 0.5;
    showResult({
      status: isWin ? "WIN" : "LOSE",
      message: isWin ? "1,000 포인트 당첨!" : "아쉽지만 꽝이에요...",
      prize: isWin ? { grade: "3등", name: "1,000 포인트" } : null,
    });
  }
}

// --- Button Event Listeners & Page Load ---

reloadBtn.addEventListener("click", () => {
  if (window.nativeApp && window.nativeApp.onPageReady) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("eventId");
    window.nativeApp.onPageReady(eventId);
  } else {
    console.log("Simulating reload");
    location.reload();
  }
});

window.addEventListener("load", () => {
  // URL 파라미터에서 eventId 가져와서 subtitle에 표시
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("eventId");
  if (eventId && subtitleElement) {
    subtitleElement.textContent = `식권대장 이벤트 - ${eventId}`;
  }

  if (window.nativeApp && window.nativeApp.onPageReady) {
    if (eventId) {
      window.nativeApp.onPageReady(eventId);
    } else {
      console.error("Event ID not found in URL.");
    }
  } else {
    console.log("Not in App context. Simulating initializeEvent for testing.");
    initializeEvent({
      eventId: "evt_test_123",
      title: "식권을 긁어보세요",
      subtitle: "식권대장 이벤트",
      scratchArea: {
        coverColor: "#A7B9C6",
        guideText: "여기를 긁어보세요",
      },
      rules: [],
      prizes: [
        { grade: "1등", name: "프리미엄 세트 (1명)" },
        { grade: "2등", name: "1박스 (3명)" },
        { grade: "3등", name: "1,000 포인트 (5명)" },
      ],
    });
  }
});
