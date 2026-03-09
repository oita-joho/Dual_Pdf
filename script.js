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

const leftCanvas = document.getElementById("leftCanvas");
const rightCanvas = document.getElementById("rightCanvas");
const leftTitle = document.getElementById("leftTitle");
const rightTitle = document.getElementById("rightTitle");

const fixedTop = document.querySelector(".fixed-top");
const viewerWrap = document.querySelector(".viewer-wrap");

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

window.addEventListener("resize", async () => {
  adjustViewerTopPadding();
  if (pdfDoc) {
    await renderAll();
  }
});

/* 初期反映 */
updateSplitUI();
adjustViewerTopPadding();

/* =========================
   レイアウト補正
   ========================= */

/* 固定ヘッダーの高さに合わせて
   PDF領域の上余白を自動調整する */
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

/* 右操作の表示切替 */
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

  await renderPage(leftPageNum, leftCanvas, leftTitle, "左ページ");
  await renderPage(rightPageNum, rightCanvas, rightTitle, "右ページ");

  if (splitMode) {
    statusEl.textContent =
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 右 ${rightPageNum} ページ / 分割ON`;
  } else {
    statusEl.textContent =
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 右 ${rightPageNum} ページ / 分割OFF`;
  }
}

async function renderPage(pageNum, canvas, titleEl, label) {
  const page = await pdfDoc.getPage(pageNum);

  /* 元サイズ */
  const unscaledViewport = page.getViewport({ scale: 1 });

  /* パネル幅に合わせて縮尺調整 */
  const containerWidth = Math.max(canvas.parentElement.clientWidth - 20, 100);
  const scale = containerWidth / unscaledViewport.width;

  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  titleEl.textContent = `${label}：${pageNum} ページ`;
}
