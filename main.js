// main.js

/*
=========================================
1. CREATE MAP
=========================================
*/

const map = L.map("map", {
  zoomControl: false,
  attributionControl: false
});

/*
=========================================
2. CUSTOM BBOX
Replace with your bbox
=========================================
*/

const bbox = [
  [18.0, -98.0], // southwest
  [42.0, -65.0]  // northeast
];

map.fitBounds(bbox);

/*
=========================================
3. BASEMAP
=========================================
*/

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    subdomains: "abcd",
    maxZoom: 19
  }
).addTo(map);

/*
=========================================
4. IMAGE OVERLAY
Replace with your heatmap/raster image
=========================================
*/

const overlayBounds = [
  [18.0, -98.0],
  [42.0, -65.0]
];

L.imageOverlay(
  "images/climate-overlay.png",
  overlayBounds,
  {
    opacity: 0.85
  }
).addTo(map);

/*
=========================================
5. STORM TRACK DATA

Replace with your own points
Each point has:
- lat
- lng
- category
- icon image
=========================================
*/

const stormPoints = [
  {
    lat: 20.2,
    lng: -86.5,
    category: "TS",
    icon: "icons/ts.png"
  },
  {
    lat: 22.0,
    lng: -87.1,
    category: "1",
    icon: "icons/cat1.png"
  },
  {
    lat: 24.3,
    lng: -88.0,
    category: "2",
    icon: "icons/cat2.png"
  },
  {
    lat: 26.5,
    lng: -89.4,
    category: "3",
    icon: "icons/cat3.png"
  },
  {
    lat: 29.0,
    lng: -90.5,
    category: "4",
    icon: "icons/cat4.png"
  },
  {
    lat: 33.2,
    lng: -84.8,
    category: "TS",
    icon: "icons/ts.png"
  }
];

/*
=========================================
6. DRAW TRACK LINE
=========================================
*/

const latlngs = stormPoints.map(p => [p.lat, p.lng]);

L.polyline(latlngs, {
  color: "white",
  weight: 4,
  opacity: 0.95,
  dashArray: "10 8"
}).addTo(map);

/*
=========================================
7. PLACE ICONS ON TRACK
=========================================
*/

stormPoints.forEach(point => {

  const icon = L.divIcon({
    className: "",
    html: `
      <div class="storm-marker">
        <img src="${point.icon}" />
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });

  L.marker([point.lat, point.lng], {
    icon
  })
  .addTo(map)
  .bindTooltip(point.category, {
    permanent: true,
    direction: "center",
    className: "storm-label",
    offset: [0, 0]
  });
});

/*
=========================================
8. OPTIONAL MOVING HURRICANE ICON
=========================================
*/

const movingIcon = L.divIcon({
  className: "",
  html: `
    <div class="storm-marker">
      <img src="icons/hurricane-center.png" />
    </div>
  `,
  iconSize: [52, 52],
  iconAnchor: [26, 26]
});

const movingMarker = L.marker(latlngs[0], {
  icon: movingIcon
}).addTo(map);

let currentIndex = 0;

setInterval(() => {

  currentIndex++;

  if (currentIndex >= latlngs.length) {
    currentIndex = 0;
  }

  movingMarker.setLatLng(latlngs[currentIndex]);

}, 1000);