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

const rightControls = document.getElementById("rightControls");

const leftPrevBtn = document.getElementById("leftPrevBtn");
const leftNextBtn = document.getElementById("leftNextBtn");
const leftGoBtn = document.getElementById("leftGoBtn");
const leftPageInput = document.getElementById("leftPageInput");

const rightPrevBtn = document.getElementById("rightPrevBtn");
const rightNextBtn = document.getElementById("rightNextBtn");
const rightGoBtn = document.getElementById("rightGoBtn");
const rightPageInput = document.getElementById("rightPageInput");

const leftCanvas = document.getElementById("leftCanvas");
const rightCanvas = document.getElementById("rightCanvas");

const leftTitle = document.getElementById("leftTitle");
const rightTitle = document.getElementById("rightTitle");

/* =========
   状態管理
   ========= */

/* 読み込んだPDF本体 */
let pdfDoc = null;

/* 初期は分割OFF
   ただし2画面表示自体は常に行う
   OFFのときは右操作だけ隠す */
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

/* 左側操作 */
leftPrevBtn.addEventListener("click", () => moveLeftPage(-1));
leftNextBtn.addEventListener("click", () => moveLeftPage(1));
leftGoBtn.addEventListener("click", goLeftPage);

/* 右側操作 */
rightPrevBtn.addEventListener("click", () => moveRightPage(-1));
rightNextBtn.addEventListener("click", () => moveRightPage(1));
rightGoBtn.addEventListener("click", goRightPage);

/* 画面幅が変わったとき、PDFを描き直す */
window.addEventListener("resize", async () => {
  if (!pdfDoc) return;
  await renderAll();
});

/* 初期状態を反映 */
updateSplitUI();

/* =========
   関数
   ========= */

/* PDFファイル読み込み */
async function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    /* 読み込み直後の初期ページ */
    leftPageNum = 1;
    rightPageNum = Math.min(2, pdfDoc.numPages);

    /* 入力欄の最大ページ設定 */
    leftPageInput.max = pdfDoc.numPages;
    rightPageInput.max = pdfDoc.numPages;

    /* 入力欄へ反映 */
    leftPageInput.value = leftPageNum;
    rightPageInput.value = rightPageNum;

    await renderAll();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "PDFの読み込みに失敗しました。";
  }
}

/* 分割ボタン切替
   ONのときだけ右操作を見せる */
function toggleSplitMode() {
  splitMode = !splitMode;
  updateSplitUI();

  if (pdfDoc) {
    renderAll();
  }
}

/* 分割状態に応じて右操作の表示だけ切り替える */
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
}

/* 左ページを前後に動かす */
function moveLeftPage(step) {
  if (!pdfDoc) return;

  leftPageNum = clampPage(leftPageNum + step);
  leftPageInput.value = leftPageNum;

  /* 分割OFFのときは右ページを左+1に連動させる
     分割ONのときは右ページは独立 */
  if (!splitMode) {
    rightPageNum = clampPage(leftPageNum + 1);
    rightPageInput.value = rightPageNum;
  }

  renderAll();
}

/* 右ページを前後に動かす */
function moveRightPage(step) {
  if (!pdfDoc) return;

  rightPageNum = clampPage(rightPageNum + step);
  rightPageInput.value = rightPageNum;

  renderAll();
}

/* 左ページ入力値を反映 */
function goLeftPage() {
  if (!pdfDoc) return;

  leftPageNum = clampPage(parseInt(leftPageInput.value, 10) || 1);
  leftPageInput.value = leftPageNum;

  /* 分割OFFのときは右ページを左+1に連動 */
  if (!splitMode) {
    rightPageNum = clampPage(leftPageNum + 1);
    rightPageInput.value = rightPageNum;
  }

  renderAll();
}

/* 右ページ入力値を反映 */
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

/* 左右を再描画 */
async function renderAll() {
  if (!pdfDoc) {
    statusEl.textContent = "PDFを選択してください";
    return;
  }

  /* 分割OFFのときは右ページを左+1にそろえる */
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
      `全 ${pdfDoc.numPages} ページ / 左 ${leftPageNum} ページ / 右 ${rightPageNum} ページ / 分割OFF（右は左+1に連動）`;
  }
}

/* 指定ページを canvas に描画 */
async function renderPage(pageNum, canvas, titleEl, label) {
  const page = await pdfDoc.getPage(pageNum);

  /* 元サイズ取得 */
  const unscaledViewport = page.getViewport({ scale: 1 });

  /* パネル幅に合わせて拡大縮小 */
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
