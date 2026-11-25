# Wave Prediction & Offshore Energy Suite — Live Demo

Interactive global coastal wave forecasting, storm-surge monitoring, and wave energy converter (WEC) site screening platform covering North America, NW Europe, Australia, New Zealand, and Chile.

**Live Interactive Demo:** https://yman95.github.io/wave-energy-suite-demo/

---

## Included Applications

### 1. 72-Hour Wave & Storm-Surge Forecast (`ocean-wave-demo/`)
* **Global Coastal Coverage:** Probabilistic 1–72 hour forecasts (`P10 / P50 / P90`) for significant wave height (`Hs`), wave power (`kW/m`), spectral energy period (`Te`), and total water level (`tide + surge`) across **66 buoys** (US, Canada, UK/Ireland/France, Australia) and **25 tide gauges**, plus **18 precomputed global Virtual Buoy hotspots** and on-demand offshore clicking anywhere worldwide (with inland land masking).
* **Marine Operations & Decision Support:** Joint wind/wave/period O&M `GO / NO-GO` window planner, device power output estimation (**RM3**, **RM5**, **RM6**, **PB10**), official government hazard alerts, bring-your-own-buoy CSV calibration, and CSV / GeoJSON / printable EOC brief exports.

### 2. Global WEC Site Selection Atlas (`site-selection/site_atlas.html`)
* **Multi-Region Resource Screening:** Interactive atlas spanning **15,557 mapped coastal sites** across North America, NW Europe, Australia, New Zealand, and Chile.
* **Multi-Device Techno-Economic Comparison:** Side-by-side levelized cost and annual energy yield comparison across **RM3**, **RM5**, **RM6**, and **PB10** architectures, plus client-side custom device CSV upload, Federal ITC & electricity tariff parity sliders, region quick-zoom controls, and one-click deep links into the 72-hour forecast view.
* **Marine Spatial Planning Overlays:** Esri Ocean and Satellite basemaps alongside submarine cables, marine vessel traffic layers, and CSV / GeoJSON exports.

---

## Decision-Support Notice

This demo is provided for coastal planning, engineering analysis, and decision-support exploration only. Forecasts, surge estimates, and hazard summaries do **not** replace official marine forecasts, advisories, or warnings issued by national meteorological and hydrographic authorities including **NOAA / NWS / NTWC / PTWC** (United States), **ECCC / DFO** (Canada), **UK Met Office / Met Éireann / Météo-France / AEMET / IPMA** (Europe), **BOM** (Australia), **MetService** (New Zealand), and **SHOA** (Chile). Mariners and coastal operators should always verify official bulletins prior to operational decisions.
