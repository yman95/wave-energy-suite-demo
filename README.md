# Wave Prediction & Offshore Energy Suite — Live Demo

Interactive global coastal wave forecasting, storm-surge monitoring, and wave energy converter (WEC) site screening platform covering 10 global ocean basins (North America, NW Europe, North Atlantic, Australia, Pacific Islands, New Zealand, South America, South Africa & Indian Ocean, Japan & NW Pacific, and India/Sri Lanka).

**Live Interactive Demo:** https://yman95.github.io/wave-energy-suite-demo/

---

## Included Applications

### 1. 72-Hour Wave & Storm-Surge Forecast (`ocean-wave-demo/`)
* **Global Coastal Coverage:** Probabilistic 1–72 hour forecasts (`P10 / P50 / P90`) using locally trained regional wave models (full-history `1974–2026` government buoys + `18-mission 1985–2026` IMOS satellite altimetry + GEBCO geometry + ERA5/SST air-sea climate forcing + live operational NWP conformal calibration) and coordinate-free **Global Storm Surge v2** across **10 ocean basins** (**179 live buoys** across **NOAA/ECCC, KMA, Japan MLIT NOWPHAS, UK CCO, Ireland Marine Institute, Sweden SMHI, Spain EUSKOOS, Australia IMOS/MHL/AODN/Deakin/UWA/Flinders/Gippsland, and CDIP** and **44 global tide gauges** across **NOAA CO-OPS, DFO IWLS, Kartverket Norway, Ireland ERDDAP, UK Environment Agency, SMHI Sweden, QLD Storm Tide Australia, and UNESCO/IOC Chile & Japan**), plus **49 precomputed global Virtual Buoy hotspots** and on-demand offshore clicking anywhere worldwide (with inland land masking and live station wind/gust/dir/spread/SST telemetry).
* **Marine Operations & Decision Support:** Joint wind/wave/period O&M `GO / NO-GO` window planner, device power output estimation (**RM3**, **RM5**, **RM6**, **PB10**), official government hazard alerts, bring-your-own-buoy CSV calibration, and CSV / GeoJSON / printable EOC brief exports.

### 2. Global WEC Site Selection Atlas (`site-selection/site_atlas.html`)
* **Multi-Region Resource Screening:** Interactive atlas spanning **15,763 mapped coastal sites** across **15 regions (North America + 9 global basins)** using bias-corrected US 200 m hindcasts, AI Downscaling v2 (CA/AK), and **9-Basin AI Coastal Downscaling v2 + multi-decade (`1974–2026`) anchored $H_{s,50}$ extremes** globally: North America, NW Europe, North Atlantic (Iceland, Faroes, Western Norway, Lofoten), Australia, New Zealand, Chile & South America (Chile, Peru, Argentina, Brazil), South Africa & Indian Ocean (South Africa, Namibia, Madagascar, Réunion/Mauritius), Japan & West Pacific (Japan, Mainland China coastal shelves, Taiwan, Jeju, Guam), India & Sri Lanka, and Pacific Islands & Macaronesia (Azores, Madeira, Canaries, Morocco, Fiji, Samoa, Palau).
* **Multi-Device Techno-Economic Comparison:** Side-by-side levelized cost and annual energy yield comparison across **RM3**, **RM5**, **RM6**, and **PB10** architectures, plus client-side custom device CSV upload, Federal ITC & electricity tariff parity sliders, region quick-zoom controls, and one-click deep links into the 72-hour forecast view.
* **Marine Spatial Planning Overlays:** Esri Ocean and Satellite basemaps alongside **NOAA + TeleGeography Global Submarine Cables (`2,391` segments offline)**, **NOAA + Canada CPCAD + UNEP-WCMC WDPA Global Marine Protected Areas (`4,535` MPAs)**, vessel traffic layers, and CSV / GeoJSON exports.

---

## Decision-Support Notice

This demo is provided for coastal planning, engineering analysis, and decision-support exploration only. Forecasts, surge estimates, and hazard summaries do **not** replace official marine forecasts, advisories, or warnings issued by national meteorological and hydrographic authorities including **NOAA / NWS / NTWC / PTWC** (United States), **ECCC / DFO** (Canada), **UK Met Office / Met Éireann / Météo-France / AEMET / IPMA** (Europe), **BOM** (Australia), **MetService** (New Zealand), **INCOIS** (India), and **SHOA** (Chile). Mariners and coastal operators should always verify official bulletins prior to operational decisions.
