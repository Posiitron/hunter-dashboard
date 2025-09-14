"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import ROSLIB from "roslib";
import {
  MapPin,
  Camera,
  Activity,
  Settings,
  Eye,
  Maximize2,
  Minimize2,
  Gauge,
  Battery,
  LocateFixed,
  MapPinOff,
  Globe,
  Satellite,
  Map as MapIcon,
} from "lucide-react";

// This component requires the following packages to be installed:
// npm install maplibre-gl lucide-react roslib
// It also assumes you have Tailwind CSS set up in your project.

// --- utils ---
// FIXED: Added explicit types to the function parameters to resolve the TypeScript error.
function enuToLngLat(x: number, y: number, originLngLat: [number, number]) {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = Math.cos((originLngLat[1] * Math.PI) / 180) * 111_320;
  return [
    originLngLat[0] + x / metersPerDegLng,
    originLngLat[1] + y / metersPerDegLat,
  ];
}
function toHex(n: number | undefined | null) {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return "0x" + (n >>> 0).toString(16).toUpperCase();
}
function cleanTemp(t: number | undefined | null) {
  if (t === undefined || t === null || !isFinite(t)) return null;
  if (t <= -20 || t === 0 || t > 150) return null;
  return t;
}
function httpBaseFromWs(wsUrl: string) {
  try {
    const u = new URL(wsUrl);
    return `${u.protocol === "wss:" ? "https" : "http"}://${u.hostname}:8080`;
  } catch {
    return "http://localhost:8080";
  }
}
const fmt = (n: number | undefined | null, d = 1) =>
  n === undefined || n === null || !isFinite(n) ? "—" : Number(n).toFixed(d);
const fmtInt = (n: number | undefined | null) =>
  n === undefined || n === null || !isFinite(n) ? "—" : Math.round(n);

// --- UI primitives ---
const Badge = ({ children, color = "bg-gray-200" }: { children: React.ReactNode, color?: string }) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-black ${color} shadow-sm`}
  >
    {children}
  </span>
);
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div
    className={`bg-gradient-to-br from-black/95 to-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-lg shadow-2xl shadow-black/20 ${className}`}
  >
    {children}
  </div>
);
const Field = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-400">{label}</label>
    {children}
  </div>
);
const TextInput = ({ value, onChange, placeholder, disabled }: { value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, disabled?: boolean }) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className="w-full px-3 py-2 bg-gradient-to-r from-black to-gray-900 border border-gray-800/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/50 focus:border-white/50 transition-all duration-200 backdrop-blur-sm"
  />
);
// FIXED: Removed the unused 'Checkbox' component that was causing a linting warning.
const Button = ({
  children,
  onClick,
  variant = "default",
  size = "default",
  className = "",
  title
}: { children: React.ReactNode, onClick: () => void, variant?: 'default' | 'primary' | 'ghost', size?: 'default' | 'sm', className?: string, title?: string }) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-white/50 backdrop-blur-sm";
  const variants = {
    default:
      "bg-gradient-to-r from-black to-gray-900 border border-gray-800/50 text-white hover:from-gray-900 hover:to-gray-800 shadow-sm",
    primary:
      "bg-gradient-to-r from-white to-gray-100 text-black hover:from-gray-100 hover:to-gray-200 shadow-md",
    ghost:
      "text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-gray-900/50 hover:to-gray-800/50",
  };
  const sizes = {
    default: "px-4 py-2 text-sm rounded-md",
    sm: "px-3 py-1.5 text-xs rounded",
  };
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      title={title}
    >
      {children}
    </button>
  );
};

// --- Complex Components ---
const CameraFeed = ({ src, alt, placeholder }: { src: string, alt: string, placeholder: string }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const imageElement = imgRef.current;

    const handleLoad = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
    };

    setIsLoading(true);
    setHasError(false);

    imageElement.addEventListener("load", handleLoad);
    imageElement.addEventListener("error", handleError);

    if (src) {
      imageElement.src = src;
    } else {
      handleError();
    }

    return () => {
      imageElement.removeEventListener("load", handleLoad);
      imageElement.removeEventListener("error", handleError);
    };
  }, [src]);

  return (
    <div className="w-full h-full relative bg-gradient-to-r from-black via-gray-900 to-black">
      {(hasError || !src) && (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
          <Camera size={48} className="mb-4 opacity-60" />
          <div className="text-sm font-medium mb-2">{placeholder}</div>
          <div className="text-xs opacity-80">No video stream available</div>
        </div>
      )}
      {/* 
        NOTE: The build log warned about using <img> instead of Next.js's <Image>.
        For streaming content like this, <img> is often necessary and acceptable.
        This warning can be ignored or disabled in your ESLint config if desired.
      */}
      <img
        ref={imgRef}
        alt={alt}
        className={`w-full h-full object-contain ${isLoading || hasError ? "hidden" : "visible"}`}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-black via-gray-900 to-black">
          <div className="text-gray-300 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
};

const MockMap = () => (
  <div className="w-full h-full bg-gray-900 relative overflow-hidden">
    <div className="absolute inset-0 opacity-10">
      <div className="grid grid-cols-8 grid-rows-6 w-full h-full">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className="border border-gray-600"></div>
        ))}
      </div>
    </div>
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <div className="w-4 h-4 bg-blue-400 rounded-full border-2 border-white shadow-lg"></div>
      <div className="w-8 h-0.5 bg-blue-400 absolute top-1/2 left-4 transform -translate-y-1/2"></div>
    </div>
    <div className="absolute inset-0 flex items-center justify-center text-center text-gray-500 font-medium p-4">
      Map failed to load.
    </div>
  </div>
);

const AttributionControl = ({ text }: { text: string }) => {
  if (!text) return null;
  return (
    <div className="absolute top-2 right-2 z-20 max-w-xs text-right">
      <div
        className="inline-block bg-black/50 text-white/80 text-[10px] px-2 py-1 rounded-sm backdrop-blur-sm shadow"
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </div>
  );
};

const MapArea = forwardRef(
  (
    {
      center,
      robotPosition,
      isFollowing,
      onUserInteraction,
      styleUrl,
      onAttributionChange,
      path,
    }: {
        center: [number, number],
        robotPosition: [number, number],
        isFollowing: boolean,
        onUserInteraction: () => void,
        styleUrl: any, // Can be string or object
        onAttributionChange: (text: string) => void,
        path: [number, number][],
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapState = useRef<{ map: any | null, marker: any | null }>({ map: null, marker: null });
    const [mapFailed, setMapFailed] = useState(false);

    useImperativeHandle(ref, () => ({
      recenter() {
        if (mapState.current.map) {
          mapState.current.map.panTo(robotPosition, { duration: 500 });
        }
      },
    }));

    useEffect(() => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
      document.head.appendChild(link);
      return () => {
        try {
          document.head.removeChild(link);
        } catch { /* Ignore error on fast unmounts */ }
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const maplibregl = (await import("maplibre-gl")).default;
          if (cancelled || !containerRef.current) return;
          const map = new maplibregl.Map({
            container: containerRef.current,
            style: styleUrl,
            center,
            zoom: 16,
            attributionControl: false,
          });
          mapState.current.map = map;
          map.on("dragstart", onUserInteraction);

          map.on("load", () => {
            if (cancelled) return;
            const el = document.createElement("div");
            el.className = "w-3 h-3 bg-blue-400 rounded-full border-2 border-white shadow";
            mapState.current.marker = new maplibregl.Marker({ element: el })
              .setLngLat(robotPosition)
              .addTo(map);

            const startSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#22c55e"></circle><polygon points="10,8 16,12 10,16 10,8" fill="white" stroke="none"></polygon></svg>`;
            const startImg = new Image(28, 28);
            startImg.src = "data:image/svg+xml;base64," + btoa(startSvg);
            startImg.onload = () => map.hasImage("start-icon") || map.addImage("start-icon", startImg, { sdf: false });

            const endSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#ef4444"></circle><path d="m9 12 2 2 4-4" stroke-width="2.5"></path></svg>`;
            const endImg = new Image(28, 28);
            endImg.src = "data:image/svg+xml;base64," + btoa(endSvg);
            endImg.onload = () => map.hasImage("end-icon") || map.addImage("end-icon", endImg, { sdf: false });
          });

          map.on("error", () => !cancelled && setMapFailed(true));
        } catch {
          // FIXED: The 'e' was unused, causing a warning. Removed it.
          if (!cancelled) setMapFailed(true);
        }
      })();
      return () => {
        cancelled = true;
        mapState.current.map?.remove();
        mapState.current = { map: null, marker: null };
      };
      // NOTE: This hook intentionally runs only once on mount to initialize the map.
      // The linter warning about missing dependencies is disabled for this line to prevent re-initializing the map on every state change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const map = mapState.current.map;
      if (!map) return;
      map.setStyle(styleUrl);
      const updateAttribution = () => {
        if (!map.isStyleLoaded()) return;
        const sources = map.getStyle().sources;
        const attributions = Object.values(sources).map((s: any) => s.attribution).filter(Boolean);
        onAttributionChange([...new Set(attributions)].join(" | "));
      };
      map.on("styledata", updateAttribution);
      return () => map.off("styledata", updateAttribution);
    }, [styleUrl, onAttributionChange]);

    useEffect(() => {
      if (mapState.current.map && mapState.current.marker) {
        mapState.current.marker.setLngLat(robotPosition);
        if (isFollowing) {
          mapState.current.map.panTo(robotPosition, { duration: 500, essential: true });
        }
      }
    }, [robotPosition, isFollowing]);

    useEffect(() => {
      const map = mapState.current.map;
      if (!map || !map.isStyleLoaded()) return;

      const layerIds = ['path-casing', 'path-line', 'start-point', 'end-point'];
      const sourceIds = ['path-source', 'start-point-source', 'end-point-source'];

      const cleanupOldPath = () => {
        layerIds.forEach(id => {
          if (map.getLayer(id)) map.removeLayer(id);
        });
        sourceIds.forEach(id => {
          if (map.getSource(id)) map.removeSource(id);
        });
      };

      cleanupOldPath();

      if (!path || path.length < 1) {
        return;
      }

      const startPoint = path[0];
      const endPoint = path[path.length - 1];
      const pathLineData: any = { type: 'Feature', geometry: { type: 'LineString', coordinates: path } };
      const startPointData: any = { type: 'Feature', geometry: { type: 'Point', coordinates: startPoint } };
      const endPointData: any = { type: 'Feature', geometry: { type: 'Point', coordinates: endPoint } };

      map.addSource('path-source', { type: 'geojson', data: pathLineData });
      map.addSource('start-point-source', { type: 'geojson', data: startPointData });
      map.addSource('end-point-source', { type: 'geojson', data: endPointData });

      if (path.length > 1) {
        map.addLayer({
          id: 'path-casing',
          type: 'line',
          source: 'path-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#a13c00', 'line-width': 8, 'line-opacity': 0.4 }
        });
        map.addLayer({
          id: 'path-line',
          type: 'line',
          source: 'path-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#ff7c05', 'line-width': 4 }
        });
      }

      map.addLayer({
        id: 'start-point',
        type: 'symbol',
        source: 'start-point-source',
        layout: { 'icon-image': 'start-icon', 'icon-size': 1, 'icon-allow-overlap': true }
      });

      if (path.length > 1) {
        map.addLayer({
          id: 'end-point',
          type: 'symbol',
          source: 'end-point-source',
          layout: { 'icon-image': 'end-icon', 'icon-size': 1, 'icon-allow-overlap': true }
        });
      }
    }, [path]);

    if (mapFailed) return <MockMap />;
    return <div ref={containerRef} className="w-full h-full" />;
  }
);
MapArea.displayName = "MapArea";
const mapStyles = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  street: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  satellite: {
    version: 8,
    sources: {
      "maxar-imagery": {
        type: "raster",
        tiles: [ "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" ],
        tileSize: 256,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxzoom: 19,
      },
    },
    layers: [{ id: "satellite", type: "raster", source: "maxar-imagery" }],
  },
};

// Define a type for the status message for better type safety
type HunterStatus = {
    linear_velocity: number;
    steering_angle: number;
    battery_voltage: number;
    control_mode: number;
    vehicle_state: number;
    error_code: number;
    actuator_states: {
        motor_id: number;
        current: number;
        pulse_count: number;
        rpm: number;
        driver_voltage: number;
        driver_temperature: number;
        motor_temperature: number;
        driver_state: number;
    }[];
};

export default function HunterDashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rosConnected, setRosConnected] = useState(false);
  const [mode, setMode] = useState("mock");
  const [selectedCamera, setSelectedCamera] = useState("both");
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);

  const [isFollowingRobot, setIsFollowingRobot] = useState(true);
  const [mapStyleKey, setMapStyleKey] = useState("dark");
  const [attributionText, setAttributionText] = useState("");
  const [pathPoints, setPathPoints] = useState<[number, number][]>([]);
  const mapRef = useRef<{ recenter: () => void }>(null);

  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* Ignore errors */ }
  };

  const [cfg, setCfg] = useState({
    rosbridgeUrl: "ws://10.10.3.103:9090",
    frontCameraUrl: "http://192.168.50.10:8080/stream?topic=/camera/camera1/color/image_raw",
    rearCameraUrl: "http://192.168.50.10:8080/stream?topic=/camera/camera2/color/image_raw",
    pathTopic: "/gps/waypoints",
  });
  useEffect(() => {
    const base = httpBaseFromWs(cfg.rosbridgeUrl);
    setCfg((prev) => {
      const d1 = "http://192.168.50.10:8080/stream?topic=/camera/camera1/color/image_raw";
      const d2 = "http://192.168.50.10:8080/stream?topic=/camera/camera2/color/image_raw";
      const next = { ...prev };
      if (prev.frontCameraUrl === d1)
        next.frontCameraUrl = `${base}/stream?topic=/camera/camera1/color/image_raw`;
      if (prev.rearCameraUrl === d2)
        next.rearCameraUrl = `${base}/stream?topic=/camera/camera2/color/image_raw`;
      return next;
    });
  }, [cfg.rosbridgeUrl]);

  const [status, setStatus] = useState<HunterStatus | null>(null);
  // FIXED: The `setCenter` function was unused, so it has been removed.
  const [center] = useState<[number, number]>([14.4208, 50.088]);
  const [robotPosition, setRobotPosition] = useState<[number, number]>([14.4208, 50.088]);

  // Simulation Data Hook
  useEffect(() => {
    if (mode !== "mock") return;
    let t = 0;
    const interval = setInterval(() => {
      t += 0.04;
      const r = 140;
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r;
      const pt = enuToLngLat(x, y, center);
      setRobotPosition(pt);
      setRosConnected(true);
      setStatus({
        linear_velocity: Math.abs(Math.sin(t * 0.5)) * 1.6,
        steering_angle: Math.cos(t * 0.6) * 0.3,
        battery_voltage: 25.7 + Math.sin(t * 0.1) * 0.5,
        control_mode: Math.random() > 0.9 ? 2 : 0,
        vehicle_state: Math.random() > 0.8 ? 3 : 2,
        error_code: Math.random() > 0.95 ? 4096 : 0,
        actuator_states: Array.from({ length: 3 }, (_, i) => ({
          motor_id: i,
          current: 0.5 + Math.sin(t * 0.4 + i) * 0.4,
          pulse_count: Math.floor(16777215 * Math.random()),
          rpm: Math.floor(1200 + Math.sin(t * 0.3 + i) * 200),
          driver_voltage: 26.4 + Math.sin(t * 0.2 + i) * 0.8,
          driver_temperature: 39 + Math.sin(t * 0.15 + i) * 6,
          motor_temperature: -27 + Math.sin(t * 0.1 + i) * 13,
          driver_state: [192, 64, 128][i % 3],
        })),
      });
    }, 120);
    return () => clearInterval(interval);
  }, [mode, center]);

  // Live ROS Connection Hook
  useEffect(() => {
    if (mode !== "ros") {
      setRosConnected(false);
      return;
    }

    const ros = new ROSLIB.Ros({ url: cfg.rosbridgeUrl });

    ros.on("connection", () => setRosConnected(true));
    ros.on("error", () => setRosConnected(false));
    ros.on("close", () => setRosConnected(false));

    const statusListener = new ROSLIB.Topic({
      ros,
      name: "/hunter_status",
      messageType: "hunter_msgs/HunterStatus",
    });
    statusListener.subscribe((message) => setStatus(message as HunterStatus));

    const gpsListener = new ROSLIB.Topic({
      ros,
      name: "/gnss/septentrio/raw/fix",
      messageType: "sensor_msgs/NavSatFix",
    });
    gpsListener.subscribe((message: any) => {
      if (message.latitude != null && message.longitude != null) {
        setRobotPosition([message.longitude, message.latitude]);
      }
    });

    const pathListener = new ROSLIB.Topic({
      ros,
      name: cfg.pathTopic,
      messageType: "artemis_msgs/msg/NavSatFixList",
    });
    pathListener.subscribe((message: any) => {
      if (message && Array.isArray(message.fixes)) {
        const points: [number, number][] = message.fixes.map((fix: any) => [fix.longitude, fix.latitude]);
        setPathPoints(points);
      }
    });

    return () => {
      statusListener.unsubscribe();
      gpsListener.unsubscribe();
      pathListener.unsubscribe();
      ros.close();
    };
  }, [mode, cfg]);

  const handleRecenter = () => {
    mapRef.current?.recenter();
  };

  const handleUserInteraction = useCallback(() => {
    setIsFollowingRobot(false);
  }, []);

  const handleAttributionChange = useCallback((text: string) => {
    setAttributionText(text);
  }, []);
  // ... Keep the rest of your component's JSX the same
  // ... from the `return (` line onwards.
  // The provided JSX seems fine and doesn't need changes to fix the build errors.
  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-40 h-12 sm:h-16 bg-gradient-to-r from-black via-gray-900 to-black border-b border-gray-800/50 backdrop-blur-xl shadow-lg shadow-black/10">
        <div className="flex items-center justify-between h-full px-2 sm:px-4 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-2 h-2 rounded-full ${rosConnected ? "bg-green-500" : "bg-red-500"
                  }`}
              />
              <span className="text-xs sm:text-sm font-medium text-white truncate">
                {rosConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="h-3 sm:h-4 w-px bg-gray-700" />
            <Badge color="bg-gray-200">
              <span className="text-xs">
                {mode === "mock" ? "Sim" : "Live"}
              </span>
            </Badge>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <div className="hidden md:flex items-center gap-2 md:gap-3 text-sm flex-wrap max-w-[60vw] overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-md min-w-0 max-w-full">
                <MapPin size={14} className="text-blue-400 flex-shrink-0" />
                <span className="font-mono tabular-nums text-white text-sm truncate">
                  {robotPosition
                    ? `${robotPosition[1].toFixed(
                      6
                    )}, ${robotPosition[0].toFixed(6)}`
                    : "—, —"}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-md min-w-0 max-w-full">
                <Gauge size={14} className="text-green-400 flex-shrink-0" />
                <span className="font-mono tabular-nums text-white text-sm truncate">
                  {(status?.linear_velocity ?? 0).toFixed(1)} m/s
                </span>
              </div>
              <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-md min-w-0 max-w-full">
                <Battery size={14} className="text-yellow-400 flex-shrink-0" />
                <span className="font-mono tabular-nums text-white text-sm truncate">
                  {status?.battery_voltage
                    ? `${status.battery_voltage.toFixed(1)}V`
                    : "—V"}
                </span>
              </div>
            </div>
            <Button
              onClick={toggleFullscreen}
              variant="ghost"
              size="sm"
              title={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFs ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>
            <Button
              onClick={() => setSettingsOpen(true)}
              variant="ghost"
              size="sm"
              title="Settings"
            >
              <Settings size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="absolute left-0 right-0 bottom-0 top-12 sm:top-16">
        <MapArea
          ref={mapRef}
          center={center}
          robotPosition={robotPosition}
          isFollowing={isFollowingRobot}
          onUserInteraction={handleUserInteraction}
          styleUrl={mapStyles[mapStyleKey as keyof typeof mapStyles]}
          onAttributionChange={handleAttributionChange}
          path={pathPoints}
        />

        <AttributionControl text={attributionText} />
        
        {/* Map Controls */}
        <Card className="absolute top-2 left-2 z-20 flex items-center gap-1 p-1">
          <Button
            onClick={() => setIsFollowingRobot(!isFollowingRobot)}
            variant={isFollowingRobot ? "primary" : "default"}
            size="sm"
            className="w-24"
            title={
              isFollowingRobot ? "Disable follow mode" : "Enable follow mode"
            }
          >
            {isFollowingRobot ? (
              <>
                <MapPin size={14} className="mr-2" /> Following
              </>
            ) : (
              <>
                <MapPinOff size={14} className="mr-2" /> Follow
              </>
            )}
          </Button>
          <Button
            onClick={handleRecenter}
            variant="default"
            size="sm"
            title="Recenter map on robot"
          >
            <LocateFixed size={14} />
          </Button>
          <div className="flex rounded-md border border-gray-800 overflow-hidden ml-2">
            <button
              onClick={() => setMapStyleKey("dark")}
              title="Dark Mode"
              className={`px-2 py-1.5 transition-colors ${mapStyleKey === "dark"
                ? "bg-white text-black"
                : "bg-black text-gray-400 hover:text-white"
                }`}
            >
              <Globe size={14} />
            </button>
            <button
              onClick={() => setMapStyleKey("street")}
              title="Street View"
              className={`px-2 py-1.5 transition-colors ${mapStyleKey === "street"
                ? "bg-white text-black"
                : "bg-black text-gray-400 hover:text-white"
                }`}
            >
              <MapIcon size={14} />
            </button>
            <button
              onClick={() => setMapStyleKey("satellite")}
              title="Satellite View"
              className={`px-2 py-1.5 transition-colors ${mapStyleKey === "satellite"
                ? "bg-white text-black"
                : "bg-black text-gray-400 hover:text-white"
                }`}
            >
              <Satellite size={14} />
            </button>
          </div>
        </Card>

        {/* Camera Card */}
        <Card
          className={`absolute overflow-hidden transition-all duration-300 ${cameraExpanded
            ? "top-4 left-4 right-4 bottom-4 z-30"
            : "bottom-2 right-2 w-[320px] sm:w-[360px] lg:w-[400px] h-[200px] sm:h-[220px] lg:h-[240px]"
            }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-white">Camera</span>
              {selectedCamera !== "both" && (
                <Badge color="bg-gray-200">
                  {selectedCamera === "front" ? "Front" : "Rear"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex rounded-md border border-gray-800 overflow-hidden">
                <button
                  onClick={() => setSelectedCamera("front")}
                  className={`px-2 py-1 text-xs transition-colors ${selectedCamera === "front"
                    ? "bg-white text-black"
                    : "bg-black text-gray-400 hover:text-white"
                    }`}
                >
                  Front
                </button>
                <button
                  onClick={() => setSelectedCamera("rear")}
                  className={`px-2 py-1 text-xs transition-colors ${selectedCamera === "rear"
                    ? "bg-white text-black"
                    : "bg-black text-gray-400 hover:text-white"
                    }`}
                >
                  Rear
                </button>
                <button
                  onClick={() => setSelectedCamera("both")}
                  className={`px-2 py-1 text-xs transition-colors ${selectedCamera === "both"
                    ? "bg-white text-black"
                    : "bg-black text-gray-400 hover:text-white"
                    }`}
                >
                  Both
                </button>
              </div>
              <Button
                onClick={() => setCameraExpanded(!cameraExpanded)}
                variant="ghost"
                size="sm"
              >
                {cameraExpanded ? (
                  <Minimize2 size={12} />
                ) : (
                  <Maximize2 size={12} />
                )}
              </Button>
            </div>
          </div>
          <div className="relative flex h-[calc(100%-40px)] bg-gradient-to-r from-black via-gray-900 to-black">
            <div
              className={`relative h-full transition-all duration-300 ${selectedCamera === "both"
                ? "w-1/2 border-r border-gray-800"
                : selectedCamera === "front"
                  ? "w-full"
                  : "w-0 overflow-hidden"
                }`}
            >
              <div className="absolute top-2 left-2 z-10">
                <Badge color="bg-gray-200">Front</Badge>
              </div>
              <CameraFeed
                src={cfg.frontCameraUrl}
                alt="front camera"
                placeholder="Front Camera Unavailable"
              />
            </div>
            <div
              className={`relative h-full transition-all duration-300 ${selectedCamera === "both"
                ? "w-1/2"
                : selectedCamera === "rear"
                  ? "w-full"
                  : "w-0 overflow-hidden"
                }`}
            >
              <div className="absolute top-2 left-2 z-10">
                <Badge color="bg-gray-200">Rear</Badge>
              </div>
              <CameraFeed
                src={cfg.rearCameraUrl}
                alt="rear camera"
                placeholder="Rear Camera Unavailable"
              />
            </div>
          </div>
        </Card>

        {/* Status Card */}
        <Card
          className={`absolute transition-all duration-300 ${statusExpanded
            ? "top-4 left-4 right-4 bottom-4 z-30 p-4"
            : "bottom-2 left-2 w-[320px] sm:w-[360px] lg:w-[400px] h-[200px] sm:h-[220px] lg:h-[240px] p-3"
            } overflow-hidden`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-white" />
              <span className="text-sm font-medium text-white">
                System Status
              </span>
            </div>
            <Button
              onClick={() => setStatusExpanded(!statusExpanded)}
              variant="ghost"
              size="sm"
            >
              {statusExpanded ? (
                <Minimize2 size={12} />
              ) : (
                <Maximize2 size={12} />
              )}
            </Button>
          </div>
          <div
            className={`grid ${statusExpanded
              ? "grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-3"
              : "grid-cols-3 gap-3"
              } mb-3 text-sm`}
          >
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">Control</div>
              <div className="font-mono text-white tabular-nums text-base truncate">
                {String(status?.control_mode ?? "—")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">Vehicle</div>
              <div className="font-mono text-white tabular-nums text-base truncate">
                {String(status?.vehicle_state ?? "—")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs mb-1">Error</div>
              <div className="font-mono text-white tabular-nums text-base truncate">
                {status?.error_code != null
                  ? `${status.error_code} (${toHex(status.error_code)})`
                  : "—"}
              </div>
            </div>
            {statusExpanded && (
              <>
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-1">Speed</div>
                  <div className="font-mono text-white tabular-nums text-base truncate">
                    {fmt(status?.linear_velocity, 1)} m/s
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-1">Steer</div>
                  <div className="font-mono text-white tabular-nums text-base truncate">
                    {fmt(status?.steering_angle, 2)} rad
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400 text-xs mb-1">Battery</div>
                  <div className="font-mono text-white tabular-nums text-base truncate">
                    {fmt(status?.battery_voltage, 1)} V
                  </div>
                </div>
              </>
            )}
          </div>
          {statusExpanded ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-96px)]">
              <div className="bg-gray-900/40 border border-gray-800 rounded-md p-3 overflow-auto">
                <div className="text-xs text-gray-400 mb-2">Key Metrics</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-400">Linear vel</div>
                  <div className="font-mono tabular-nums">
                    {fmt(status?.linear_velocity, 2)} m/s
                  </div>
                  <div className="text-gray-400">Steering</div>
                  <div className="font-mono tabular-nums">
                    {fmt(status?.steering_angle, 3)} rad
                  </div>
                  <div className="text-gray-400">Battery</div>
                  <div className="font-mono tabular-nums">
                    {fmt(status?.battery_voltage, 2)} V
                  </div>
                  <div className="text-gray-400">Control</div>
                  <div className="font-mono tabular-nums">
                    {String(status?.control_mode ?? "—")}
                  </div>
                  <div className="text-gray-400">Vehicle</div>
                  <div className="font-mono tabular-nums">
                    {String(status?.vehicle_state ?? "—")}
                  </div>
                  <div className="text-gray-400">Error</div>
                  <div className="font-mono tabular-nums">
                    {status?.error_code != null
                      ? `${status.error_code} (${toHex(status.error_code)})`
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 bg-gray-900/40 border border-gray-800 rounded-md p-3 overflow-auto">
                <div className="text-xs text-gray-400 mb-2">
                  Actuator States
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Array.isArray(status?.actuator_states) &&
                    status.actuator_states.map((a, i) => (
                      <div
                        key={i}
                        className="p-2 rounded border border-gray-800 bg-gray-900/60 min-w-0"
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          Actuator {a.motor_id}
                        </div>
                        <div className="text-xs space-y-0.5">
                          <div className="text-white tabular-nums truncate">
                            {fmtInt(a.rpm)} RPM
                          </div>
                          <div className="text-white tabular-nums truncate">
                            {fmt(cleanTemp(a.motor_temperature), 1)}°C
                          </div>
                          <div className="text-white tabular-nums truncate">
                            {fmt(a.driver_voltage, 1)}V
                          </div>
                          <div className="text-white tabular-nums truncate">
                            state {toHex(a.driver_state)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="pointer-events-none select-none" />
          )}
        </Card>
      </div>

      {/* Settings Panel */}
      {settingsOpen && (
        <div className="absolute inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-full sm:w-[400px] max-w-[90vw] bg-black border-l border-gray-800 backdrop-blur-xl">
            <div className="p-4 h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-white" />
                  <span className="text-lg font-medium text-white">
                    Settings
                  </span>
                </div>
                <Button
                  onClick={() => setSettingsOpen(false)}
                  variant="ghost"
                  size="sm"
                >
                  ×
                </Button>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    Operation Mode
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setMode("mock")}
                      variant={mode === "mock" ? "primary" : "default"}
                      size="sm"
                      className="flex-1"
                    >
                      Simulation
                    </Button>
                    <Button
                      onClick={() => setMode("ros")}
                      variant={mode === "ros" ? "primary" : "default"}
                      size="sm"
                      className="flex-1"
                    >
                      Live ROS
                    </Button>
                  </div>
                </div>
                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    ROS Configuration
                  </h3>
                  <div className="space-y-4">
                    <Field label="ROSBridge WebSocket URL">
                      <TextInput
                        value={cfg.rosbridgeUrl}
                        onChange={(e) =>
                          setCfg({ ...cfg, rosbridgeUrl: e.target.value })
                        }
                        placeholder="ws://HOST:9090"
                      />
                    </Field>

                    <Field label="Path Planning Topic">
                      <TextInput
                        value={cfg.pathTopic}
                        onChange={(e) =>
                          setCfg({ ...cfg, pathTopic: e.target.value })
                        }
                        placeholder="/plan"
                      />
                    </Field>
                  </div>
                </div>
                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    Camera Configuration
                  </h3>
                  <div className="space-y-4">
                    <Field label="Front Camera Stream URL">
                      <TextInput
                        value={cfg.frontCameraUrl}
                        onChange={(e) =>
                          setCfg({ ...cfg, frontCameraUrl: e.target.value })
                        }
                        placeholder="http://HOST:8080/stream?topic=/camera/camera1/color/image_raw"
                      />
                    </Field>
                    <Field label="Rear Camera Stream URL">
                      <TextInput
                        value={cfg.rearCameraUrl}
                        onChange={(e) =>
                          setCfg({ ...cfg, rearCameraUrl: e.target.value })
                        }
                        placeholder="http://HOST:8080/stream?topic=/camera/camera2/color/image_raw"
                      />
                    </Field>
                  </div>
                </div>
                <div className="border-t border-gray-800 pt-6">
                  <div className="p-3 rounded-md bg-gray-900 border border-gray-800">
                    <div className="flex items-start gap-2">
                      <Eye size={14} className="text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-white mb-1">
                          Read-Only Dashboard
                        </div>
                        <div className="text-xs text-gray-400">
                          This interface subscribes to ROS topics for monitoring
                          only. No control commands are sent to the robot.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}