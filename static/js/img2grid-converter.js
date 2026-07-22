const dropZone = document.querySelector(".drop-zone");
const chooseButton = document.querySelector("[data-choose-button]");
const fileInput = document.createElement("input");
const outputStatus = document.querySelector("[data-output-status]");
const resultsStage = document.querySelector("[data-results-stage]");
const resultsLoading = document.querySelector("[data-results-loading]");
const resultsGrid = document.querySelector("[data-results-grid]");
const pixelCanvas = document.querySelector("[data-preview-canvas]");
const guideCanvas = document.querySelector("[data-guide-canvas]");
const paletteWrap = document.querySelector(".result-palette");
const downloadPixelButton = document.querySelector("[data-download-pixel]");
const downloadGuideButton = document.querySelector("[data-download-guide]");
const text = window.img2gridText || {};

const state = {
  file: null,
  image: null,
  palette: [],
  gridPixels: [],
  gridSize: 64,
  colorCount: 12,
  isGenerating: false,
};

let generationToken = 0;

fileInput.type = "file";
fileInput.accept = "image/*";
fileInput.hidden = true;
document.body.appendChild(fileInput);

function t(key, fallback) {
  return text[key] || fallback;
}

function formatText(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value);
  }, template);
}

function getActiveNumber(groupIndex, fallback) {
  const groups = [...document.querySelectorAll(".setting-group")];
  const group = groups[groupIndex];
  const active = group?.querySelector(".segmented .active");
  const value = active?.textContent.trim().split("x")[0];
  return Number.parseInt(value, 10) || fallback;
}

function setStatus(message) {
  if (outputStatus) {
    outputStatus.textContent = message;
  }
}

function revealResultsStage() {
  resultsStage?.setAttribute("data-results-empty", "false");
  resultsGrid?.removeAttribute("hidden");
}

function setLoading(isLoading) {
  state.isGenerating = isLoading;
  resultsLoading?.toggleAttribute("hidden", !isLoading);

  if (downloadPixelButton) {
    downloadPixelButton.disabled = isLoading || !pixelCanvas?.width;
  }
  if (downloadGuideButton) {
    downloadGuideButton.disabled = isLoading || !guideCanvas?.width;
  }
}

function updateChooseButton(hasFile) {
  if (!chooseButton) return;
  const label = hasFile ? t("upload_new_image", "Upload New Image") : t("choose_file", "Choose File");
  chooseButton.innerHTML = `<span class="ui-icon icon-folder" aria-hidden="true"></span>${label}`;
}

function setDropZoneFile(file) {
  if (!dropZone || !file) return;

  const title = dropZone.querySelector("h3");
  const copy = dropZone.querySelector("p");

  if (title) title.textContent = file.name;
  if (copy) copy.textContent = t("generating", "Generating your pixel grid...");
  dropZone.classList.add("has-file");
  updateChooseButton(true);
  revealResultsStage();
  setLoading(true);
  setStatus(t("generating", "Generating your pixel grid..."));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("read_error", "Could not read this image file.")));
    };
    image.src = url;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus(t("please_choose_image", "Please choose an image file"));
    return;
  }

  setDropZoneFile(file);
  state.file = file;
  setStatus(t("reading", "Reading image..."));

  try {
    state.image = await loadImage(file);
    generateGrid();
  } catch (error) {
    setStatus(error.message);
    setLoading(false);
  }
}

function sampleImageToGrid(image, size) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const x = Math.round((size - width) / 2);
  const y = Math.round((size - height) / 2);
  ctx.drawImage(image, x, y, width, height);

  const data = ctx.getImageData(0, 0, size, size).data;
  const pixels = [];
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    pixels.push([
      Math.round(data[index] * alpha + 255 * (1 - alpha)),
      Math.round(data[index + 1] * alpha + 255 * (1 - alpha)),
      Math.round(data[index + 2] * alpha + 255 * (1 - alpha)),
    ]);
  }
  return pixels;
}

function colorDistance(a, b) {
  const red = a[0] - b[0];
  const green = a[1] - b[1];
  const blue = a[2] - b[2];
  return red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11;
}

function nearestPaletteIndex(color, palette) {
  let nearest = 0;
  let bestDistance = Infinity;

  palette.forEach((paletteColor, index) => {
    const distance = colorDistance(color, paletteColor);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = index;
    }
  });

  return nearest;
}

function buildPalette(pixels, count) {
  const bucket = new Map();
  pixels.forEach((pixel) => {
    const key = pixel.map((value) => Math.round(value / 16) * 16).join(",");
    const item = bucket.get(key) || { color: pixel, hits: 0 };
    item.hits += 1;
    bucket.set(key, item);
  });

  const seeds = [...bucket.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, count)
    .map((item) => [...item.color]);

  while (seeds.length < count) seeds.push([255, 255, 255]);

  let centers = seeds;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = centers.map(() => [0, 0, 0, 0]);

    pixels.forEach((pixel) => {
      const index = nearestPaletteIndex(pixel, centers);
      sums[index][0] += pixel[0];
      sums[index][1] += pixel[1];
      sums[index][2] += pixel[2];
      sums[index][3] += 1;
    });

    centers = centers.map((center, index) => {
      const sum = sums[index];
      if (!sum[3]) return center;
      return [
        Math.round(sum[0] / sum[3]),
        Math.round(sum[1] / sum[3]),
        Math.round(sum[2] / sum[3]),
      ];
    });
  }

  return centers.sort((a, b) => {
    const lightA = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11;
    const lightB = b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11;
    return lightB - lightA;
  });
}

function colorToHex(color) {
  return `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function drawPixelGrid(canvas, size, palette, gridPixels) {
  const scale = Math.max(5, Math.floor(768 / size));
  const canvasSize = size * scale;
  const ctx = canvas.getContext("2d");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  ctx.imageSmoothingEnabled = false;

  gridPixels.forEach((paletteIndex, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    ctx.fillStyle = colorToHex(palette[paletteIndex]);
    ctx.fillRect(x * scale, y * scale, scale, scale);
  });
}

function drawGridLines(ctx, canvasSize, size, scale, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  for (let index = 0; index <= size; index += 1) {
    const position = index * scale + 0.5;
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvasSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvasSize, position);
    ctx.stroke();
  }
}

function drawGuide(canvas, size, palette, gridPixels) {
  const scale = Math.max(8, Math.floor(1024 / size));
  const canvasSize = size * scale;
  const ctx = canvas.getContext("2d");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.max(6, Math.floor(scale * 0.46))}px system-ui, sans-serif`;

  gridPixels.forEach((paletteIndex, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const color = palette[paletteIndex];
    const lightness = color[0] * 0.3 + color[1] * 0.59 + color[2] * 0.11;
    ctx.fillStyle = colorToHex(color);
    ctx.fillRect(x * scale, y * scale, scale, scale);
    ctx.fillStyle = lightness > 150 ? "rgba(7, 22, 66, 0.78)" : "rgba(255, 255, 255, 0.86)";
    ctx.fillText(String(paletteIndex + 1), x * scale + scale / 2, y * scale + scale / 2);
  });

  drawGridLines(ctx, canvasSize, size, scale, "rgba(7, 22, 66, 0.24)");
}

function renderPalette(palette) {
  if (!paletteWrap) return;
  paletteWrap.innerHTML = "";

  palette.forEach((color, index) => {
    const item = document.createElement("span");
    item.style.setProperty("--c", colorToHex(color));
    item.textContent = index + 1;
    item.title = `${index + 1}: ${colorToHex(color)}`;
    paletteWrap.appendChild(item);
  });
}

function generateGrid() {
  if (!state.image) {
    setStatus(t("upload_first", "Upload an image first"));
    fileInput.click();
    return;
  }

  const token = ++generationToken;
  state.gridSize = getActiveNumber(0, 64);
  state.colorCount = getActiveNumber(1, 12);
  revealResultsStage();
  setLoading(true);
  setStatus(t("generating", "Generating your pixel grid..."));

  requestAnimationFrame(() => {
    if (token !== generationToken) return;

    try {
      if (!pixelCanvas || !guideCanvas) {
        setStatus(t("preview_not_found", "Preview area not found."));
        setLoading(false);
        return;
      }

      const pixels = sampleImageToGrid(state.image, state.gridSize);
      const palette = buildPalette(pixels, state.colorCount);
      const gridPixels = pixels.map((pixel) => nearestPaletteIndex(pixel, palette));

      state.palette = palette;
      state.gridPixels = gridPixels;

      drawPixelGrid(pixelCanvas, state.gridSize, state.palette, state.gridPixels);
      drawGuide(guideCanvas, state.gridSize, state.palette, state.gridPixels);
      renderPalette(state.palette);

      requestAnimationFrame(() => {
        if (token !== generationToken) return;
        setLoading(false);
        setStatus(formatText(t("grid_status", "{size}x{size} grid · {count} colors"), {
          size: state.gridSize,
          count: state.palette.length,
        }));

        const copy = dropZone?.querySelector("p");
        if (copy) copy.textContent = t("grid_ready", "Grid ready. Tweak settings or download your guide.");
      });
    } catch (error) {
      setLoading(false);
      setStatus(error.message || t("could_not_generate", "Could not generate grid."));
    }
  });
}

function downloadCanvas(canvas, filename) {
  if (!canvas?.width) return;

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

chooseButton?.addEventListener("click", () => fileInput.click());

dropZone?.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  fileInput.click();
});

dropZone?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  handleFile(fileInput.files?.[0]);
  fileInput.value = "";
});

downloadPixelButton?.addEventListener("click", () => {
  downloadCanvas(pixelCanvas, `img2grid-${state.gridSize}x${state.gridSize}-pixel.png`);
});

downloadGuideButton?.addEventListener("click", () => {
  downloadCanvas(guideCanvas, `img2grid-${state.gridSize}x${state.gridSize}-guide.png`);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone?.addEventListener("drop", (event) => {
  handleFile(event.dataTransfer?.files?.[0]);
});

document.querySelector(".converter-settings")?.addEventListener("click", (event) => {
  const button = event.target.closest(".segmented button");
  if (!button) return;

  const group = button.closest(".segmented");
  if (!group) return;

  group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");

  if (state.image) generateGrid();
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
