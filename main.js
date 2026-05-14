import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const metadataPath = "modis_sst_metadata.csv";
const anomalyPath = "modis_anomaly_summary.csv";

const satelliteSelect = d3.select("#satellite-select");
const timeSelect = d3.select("#time-select");

const yearSlider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");

const playButton = d3.select("#play-button");

const image = d3.select("#sst-image");
const tooltip = d3.select("#tooltip");
const trendTooltip = d3.select("#trend-tooltip");

const mapTitle = d3.select("#map-title");
const mapSubtitle = d3.select("#map-subtitle");
const caption = d3.select("#caption");
const trendSubtitle = d3.select("#trend-subtitle");

const infoRegion = d3.select("#info-region");
const infoSatellite = d3.select("#info-satellite");
const infoTime = d3.select("#info-time");
const infoDate = d3.select("#info-date");
const infoLayer = d3.select("#info-layer");

const statAnomaly = d3.select("#stat-anomaly");
const statWarmArea = d3.select("#stat-warm-area");
const statRank = d3.select("#stat-rank");

let data = [];
let anomalyData = [];
let isPlaying = false;
let playInterval = null;

const regionAnnotations = {
  "California Coast": [
    { year: 2008, month: 8, text: "Numerous wildfires",value:-0.3 },
    { year: 2013, month: 8, text: "Numerous Wildfires" },
    { year: 2023, month: 8, text: "Hurricane Hilary" }
  ],

  "Gulf of Mexico": [
    { year: 2020, month: 8, text: "Record warm Gulf conditions" }
  ],

  "Alaska Coast": [
    { year: 2016, month: 10, text: "Rapid northern ocean warming shift" }
  ]
};

function uniqueValues(data, column) {
  return Array.from(new Set(data.map((d) => d[column]))).sort();
}

function monthName(monthNumber) {
  const date = new Date(2023, monthNumber - 1, 1);
  return date.toLocaleString("en-US", { month: "long" });
}

function formatSigned(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
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
  const satellites = uniqueValues(data, "satellite");
  const times = uniqueValues(data, "time_of_day");
  const years = uniqueValues(data, "year").map(Number);

  populateSelect(satelliteSelect, satellites);
  populateSelect(timeSelect, times);

  yearSlider
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("step", 1)
    .property("value", d3.max(years));

  satelliteSelect.property("value", satellites.includes("Aqua") ? "Aqua" : satellites[0]);
  timeSelect.property("value", times.includes("Day") ? "Day" : times[0]);

  satelliteSelect.on("change", updateVisualization);
  timeSelect.on("change", updateVisualization);
  yearSlider.on("input", updateVisualization);

  playButton.on("click", togglePlay);
}

function getCurrentSelection() {
  return {
    satellite: satelliteSelect.property("value"),
    time_of_day: timeSelect.property("value"),
    year: +yearSlider.property("value"),
  };
}

function sameSelection(d, selection) {
  return (
    d.satellite === selection.satellite &&
    d.time_of_day === selection.time_of_day &&
    +d.year === selection.year 
  );
}

function findMatchingRow(selection) {
  return data.find((d) => sameSelection(d, selection));
}

function findMatchingAnomaly(selection) {
  return anomalyData.find((d) => sameSelection(d, selection));
}

function getTrendRows(selection) {
  return anomalyData
    .filter(
      (d) =>
        d.region === selection.region &&
        d.satellite === selection.satellite &&
        d.time_of_day === selection.time_of_day
    )
    .sort((a, b) => a.date_obj - b.date_obj);
}

function updateVisualization() {
  const selection = getCurrentSelection();

  yearLabel.text(selection.year);

  const row = findMatchingRow(selection);
  const anomalyRow = findMatchingAnomaly(selection);

  if (!row) {
    image.attr("src", "");
    mapTitle.text("No image available");
    mapSubtitle.text(`${selection.year}`);
    caption.text("There is no matching image in the metadata CSV for this combination of controls.");
    updateInfoPanel(selection, null);
    updateStats(null);
    drawTrendChart(selection);
    return;
  }

  image.attr("src", row.image_path);

  mapTitle.text(`MODIS ${row.satellite} ${row.time_of_day} Sea Surface Temperature`);
  mapSubtitle.text(`${row.region} | ${monthName(+row.month)} ${row.year}`);

  const anomalyText = anomalyRow
    ? `The selected month has a warmth-index anomaly of ${formatSigned(anomalyRow.anomaly_score)} relative to the long-term average for ${monthName(+row.month)}.`
    : "Run the anomaly-summary notebook cell to add transformed anomaly values for this image.";

  caption.text(
    `This image shows NASA MODIS monthly SST imagery filtered to ${row.region}, ${monthName(+row.month)} ${row.year}, MODIS ${row.satellite}, and ${row.time_of_day.toLowerCase()} observation. ${anomalyText}`
  );

  updateInfoPanel(selection, row);
  updateStats(anomalyRow);
  drawTrendChart(selection);
}

function updateInfoPanel(selection, row) {
  infoRegion.text(row ? row.region : selection.region);
  infoSatellite.text(row ? row.satellite : selection.satellite);
  infoTime.text(row ? row.time_of_day : selection.time_of_day);
  infoDate.text(row ? row.date : `${selection.year}-${String(selection.month).padStart(2, "0")}`);
  infoLayer.text(row ? row.layer : "No matching layer");
}

function updateStats(row) {
  if (!row) {
    statAnomaly.text("--");
    statWarmArea.text("--");
    statRank.text("--");
    return;
  }

  statAnomaly.text(formatSigned(row.anomaly_score));
  statWarmArea.text(`${row.warm_area_percent.toFixed(1)}%`);
  statRank.text(`#${row.warmth_rank}`);
}

// function drawTrendChart(selection) {
//   const rows = getTrendRows(selection);
//   const svg = d3.select("#trend-chart");
//   svg.selectAll("*").remove();

//   trendSubtitle.text(`A look at natural disasters in the ${selection.region} region`);

//   if (rows.length === 0) {
//     svg
//       .append("text")
//       .attr("x", 24)
//       .attr("y", 50)
//       .attr("fill", "#64748b")
//       .text("No anomaly summary data found yet. Run the notebook cell that creates modis_anomaly_summary.csv.");
//     return;
//   }

//   const width = svg.node().clientWidth || 900;
//   const height = svg.node().clientHeight || 320;
//   const margin = { top: 24, right: 24, bottom: 48, left: 62 };

//   svg.attr("viewBox", `0 0 ${width} ${height}`);

//   const x = d3
//     .scaleTime()
//     .domain(d3.extent(rows, (d) => d.date_obj))
//     .range([margin.left, width - margin.right]);

//   const maxAbs = d3.max(rows, (d) => Math.abs(d.anomaly_score)) || 0.1;
//   const y = d3
//     .scaleLinear()
//     .domain([-maxAbs, maxAbs])
//     .nice()
//     .range([height - margin.bottom, margin.top]);

//   const values = rows.map(d => d.anomaly_score);

//   const color = d3.scaleLinear()
//   .domain([
//     -0.20,
//     -0.15,
//     -0.10,
//     -0.05,
//      0.00,
//      0.05,
//      0.10,
//      0.15,
//      0.20
//   ])
//   .range([
//     "#081d58", // deepest cold navy
//     "#0b3c8a", // strong ocean blue
//     "#1d91c0", // bright blue
//     "#41b6c4", // cyan
//     "#dfff00", // yellow-green neutral
//     "#ffd200", // yellow
//     "#ff9e00", // orange
//     "#ff5e00", // hot orange
//     // "#ffe066"  // brightest warm = glowing yellow
//   ])
//   .clamp(true);

//   const xAxis = d3.axisBottom(x).ticks(6).tickSizeOuter(0);
//   const yAxis = d3.axisLeft(y).ticks(6);
//   svg.selectAll(".tick text")
//     .attr("fill", "white");

//   svg.selectAll(".tick line")
//     .attr("stroke", "white");

//   svg.selectAll(".domain")
//     .attr("stroke", "white");
//   svg
//     .append("g")
//     .attr("transform", `translate(0,${height - margin.bottom})`)
//     .call(xAxis);

//   svg
//     .append("g")
//     .attr("transform", `translate(${margin.left},0)`)
//     .call(yAxis);

  
//   svg
//     .append("line")
//     .attr("class", "zero-line")
//     .attr("x1", margin.left)
//     .attr("x2", width - margin.right)
//     .attr("y1", y(0))
//     .attr("y2", y(0));
//   const annotations = regionAnnotations[selection.region] || [];

//   svg.selectAll(".annotation")
//     .data(annotations)
//     .join("text")
//     .attr("class", "annotation")
//     .attr("x", d => {
//       const match = rows.find(r =>
//         +r.year === d.year && +r.month === d.month
//       );
//       return match ? x(match.date_obj) : 0;
//     })
//     .attr("y", d => {
//       const xMatch = rows.find(r => +r.year === d.year && +r.month === d.month);
//       if (!xMatch) return 0;

//       const yValue = d.value ?? xMatch.anomaly_score;
//       return y(yValue);
//     })
//     .text(d => d.text)
//     .attr("fill", "white")
//     .attr("font-size", "11px")
//     .attr("text-anchor", "middle")
//     .attr("dominant-baseline", "middle")
//     .style("pointer-events", "none");
    
    
  

//   // draw gradient segment between each pair of points
//   const lineGenerator = d3
//     .line()
//     .curve(d3.curveBasis)
//     .x((d) => x(d.date_obj))
//     .y((d) => y(d.anomaly_score));

//   const defs = svg.append("defs");

//   // main horizontal gradient
//   const gradient = defs
//     .append("linearGradient")
//     .attr("id", "ocean-gradient")
//     .attr("gradientUnits", "userSpaceOnUse")
//     .attr("x1", 0)
//     .attr("x2", 0)
//     .attr("y1", y(maxAbs))
//     .attr("y2", y(-maxAbs));

//   // HOT anomalies = top of chart
//   gradient
//     .append("stop")
//     .attr("offset", "0%")
//     .attr("stop-color", color(maxAbs));

//   gradient
//     .append("stop")
//     .attr("offset", "50%")
//     .attr("stop-color", color(0));

//   gradient
//     .append("stop")
//     .attr("offset", "100%")
//     .attr("stop-color", color(-maxAbs));
    

//   // optional glow blur
//   const filter = defs
//     .append("filter")
//     .attr("id", "glow");

//   filter
//     .append("feGaussianBlur")
//     .attr("stdDeviation", 6)
//     .attr("result", "blur");

//   const glowMerge = filter.append("feMerge");

//   glowMerge.append("feMergeNode").attr("in", "blur");
//   glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

//   // glow layer
//   svg
//     .append("path")
//     .datum(rows)
//     .attr("fill", "none")
//     .attr("stroke", "url(#ocean-gradient)")
//     .attr("stroke-width", 18)
//     .attr("stroke-linecap", "round")
//     .attr("stroke-linejoin", "round")
//     .attr("opacity", 0.28)
//     .attr("filter", "url(#glow)")
//     .attr("d", lineGenerator);

//   // main ribbon
//   svg
//     .append("path")
//     .datum(rows)
//     .attr("fill", "none")
//     .attr("stroke", "url(#ocean-gradient)")
//     .attr("stroke-width", 10)
//     .attr("stroke-linecap", "round")
//     .attr("stroke-linejoin", "round")
//     .attr("d", lineGenerator)

//     // TOOLTIP INTERACTION
//     .on("mousemove", function (event) {

//       const [mouseX] = d3.pointer(event);

//       const closest = rows.reduce((a, b) => {
//         return Math.abs(x(b.date_obj) - mouseX) <
//           Math.abs(x(a.date_obj) - mouseX)
//           ? b
//           : a;
//       });

//       trendTooltip
//         .style("display", "block")
//         .style("left", `${mouseX + 20}px`)
//         .style("top", `${event.offsetY}px`)
//         .html(`
//           <strong>${closest.region}</strong><br/>
//           ${monthName(+closest.month)} ${closest.year}<br/>
//           Warmth anomaly: ${formatSigned(closest.anomaly_score)}<br/>
//           Warm area: ${closest.warm_area_percent.toFixed(1)}%
//         `);
//     })

//     .on("mouseleave", () => {
//       trendTooltip.style("display", "none");
//     });
      

//   svg
//     .append("text")
//     .attr("class", "axis-label")
//     .attr("x", width / 2)
//     .attr("y", height - 8)
//     .attr("text-anchor", "middle")
//     .text("Date");

//   svg
//     .append("text")
//     .attr("class", "axis-label")
//     .attr("transform", "rotate(-90)")
//     .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
//     .attr("y", 20)
//     .attr("text-anchor", "middle")
//     .text("Warmth-Index Anomaly");
// }
const legendBins = [
  { label: "Very Cold", value: -0.20, color: "#081d58" },
  { label: "Cold",      value: -0.10, color: "#1d91c0" },
  { label: "Neutral",   value:  0.00, color: "#dfff00" },
  { label: "Warm",      value:  0.10, color: "#ff9e00" },
  { label: "Very Warm", value:  0.20, color: "#ff2a00" }
];

function drawTrendChart(selection) {
  trendSubtitle.text(
    `Temperature anomalies show how much warmer or cooler ocean conditions are relative to the historical average for each month.`
  );

  const svg = d3.select("#trend-chart");
  svg.selectAll("*").remove();

  const width = 1500;
  const height = 480;

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const regions = [
    "California Coast",
    "Gulf of Mexico",
    "East Coast"
  ];

  const subplotWidth = 500;
  const subplotHeight = 420;

  const margin = {
    top: 40,
    right: 24,
    bottom: 45,
    left: 80
  };

  const months = d3.range(1, 13);

  const x = d3.scaleLinear()
    .domain([1, 12])
    .range([margin.left, subplotWidth - margin.right]);

  const monthLabels = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];
  // GLOBAL y-range across all regions for selected year
  const allRows = anomalyData.filter(d =>
    d.satellite === selection.satellite &&
    d.time_of_day === selection.time_of_day &&
    +d.year === selection.year
  );

  const globalMaxAbs =
    d3.max(allRows, d => Math.abs(d.anomaly_score)) || 0.2;

  regions.forEach((region, i) => {
    

    const rows = anomalyData
      .filter(d =>
        d.region === region &&
        d.satellite === selection.satellite &&
        d.time_of_day === selection.time_of_day &&
        +d.year === selection.year
      )
      .sort((a, b) => a.month - b.month);

    const g = svg.append("g")
      .attr("transform", `translate(${i * subplotWidth},0)`);

    // REGION TITLE
    g.append("text")
      .attr("x", (subplotWidth - margin.left - margin.right) / 2 + margin.left)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "24px")
      .attr("font-weight", "700")
      .text(region);

      

    if (rows.length === 0) return;

    // const maxAbs = d3.max(rows, d => Math.abs(d.anomaly_score)) || 0.2;

    // const y = d3.scaleLinear()
    //   .domain([-maxAbs, maxAbs])
    //   .nice()
    //   .range([subplotHeight - margin.bottom, margin.top]);
    const y = d3.scaleLinear()
      .domain([-globalMaxAbs, globalMaxAbs])
      .nice()
      .range([subplotHeight - margin.bottom, margin.top]);

    const color = d3.scaleLinear()
      .domain([
        -0.20,
        -0.15,
        -0.10,
        -0.05,
         0.00,
         0.05,
         0.10,
         0.15,
         0.20
      ])
      .range([
        "#081d58",
        "#0b3c8a",
        "#1d91c0",
        "#41b6c4",
        "#dfff00",
        "#ffd200",
        "#ff9e00",
        "#ff5e00",
        "#ff2a00"
      ])
      .clamp(true);

    // AXES
    const xAxis = d3.axisBottom(x)
      .tickValues(months)
      .tickFormat(d => monthLabels[d - 1]);

    const yAxis = d3.axisLeft(y)
      .ticks(5);
    if (i===0) {
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -subplotHeight / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "13px")
        .text("Temperature Anomaly");
    }
    

    g.append("g")
      .attr("transform", `translate(0,${subplotHeight - margin.bottom})`)
      .call(xAxis)
      .call(g => {
        g.selectAll("text").attr("fill", "white");
        g.selectAll("line").attr("stroke", "white");
        g.select(".domain").attr("stroke", "white");
      });

    g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(yAxis)
      .call(g => {
        g.selectAll("text").attr("fill", "white");
        g.selectAll("line").attr("stroke", "white");
        g.select(".domain").attr("stroke", "white");
      });

    // ZERO LINE
    g.append("line")
      .attr("x1", margin.left)
      .attr("x2", subplotWidth - margin.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "rgba(255,255,255,0.35)")
      .attr("stroke-dasharray", "4 4");

    // LINE
    const line = d3.line()
      .curve(d3.curveBasis)
      .x(d => x(d.month))
      .y(d => y(d.anomaly_score));

    // GRADIENT
    const defs = g.append("defs");

    const gradientId = `gradient-${i}`;

    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", y(globalMaxAbs))
      .attr("y2", y(-globalMaxAbs));

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", color(globalMaxAbs));

    gradient.append("stop")
      .attr("offset", "50%")
      .attr("stop-color", color(0));

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", color(-globalMaxAbs));

    // GLOW
    g.append("path")
      .datum(rows)
      .attr("fill", "none")
      .attr("stroke", `url(#${gradientId})`)
      .attr("stroke-width", 14)
      .attr("opacity", 0.25)
      .attr("stroke-linecap", "round")
      .attr("filter", "url(#glow)")
      .attr("d", line);

    // MAIN LINE
    g.append("path")
      .datum(rows)
      .attr("fill", "none")
      .attr("stroke", `url(#${gradientId})`)
      .attr("stroke-width", 8)
      .attr("stroke-linecap", "round")
      .attr("d", line);

    // POINTS
    g.selectAll(".point")
      .data(rows)
      .join("circle")
      .attr("cx", d => x(d.month))
      .attr("cy", d => y(d.anomaly_score))
      .attr("r", 5)
      .attr("fill", d => color(d.anomaly_score))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)

      .on("mousemove", function(event, d) {

        trendTooltip
          .style("display", "block")
          .style("left", `${event.offsetX + 16}px`)
          .style("top", `${event.offsetY}px`)
          .html(`
            <strong>${region}</strong><br/>
            ${monthName(d.month)} ${d.year}<br/>
            Warmth anomaly: ${formatSigned(d.anomaly_score)}<br/>
            Warm area: ${d.warm_area_percent.toFixed(1)}%
          `);
      })

      .on("mouseleave", () => {
        trendTooltip.style("display", "none");
      });

  });
  const legendWidth = legendBins.length * 150;

  const legend = svg.append("g")
    .attr(
      "transform",
      `translate(${(width - legendWidth) / 2}, ${height - 25})`
    );

  

  const bin = legend.selectAll(".bin")
    .data(legendBins)
    .join("g")
    .attr("class", "bin")
    .attr("transform", (d, i) => `translate(${i * 150}, 0)`);

  bin.append("rect")
    .attr("width", 30)
    .attr("height", 14)
    .attr("fill", d => d.color)
    .attr("stroke", "white")
    .attr("stroke-width", 1.2);

  bin.append("text")
    .attr("x", 40)
    .attr("y", 12)
    .attr("fill", "white")
    .attr("font-size", "13px")
    .attr("dominant-baseline","middle")
    .text(d => d.label);
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
    const currentYear = +yearSlider.property("value");
    const maxYear = +yearSlider.attr("max");
    const minYear = +yearSlider.attr("min");

    const nextYear = currentYear >= maxYear ? minYear : currentYear + 1;
    yearSlider.property("value", nextYear);
    updateVisualization();
  }, 900);
}

function setupTooltip() {
  image
    .on("mousemove", function (event) {
      const selection = getCurrentSelection();
      const row = findMatchingRow(selection);
      const anomalyRow = findMatchingAnomaly(selection);

      if (!row) return;

      const [x, y] = d3.pointer(event, this);
      const anomalyText = anomalyRow
        ? `<br/>Warmth anomaly: ${formatSigned(anomalyRow.anomaly_score)}<br/>Warm-color area: ${anomalyRow.warm_area_percent.toFixed(1)}%`
        : "";

      tooltip
        .style("display", "block")
        .style("left", `${x + 16}px`)
        .style("top", `${y + 16}px`)
        .html(`
          <strong>${row.region}</strong><br/>
          ${monthName(+row.month)} ${row.year}<br/>
          MODIS ${row.satellite}, ${row.time_of_day}<br/>
          Layer: ${row.layer}
          ${anomalyText}
        `);
    })
    .on("mouseleave", function () {
      tooltip.style("display", "none");
    });
}
const legendScale = d3.scaleThreshold()
  .domain([-0.15, -0.05, 0.05, 0.15])
  .range([
    "#081d58", // very cold
    "#1d91c0", // cold
    "#dfff00", // neutral
    "#ff9e00", // warm
    "#ff2a00"  // very warm
  ]);

async function loadAnomalyData() {
  try {
    return await d3.csv(anomalyPath, (d) => ({
      ...d,
      year: +d.year,
      month: +d.month,
      avg_warmth_score: +d.avg_warmth_score,
      anomaly_score: +d.anomaly_score,
      warm_area_percent: +d.warm_area_percent,
      max_warmth_score: +d.max_warmth_score,
      warmth_rank: +d.warmth_rank,
      date_obj: new Date(+d.year, +d.month - 1, 1),
    }));
  } catch (error) {
    console.warn("Could not load modis_anomaly_summary.csv yet.", error);
    return [];
  }
}

async function init() {
  data = await d3.csv(metadataPath, (d) => ({
    ...d,
    year: +d.year,
    month: +d.month,
  }));

  data = data.filter((d) => d.status === "success");
  anomalyData = await loadAnomalyData();

  setupControls();
  setupTooltip();
  updateVisualization();
}

init();