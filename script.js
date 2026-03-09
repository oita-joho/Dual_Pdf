import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

const pdfFile = document.getElementById("pdfFile");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const goBtn = document.getElementById("goBtn");
const pageInput = document.getElementById("pageInput");
const statusEl = document.getElementById("status");

const leftCanvas = document.getElementById("leftCanvas");
const rightCanvas = document.getElementById("rightCanvas");
const leftTitle = document.getElementById("leftTitle");
const rightTitle = document.getElementById("rightTitle");

let pdfDoc = null;
let currentLeftPage = 1;

pdfFile.addEventListener("change", handleFileSelect);
prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);
goBtn.addEventListener("click", goToPage);

async function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    currentLeftPage = 1;
    pageInput.max = pdfDoc.numPages;
    pageInput.value = 1;

    await renderSpread();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "PDFの読み込みに失敗しました。";
  }
}

function goPrev() {
  if (!pdfDoc) return;
  currentLeftPage = Math.max(1, currentLeftPage - 2);
  pageInput.value = currentLeftPage;
  renderSpread();
}

function goNext() {
  if (!pdfDoc) return;
  currentLeftPage = Math.min(pdfDoc.numPages, currentLeftPage + 2);
  pageInput.value = currentLeftPage;
  renderSpread();
}

function goToPage() {
  if (!pdfDoc) return;

  let page = parseInt(pageInput.value, 10);
  if (isNaN(page)) page = 1;

  page = Math.max(1, Math.min(pdfDoc.numPages, page));
  currentLeftPage = page;
  pageInput.value = currentLeftPage;
  renderSpread();
}

async function renderSpread() {
  if (!pdfDoc) return;

  const leftPageNum = currentLeftPage;
  const rightPageNum = currentLeftPage + 1;

  await renderPage(leftPageNum, leftCanvas, leftTitle, "左ページ");

  if (rightPageNum <= pdfDoc.numPages) {
    await renderPage(rightPageNum, rightCanvas, rightTitle, "右ページ");
  } else {
    clearCanvas(rightCanvas);
    rightTitle.textContent = "右ページ（なし）";
  }

  statusEl.textContent = `全 ${pdfDoc.numPages} ページ中 / 左 ${leftPageNum} ページ / 右 ${
    rightPageNum <= pdfDoc.numPages ? rightPageNum : "-"
  } ページ`;
}

async function renderPage(pageNum, canvas, titleEl, prefix) {
  const page = await pdfDoc.getPage(pageNum);

  const unscaledViewport = page.getViewport({ scale: 1 });
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

  titleEl.textContent = `${prefix}：${pageNum} ページ`;
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}

window.addEventListener("resize", async () => {
  if (!pdfDoc) return;
  await renderSpread();
});
