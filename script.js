import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";

/* =========================
   PDF.js worker 設定
   ========================= */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

/* =========================
   要素取得
   ========================= */
const pdfFile = document.getElementById("pdfFile");
const splitBtn = document.getElementById("splitBtn");
const statusEl = document.getElementById("status");

const leftPrevBtn = document.getElementById("leftPrevBtn");
const leftNextBtn = document.getElementById("leftNextBtn");
const leftGoBtn = document.getElementById("leftGoBtn");
const leftPageInput = document.getElementById("leftPageInput");

const rightControls = document.getElementById("rightControls");
const rightPrevBtn = document.getElementById("rightPrevBtn");
const rightNextBtn = document.getElementById("rightNextBtn");
const rightGoBtn = document.getElementById("rightGoBtn");
const rightPageInput = document.getElementById("rightPageInput");

const leftZoomOutBtn = document.getElementById("leftZoomOutBtn");
const leftZoomInBtn = document.getElementById("leftZoomInBtn");
const rightZoomOutBtn = document.getElementById("rightZoomOutBtn");
const rightZoomInBtn = document.getElementById("rightZoomInBtn");
const leftZoomLabel = document.getElementById("leftZoomLabel");
const rightZoomLabel = document.getElementById("rightZoomLabel");

const leftCanvas = document.getElementById("leftCanvas");
const rightCanvas = document.getElementById("rightCanvas");
const leftTitle = document.getElementById("leftTitle");
const rightTitle = document.getElementById("rightTitle");

const fixedTop = document.querySelector(".fixed-top");
const viewerWrap = document.querySelector(".viewer-wrap");

/* canvas を包むスクロール領域 */
const leftScrollArea = leftCanvas.parentElement;
const rightScrollArea = rightCanvas.parentElement;

/* =========================
   状態
   ========================= */
let pdfDoc = null;

/* 初期は分割OFF
   2画面表示は常に行う
   OFF時は右操作のみ隠す */
let splitMode = false;

let leftPageNum = 1;
let rightPageNum = 2;

/* 左右独立ズーム */
let leftZoom = 1.0;
let rightZoom = 1.0;

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

/* =========================
   イベント
   ========================= */
pdfFile.addEventListener("change", handleFileSelect);
splitBtn.addEventListener("click", toggleSplitMode);

leftPrevBtn.addEventListener("click", () => moveLeftPage(-1));
leftNextBtn.addEventListener("click", () => moveLeftPage(1));
leftGoBtn.addEventListener("click", goLeftPage);

rightPrevBtn.addEventListener("click", () => moveRightPage(-1));
rightNextBtn.addEventListener("click", () => moveRightPage(1));
rightGoBtn.addEventListener("click", goRightPage);

leftZoomOutBtn.addEventListener("click", () => changeLeftZoom(-ZOOM_STEP));
leftZoomInBtn.addEventListener("click", () => changeLeftZoom(ZOOM_STEP));
rightZoomOutBtn.addEventListener("click", () => changeRightZoom(-ZOOM_STEP));
rightZoomInBtn.addEventListener("click", () => changeRightZoom(ZOOM_STEP));

window.addEventListener("resize", async () => {
  adjustViewerTopPadding();
  if (pdfDoc) {
    await renderAll();
  }
});

/* 初期反映 */
updateSplitUI();
updateZoomLabels();
adjustViewerTopPadding();

/* =========================
   レイアウト補正
   ========================= */
function adjustViewerTopPadding() {
  const h = fixedTop.offsetHeight;
  viewerWrap.style.paddingTop = `${h + 8}px`;
}

/* =========================
   PDF読み込み
   ========================= */
async function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    leftPageNum = 1;
    rightPageNum = Math.min(2, pdfDoc.numPages);

    /* 読み込み時は倍率を初期化 */
    leftZoom = 1.0;
    rightZoom = 1.0;
    updateZoomLabels();

    leftPageInput.max = pdfDoc.numPages;
    rightPageInput.max = pdfDoc.numPages;
    leftPageInput.value = leftPageNum;
    rightPageInput.value = rightPageNum;

    await renderAll();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "PDFの読み込みに失敗しました。";
  }
}

/* =========================
   分割ON/OFF
   ========================= */
function toggleSplitMode() {
  splitMode = !splitMode;
  updateSplitUI();

  if (pdfDoc) {
    renderAll();
  }
}

function updateSplitUI() {
  if (splitMode) {
    rightControls.classList.remove("hidden");
    splitBtn.textContent = "分割 ON";
    splitBtn.classList.remove("toggle-off");
    splitBtn.classList.add("toggle-on");
  } else {
    rightControls.classList.add("hidden");
    splitBtn.textContent = "分割 OFF";
    splitBtn.classList.remove("toggle-on");
    splitBtn.classList.add("toggle-off");
  }

  adjustViewerTopPadding();
}

/* =========================
   ズーム
   ========================= */
function clampZoom(value) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

function updateZoomLabels() {
  leftZoomLabel.textContent = `${Math.round(leftZoom * 100)}%`;
  rightZoomLabel.textContent = `${Math.round(rightZoom * 100)}%`;
}

function changeLeftZoom(delta) {
  leftZoom = clampZoom(leftZoom + delta);
  updateZoomLabels();
  if (pdfDoc) renderAll();
}

function changeRightZoom(delta) {
  rightZoom = clampZoom(rightZoom + delta);
  updateZoomLabels();
  if (pdfDoc) renderAll();
}

/* =========================
   ページ操作
   ========================= */
function clampPage(page) {
  if (!pdfDoc) return 1;
  return Math.max(1, Math.min(pdfDoc.numPages, page));
}

function moveLeftPage(step) {
  if (!pdfDoc) return;

  leftPageNum = clampPage(leftPageNum + step);
  leftPageInput.value = leftPageNum;

  /* 分割OFF時は右を左+1に連動 */
  if (!splitMode) {
    rightPageNum = clampPage(leftPageNum + 1);
    rightPageInput.value = rightPageNum;
  }

  renderAll();
}

function moveRightPage(step) {
  if (!pdfDoc) return;

  rightPageNum = clampPage(rightPageNum + step);
  rightPageInput.value = rightPageNum;

  renderAll();
}

function goLeftPage() {
  if (!pdfDoc) return;

  leftPageNum = clampPage(parseInt(leftPageInput.value, 10) || 1);
  leftPageInput.value = leftPageNum;

  if (!splitMode) {
    rightPageNum = clampPage(leftPageNum + 1);
    rightPageInput.value = rightPageNum;
  }

  renderAll();
}

function goRightPage() {
  if (!pdfDoc) return;

  rightPageNum = clampPage(parseInt(rightPageInput.value, 10) || 1);
  rightPageInput.value = rightPageNum;

  renderAll();
}

/* =========================
   描画
   ========================= */
async function renderAll() {
  if (!pdfDoc) {
    statusEl.textContent = "PDFを選択してください";
    return;
  }

  /* 分割OFF時は右を左+1に連動 */
  if (!splitMode) {
    rightPageNum = clampPage(leftPageNum + 1);
    rightPageInput.value = rightPageNum;
  }

  await renderPage(leftPageNum, leftCanvas, leftTitle, "左ページ", leftZoom);
  await renderPage(rightPageNum, rightCanvas, rightTitle, "右ページ", rightZoom);

  if (splitMode) {
    statusEl.textContent =
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 右 ${rightPageNum} ページ / 分割ON`;
  } else {
    statusEl.textContent =
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 右 ${rightPageNum} ページ / 分割OFF`;
  }
}

async function renderPage(pageNum, canvas, titleEl, label, zoomFactor) {
  const page = await pdfDoc.getPage(pageNum);

  /* 基本倍率は固定1。ズーム倍率をそのまま使う
     これで拡大縮小が見た目に反映される */
  const viewport = page.getViewport({ scale: zoomFactor });
  const context = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  titleEl.textContent = `${label}：${pageNum} ページ`;

  /* スクロール位置はページ描画直後に先頭へ戻す
     スクロールバーでページ移動はしない仕様 */
  const scrollArea = canvas.parentElement;
  scrollArea.scrollTop = 0;
  scrollArea.scrollLeft = 0;
}
