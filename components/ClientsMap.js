"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ────────────────────────────────────────────────────────────────
// Constantes — cadrage Île-de-France
// ────────────────────────────────────────────────────────────────
const BAN_URL = "https://api-adresse.data.gouv.fr/search/";
const CACHE_KEY = "clientsMapGeocodeCache_v2";

const IDF_CENTER = [48.8499, 2.5];
const IDF_ZOOM = 9;
const IDF_BOUNDS = [
  [48.10, 1.30], // SW
  [49.30, 3.60], // NE — couvre IdF + Oise/Eure/Yonne
];
const IDF_MIN_ZOOM = 8;
const IDF_MAX_ZOOM = 18;
const BAN_LAT_BIAS = 48.85;
const BAN_LNG_BIAS = 2.35;

const STATUS_META = {
  validated: { color: "#16a34a", label: "Traités",    desc: "vente validée / avec prix" },
  mixed:     { color: "#f59e0b", label: "Partiels",   desc: "validés et annulés mêlés" },
  cancelled: { color: "#dc2626", label: "Annulés",    desc: "vente annulée" },
  pending:   { color: "#6b7280", label: "En attente", desc: "ni prix ni état" },
};
const STATUS_ORDER = ["validated", "mixed", "cancelled", "pending"];

// ────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────
const norm = (s) => {
  if (s == null || s === "") return "";
  return String(s).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const parsePrice = (v) => {
  if (v == null || v === "") return 0;
  const num = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
};

const saleAmount = (sale) =>
  parsePrice(sale?.["MONTANT TTC"] ?? sale?.["MONTANT TTC "] ?? sale?.["MONTANT HT"]);

const isCancelled = (sale) => norm(sale?.["ETAT"]).includes("annule");

const isValidated = (sale) => {
  if (isCancelled(sale)) return false;
  const n = norm(sale?.["ETAT"]);
  if (["valide", "ok", "termine", "termin", "fini", "pose", "installe"].some((k) => n.includes(k))) {
    return true;
  }
  // toute vente avec un prix réel compte comme validée (sauf si annulée)
  return saleAmount(sale) > 0;
};

const statusOf = (sales) => {
  const cancelled = sales.filter(isCancelled).length;
  const validated = sales.filter(isValidated).length;
  if (validated > 0 && cancelled === 0) return "validated";
  if (cancelled > 0 && validated === 0) return "cancelled";
  if (validated > 0 && cancelled > 0)   return "mixed";
  return "pending";
};

const buildAddressString = (sale) =>
  [sale["ADRESSE DU CLIENT"], sale["CP"], sale["VILLE"]]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean)
    .join(" ");

const groupKey = (sale) =>
  [
    norm(sale["NOM DU CLIENT"]),
    norm(sale["ADRESSE DU CLIENT"]),
    norm(sale["VILLE"]),
    norm(sale["CP"]),
  ].join("|");

const fmtMoney = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
};

// ────────────────────────────────────────────────────────────────
// Cache de géocodage (localStorage)
// ────────────────────────────────────────────────────────────────
const loadCache = () => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
};
const saveCache = (cache) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  catch { /* quota */ }
};

const geocode = async (query, signal) => {
  if (!query || query.length < 3) return null;
  const url = `${BAN_URL}?q=${encodeURIComponent(query)}&limit=1&lat=${BAN_LAT_BIAS}&lon=${BAN_LNG_BIAS}`;
  const r = await fetch(url, { signal });
  if (!r.ok) return null;
  const data = await r.json();
  const feat = data?.features?.[0];
  if (!feat) return null;
  const [lng, lat] = feat.geometry?.coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: feat.properties?.label || query };
};

// ────────────────────────────────────────────────────────────────
// Hook : ventes → groupes par client → points géocodés
// ────────────────────────────────────────────────────────────────
const useGeocodedPoints = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [points, setPoints] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cacheRef = useRef(loadCache());

  // 1) Fetch ventes
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/ventes", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((data) => setSales(Array.isArray(data?.data) ? data.data : []))
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  // 2) Groupement par client
  const groups = useMemo(() => {
    const map = new Map();
    for (const sale of sales) {
      const key = groupKey(sale);
      if (!key.replace(/\|/g, "")) continue;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name:    sale["NOM DU CLIENT"] || "—",
          address: sale["ADRESSE DU CLIENT"] || "",
          city:    sale["VILLE"] || "",
          cp:      sale["CP"] || "",
          phone:   sale["TELEPHONE"] || "",
          query:   buildAddressString(sale),
          sales:   [],
        });
      }
      map.get(key).sales.push(sale);
    }
    return Array.from(map.values()).filter((g) => g.query.length >= 3);
  }, [sales]);

  // 3) Géocodage avec cache + throttle ~8 req/s
  useEffect(() => {
    if (!groups.length) { setPoints([]); return; }
    let cancelled = false;
    const ctrl = new AbortController();

    (async () => {
      const cache = cacheRef.current;
      const out = [];
      const todo = [];

      for (const g of groups) {
        const cached = cache[g.query];
        if (cached === null) continue;
        if (cached && Number.isFinite(cached.lat)) {
          out.push({ ...g, lat: cached.lat, lng: cached.lng });
        } else {
          todo.push(g);
        }
      }

      const cachedCount = out.length;
      setPoints(out);
      setProgress({ done: cachedCount, total: cachedCount + todo.length });

      let dirty = false;
      for (let i = 0; i < todo.length; i++) {
        if (cancelled) break;
        const g = todo[i];
        try {
          const res = await geocode(g.query, ctrl.signal);
          if (res) {
            cache[g.query] = { lat: res.lat, lng: res.lng };
            out.push({ ...g, lat: res.lat, lng: res.lng });
            setPoints([...out]);
          } else {
            cache[g.query] = null;
          }
          dirty = true;
        } catch (err) {
          if (err.name === "AbortError") break;
        }
        setProgress({ done: cachedCount + i + 1, total: cachedCount + todo.length });
        await new Promise((r) => setTimeout(r, 130));
        if ((i + 1) % 20 === 0 && dirty) { saveCache(cache); dirty = false; }
      }
      if (dirty) saveCache(cache);
    })();

    return () => { cancelled = true; ctrl.abort(); };
  }, [groups]);

  return { points, loading, error, progress };
};

// ────────────────────────────────────────────────────────────────
// Sous-composants
// ────────────────────────────────────────────────────────────────
const FitBounds = ({ points }) => {
  const map = useMap();
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!points.length || didFitRef.current) return;
    const bounds = points.map((p) => [p.lat, p.lng]);
    if (bounds.length === 1) {
      map.flyTo(bounds[0], 13, { duration: 0.8 });
    } else {
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 12, duration: 0.8 });
    }
    didFitRef.current = true;
  }, [points, map]);
  return null;
};

const MapHeader = ({ search, onSearch, totalRevenue, totalClients, totalProjects, progress }) => (
  <div className="px-5 py-3 bg-gradient-to-b from-white to-emerald-50/40 border-b border-emerald-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-widest text-emerald-700/70 font-semibold">
          Île-de-France
        </span>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight font-garamond">
          Carte des clients
        </h1>
      </div>

      <Kpi label="Clients"  value={totalClients.toLocaleString("fr-FR")} />
      <Kpi label="Projets"  value={totalProjects.toLocaleString("fr-FR")} />
      <Kpi label="Revenu"   value={fmtMoney(totalRevenue)} accent />

      <div className="ml-auto relative">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Nom, ville, CP…"
          className="pl-8 pr-3 py-1.5 border border-emerald-200 rounded-md text-slate-800 w-64 bg-white/80 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7db86e] focus:border-[#7db86e] text-sm"
        />
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
      </div>
    </div>

    {progress.total > 0 && progress.done < progress.total && (
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1 bg-emerald-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2da58d] transition-[width] duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
        <span className="text-[11px] text-slate-500 tabular-nums">
          Géocodage {progress.done} / {progress.total}
        </span>
      </div>
    )}
  </div>
);

const Kpi = ({ label, value, accent = false }) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
    <span className={`text-base font-bold tabular-nums ${accent ? "text-[#2da58d]" : "text-slate-800"}`}>
      {value}
    </span>
  </div>
);

const MapLegend = ({ stats, total, filter, onFilter }) => (
  <div className="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur-sm border border-emerald-100 rounded-xl shadow-lg overflow-hidden text-xs w-64">
    <div className="px-3 py-2 bg-gradient-to-b from-white to-emerald-50/50 border-b border-emerald-100">
      <div className="text-[10px] uppercase tracking-widest text-emerald-700/80 font-semibold">Légende</div>
      <div className="text-slate-500 text-[11px] mt-0.5">Cliquez pour filtrer la carte</div>
    </div>
    <ul className="divide-y divide-emerald-50">
      {STATUS_ORDER.map((s) => {
        const meta = STATUS_META[s];
        const active = filter === s;
        return (
          <li key={s}>
            <button
              onClick={() => onFilter(active ? "all" : s)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
                active ? "bg-emerald-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="relative flex w-3 h-3 items-center justify-center">
                {s === "validated" && (
                  <span
                    className="absolute inline-block w-3 h-3 rounded-full opacity-40 marker-pulse"
                    style={{ backgroundColor: meta.color }}
                  />
                )}
                <span
                  className="relative inline-block w-2.5 h-2.5 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: meta.color }}
                />
              </span>
              <span className="flex-1">
                <span className="font-semibold text-slate-800">{meta.label}</span>
                <span className="block text-[10px] text-slate-500 leading-tight">{meta.desc}</span>
              </span>
              <span className="tabular-nums text-slate-700 font-semibold">{stats[s]}</span>
            </button>
          </li>
        );
      })}
    </ul>
    {filter !== "all" && (
      <button
        onClick={() => onFilter("all")}
        className="w-full px-3 py-1.5 text-[11px] text-emerald-700 hover:bg-emerald-50 border-t border-emerald-100 font-semibold"
      >
        Tout afficher ({total})
      </button>
    )}
  </div>
);

const LoadingOverlay = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-[500] pointer-events-none">
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-md ring-1 ring-emerald-100 text-slate-700 text-sm">
      <span className="w-2 h-2 rounded-full bg-[#2da58d] animate-pulse" />
      Chargement des ventes…
    </div>
  </div>
);

const EmptyOverlay = ({ onReset }) => (
  <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
    <div className="px-4 py-3 rounded-xl bg-white shadow-md ring-1 ring-emerald-100 text-slate-700 text-sm pointer-events-auto text-center">
      <div className="font-semibold text-slate-800">Aucun client à afficher</div>
      <div className="text-[12px] text-slate-500 mt-0.5">Essayez un autre filtre ou une autre recherche.</div>
      <button
        onClick={onReset}
        className="mt-2 px-3 py-1 text-[12px] rounded-full bg-[#2da58d] text-white hover:bg-[#258a76] transition"
      >
        Réinitialiser
      </button>
    </div>
  </div>
);

const ClientMarker = ({ point }) => {
  const map = useMap();
  const status = statusOf(point.sales);
  const color = STATUS_META[status].color;
  const radius = Math.min(14, 7 + Math.log2(point.sales.length + 1) * 2);

  const totalTTC = point.sales.reduce((sum, s) => sum + saleAmount(s), 0);
  const designations = Array.from(new Set(point.sales.map((s) => s["DESIGNATION"]).filter(Boolean)));

  return (
    <>
      <CircleMarker
        center={[point.lat, point.lng]}
        radius={radius + 6}
        interactive={false}
        pathOptions={{
          stroke: false,
          fillColor: color,
          fillOpacity: 0.18,
          className: status === "validated" ? "marker-pulse" : "",
        }}
      />
      <CircleMarker
        center={[point.lat, point.lng]}
        radius={radius}
        eventHandlers={{
          click: () => map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 13), { duration: 0.5 }),
        }}
        pathOptions={{
          color: "#ffffff",
          weight: 2.5,
          fillColor: color,
          fillOpacity: 0.95,
        }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1}>
          <div className="text-[12px] leading-tight">
            <div className="font-bold text-slate-900">{point.name}</div>
            <div className="text-slate-500">
              {point.sales.length} projet{point.sales.length > 1 ? "s" : ""} · {STATUS_META[status].label}
            </div>
          </div>
        </Tooltip>
        <Popup>
          <div className="text-[12px] min-w-[240px]">
            <div className="font-bold text-base text-slate-900 mb-1">{point.name}</div>
            <div className="text-slate-600 mb-2">
              {point.address && <div>{point.address}</div>}
              <div>{point.cp} {point.city}</div>
              {point.phone && <div className="mt-1">📞 {point.phone}</div>}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span
                className="px-2 py-0.5 rounded-full text-white text-[11px] font-semibold"
                style={{ backgroundColor: color }}
              >
                {STATUS_META[status].label}
              </span>
              <span className="text-slate-700 font-medium">
                {point.sales.length} projet{point.sales.length > 1 ? "s" : ""}
              </span>
            </div>
            {totalTTC > 0 && (
              <div className="text-slate-700 mt-1">
                Total : <strong>{fmtMoney(totalTTC)}</strong>
              </div>
            )}
            {designations.length > 0 && (
              <div className="text-slate-500 mt-1 text-[11px]">
                {designations.join(" · ")}
              </div>
            )}
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Composant principal
// ────────────────────────────────────────────────────────────────
const ClientsMap = () => {
  const { points, loading, error, progress } = useGeocodedPoints();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const visiblePoints = useMemo(() => {
    const nq = norm(search);
    return points.filter((p) => {
      if (filter !== "all" && statusOf(p.sales) !== filter) return false;
      if (!nq) return true;
      return (
        norm(p.name).includes(nq) ||
        norm(p.address).includes(nq) ||
        norm(p.city).includes(nq) ||
        norm(p.cp).includes(nq)
      );
    });
  }, [points, filter, search]);

  const stats = useMemo(() => {
    const s = { validated: 0, cancelled: 0, mixed: 0, pending: 0 };
    for (const p of points) s[statusOf(p.sales)]++;
    return s;
  }, [points]);

  const totals = useMemo(() => {
    let revenue = 0, projects = 0;
    for (const p of points) {
      projects += p.sales.length;
      for (const s of p.sales) if (!isCancelled(s)) revenue += saleAmount(s);
    }
    return { revenue, projects, clients: points.length };
  }, [points]);

  const resetFilters = useCallback(() => { setFilter("all"); setSearch(""); }, []);
  const isEmpty = !loading && !error && points.length > 0 && visiblePoints.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-82px)]">
      <MapHeader
        search={search}
        onSearch={setSearch}
        totalRevenue={totals.revenue}
        totalClients={totals.clients}
        totalProjects={totals.projects}
        progress={progress}
      />

      <div className="flex-1 relative">
        {loading && <LoadingOverlay />}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-red-100 border border-red-300 text-red-700 rounded-md px-3 py-1 text-sm shadow-sm">
            Erreur : {error}
          </div>
        )}

        <MapLegend
          stats={stats}
          total={points.length}
          filter={filter}
          onFilter={setFilter}
        />

        {isEmpty && <EmptyOverlay onReset={resetFilters} />}

        <MapContainer
          center={IDF_CENTER}
          zoom={IDF_ZOOM}
          minZoom={IDF_MIN_ZOOM}
          maxZoom={IDF_MAX_ZOOM}
          maxBounds={IDF_BOUNDS}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
          scrollWheelZoom
          zoomControl={false}
          style={{ height: "100%", width: "100%", background: "#eef3f7" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={IDF_MAX_ZOOM}
            bounds={IDF_BOUNDS}
          />
          <ZoomControl position="bottomright" />
          <FitBounds points={visiblePoints} />

          {visiblePoints.map((p) => (
            <ClientMarker key={p.key} point={p} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default ClientsMap;
