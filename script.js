import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";

/* PDF.js の worker 設定 */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

/* =========
   要素取得
   ========= */
const pdfFile = document.getElementById("pdfFile");
const splitBtn = document.getElementById("splitBtn");
const statusEl = document.getElementById("status");

const viewer = document.getElementById("viewer");

const leftControls = document.getElementById("leftControls");
const rightControls = document.getElementById("rightControls");

const leftPrevBtn = document.getElementById("leftPrevBtn");
const leftNextBtn = document.getElementById("leftNextBtn");
const leftGoBtn = document.getElementById("leftGoBtn");
const leftPageInput = document.getElementById("leftPageInput");

const rightPrevBtn = document.getElementById("rightPrevBtn");
const rightNextBtn = document.getElementById("rightNextBtn");
const rightGoBtn = document.getElementById("rightGoBtn");
const rightPageInput = document.getElementById("rightPageInput");

const leftPanel = document.getElementById("leftPanel");
const rightPanel = document.getElementById("rightPanel");

const leftCanvas = document.getElementById("leftCanvas");
const rightCanvas = document.getElementById("rightCanvas");

const leftTitle = document.getElementById("leftTitle");
const rightTitle = document.getElementById("rightTitle");

/* =========
   状態管理
   ========= */
let pdfDoc = null;

/* 初期状態は分割OFF */
let splitMode = false;

/* 左右の現在ページ */
let leftPageNum = 1;
let rightPageNum = 2;

/* =========
   イベント登録
   ========= */

/* PDF選択 */
pdfFile.addEventListener("change", handleFileSelect);

/* 分割ON/OFF */
splitBtn.addEventListener("click", toggleSplitMode);

/* 左操作 */
leftPrevBtn.addEventListener("click", () => moveLeftPage(-1));
leftNextBtn.addEventListener("click", () => moveLeftPage(1));
leftGoBtn.addEventListener("click", goLeftPage);

/* 右操作 */
rightPrevBtn.addEventListener("click", () => moveRightPage(-1));
rightNextBtn.addEventListener("click", () => moveRightPage(1));
rightGoBtn.addEventListener("click", goRightPage);

/* ウィンドウ幅変更時に再描画 */
window.addEventListener("resize", async () => {
  if (!pdfDoc) return;
  await renderAll();
});

/* =========
   初期表示反映
   ========= */
updateSplitUI();

/* =========
   関数群
   ========= */

/* PDFを読み込む */
async function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    /* 読み込み直後の初期ページ */
    leftPageNum = 1;
    rightPageNum = Math.min(2, pdfDoc.numPages);

    /* 入力欄の最大値・初期値 */
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

/* 分割ON/OFF切替 */
function toggleSplitMode() {
  splitMode = !splitMode;
  updateSplitUI();

  /* PDF読み込み済みなら再描画 */
  if (pdfDoc) {
    renderAll();
  }
}

/* 分割状態に応じてUIを切り替える */
function updateSplitUI() {
  if (splitMode) {
    /* 分割ON:
       右操作行を表示 */
    rightControls.classList.remove("hidden");

    splitBtn.textContent = "分割 ON";
    splitBtn.classList.remove("toggle-off");
    splitBtn.classList.add("toggle-on");
  } else {
    /* 分割OFF:
       右操作行だけ非表示
       右画面は消さない */
    rightControls.classList.add("hidden");

    splitBtn.textContent = "分割 OFF";
    splitBtn.classList.remove("toggle-on");
    splitBtn.classList.add("toggle-off");
  }
}

/* 左ページを移動 */
function moveLeftPage(step) {
  if (!pdfDoc) return;
  leftPageNum = clampPage(leftPageNum + step);
  leftPageInput.value = leftPageNum;
  renderAll();
}

/* 右ページを移動 */
function moveRightPage(step) {
  if (!pdfDoc) return;
  rightPageNum = clampPage(rightPageNum + step);
  rightPageInput.value = rightPageNum;
  renderAll();
}

/* 左ページへ移動（入力値反映） */
function goLeftPage() {
  if (!pdfDoc) return;
  leftPageNum = clampPage(parseInt(leftPageInput.value, 10) || 1);
  leftPageInput.value = leftPageNum;
  renderAll();
}

/* 右ページへ移動（入力値反映） */
function goRightPage() {
  if (!pdfDoc) return;
  rightPageNum = clampPage(parseInt(rightPageInput.value, 10) || 1);
  rightPageInput.value = rightPageNum;
  renderAll();
}

/* ページ番号を範囲内に収める */
function clampPage(page) {
  if (!pdfDoc) return 1;
  return Math.max(1, Math.min(pdfDoc.numPages, page));
}

/* 全体再描画 */
async function renderAll() {
  if (!pdfDoc) {
    statusEl.textContent = "PDFを選択してください";
    return;
  }

  /* 左は常に描画 */
  await renderPage(leftPageNum, leftCanvas, leftTitle, "左ページ");

  /* 分割ONのときだけ右を描画 */
  if (splitMode) {
    await renderPage(rightPageNum, rightCanvas, rightTitle, "右ページ");
    statusEl.textContent =
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 右 ${rightPageNum} ページ`;
  } else {
    clearCanvas(rightCanvas);
    rightTitle.textContent = "右ページ";
    statusEl.textContent =
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 分割OFF`;
  }
}

/* 指定ページを canvas に描画 */
async function renderPage(pageNum, canvas, titleEl, label) {
  const page = await pdfDoc.getPage(pageNum);

  /* いったん倍率1でサイズ取得 */
  const unscaledViewport = page.getViewport({ scale: 1 });

  /* 親パネルの幅に合わせて縮尺を自動計算 */
  const containerWidth = canvas.parentElement.clientWidth - 24;
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

/* canvas を消す */
function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}
