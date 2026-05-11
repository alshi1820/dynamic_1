import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const metadataPath = "modis_sst_metadata.csv";

const regionSelect = d3.select("#region-select");
const satelliteSelect = d3.select("#satellite-select");
const timeSelect = d3.select("#time-select");

const yearSlider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");

const monthSlider = d3.select("#month-slider");
const monthLabel = d3.select("#month-label");

const playButton = d3.select("#play-button");

const image = d3.select("#sst-image");
const tooltip = d3.select("#tooltip");

const mapTitle = d3.select("#map-title");
const mapSubtitle = d3.select("#map-subtitle");
const caption = d3.select("#caption");

const infoRegion = d3.select("#info-region");
const infoSatellite = d3.select("#info-satellite");
const infoTime = d3.select("#info-time");
const infoDate = d3.select("#info-date");
const infoLayer = d3.select("#info-layer");

let data = [];
let isPlaying = false;
let playInterval = null;

function uniqueValues(data, column) {
  return Array.from(new Set(data.map((d) => d[column]))).sort();
}

function monthName(monthNumber) {
  const date = new Date(2023, monthNumber - 1, 1);
  return date.toLocaleString("en-US", { month: "long" });
}

function populateSelect(select, values) {
  select
    .selectAll("option")
    .data(values)
    .join("option")
    .attr("value", (d) => d)
    .text((d) => d);
}

function setupControls() {
  const regions = uniqueValues(data, "region");
  const satellites = uniqueValues(data, "satellite");
  const times = uniqueValues(data, "time_of_day");
  const years = uniqueValues(data, "year").map(Number);
  const months = uniqueValues(data, "month").map(Number);

  populateSelect(regionSelect, regions);
  populateSelect(satelliteSelect, satellites);
  populateSelect(timeSelect, times);

  yearSlider
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("step", 1)
    .property("value", d3.max(years));

  monthSlider
    .attr("min", d3.min(months))
    .attr("max", d3.max(months))
    .attr("step", 1)
    .property("value", 7);

  regionSelect.property("value", "California Coast");
  satelliteSelect.property("value", "Aqua");
  timeSelect.property("value", "Day");

  regionSelect.on("change", updateVisualization);
  satelliteSelect.on("change", updateVisualization);
  timeSelect.on("change", updateVisualization);
  yearSlider.on("input", updateVisualization);
  monthSlider.on("input", updateVisualization);

  playButton.on("click", togglePlay);
}

function getCurrentSelection() {
  return {
    region: regionSelect.property("value"),
    satellite: satelliteSelect.property("value"),
    time_of_day: timeSelect.property("value"),
    year: +yearSlider.property("value"),
    month: +monthSlider.property("value"),
  };
}

function findMatchingRow(selection) {
  return data.find(
    (d) =>
      d.region === selection.region &&
      d.satellite === selection.satellite &&
      d.time_of_day === selection.time_of_day &&
      +d.year === selection.year &&
      +d.month === selection.month
  );
}

function updateVisualization() {
  const selection = getCurrentSelection();

  yearLabel.text(selection.year);
  monthLabel.text(monthName(selection.month));

  const row = findMatchingRow(selection);

  if (!row) {
    image.attr("src", "");
    mapTitle.text("No image available");
    mapSubtitle.text(
      `${selection.region}, ${selection.satellite}, ${selection.time_of_day}, ${monthName(selection.month)} ${selection.year}`
    );
    caption.text(
      "There is no matching image in the metadata CSV for this combination of controls."
    );

    infoRegion.text(selection.region);
    infoSatellite.text(selection.satellite);
    infoTime.text(selection.time_of_day);
    infoDate.text(`${selection.year}-${String(selection.month).padStart(2, "0")}`);
    infoLayer.text("No matching layer");

    return;
  }

  image.attr("src", row.image_path);

  mapTitle.text(
    `MODIS ${row.satellite} ${row.time_of_day} Sea Surface Temperature`
  );

  mapSubtitle.text(
    `${row.region} | ${monthName(+row.month)} ${row.year}`
  );

  caption.text(
    `This image shows NASA MODIS Level-3 monthly sea surface temperature imagery filtered to ${row.region}, ${monthName(+row.month)} ${row.year}, MODIS ${row.satellite}, and ${row.time_of_day.toLowerCase()} observation.`
  );

  infoRegion.text(row.region);
  infoSatellite.text(row.satellite);
  infoTime.text(row.time_of_day);
  infoDate.text(row.date);
  infoLayer.text(row.layer);
}

function togglePlay() {
  if (isPlaying) {
    clearInterval(playInterval);
    playInterval = null;
    isPlaying = false;
    playButton.text("Play");
    return;
  }

  isPlaying = true;
  playButton.text("Pause");

  playInterval = setInterval(() => {
    const currentMonth = +monthSlider.property("value");
    const maxMonth = +monthSlider.attr("max");
    const minMonth = +monthSlider.attr("min");

    const nextMonth = currentMonth >= maxMonth ? minMonth : currentMonth + 1;

    monthSlider.property("value", nextMonth);
    updateVisualization();
  }, 900);
}

function setupTooltip() {
  image
    .on("mousemove", function (event) {
      const selection = getCurrentSelection();
      const row = findMatchingRow(selection);

      if (!row) return;

      const [x, y] = d3.pointer(event, this);

      tooltip
        .style("display", "block")
        .style("left", `${x + 16}px`)
        .style("top", `${y + 16}px`)
        .html(`
          <strong>${row.region}</strong><br/>
          ${monthName(+row.month)} ${row.year}<br/>
          MODIS ${row.satellite}, ${row.time_of_day}<br/>
          Layer: ${row.layer}
        `);
    })
    .on("mouseleave", function () {
      tooltip.style("display", "none");
    });
}

async function init() {
  data = await d3.csv(metadataPath, (d) => ({
    ...d,
    year: +d.year,
    month: +d.month,
  }));

  data = data.filter((d) => d.status === "success");

  setupControls();
  setupTooltip();
  updateVisualization();
}

init();