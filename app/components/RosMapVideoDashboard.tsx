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
function enuToLngLat(x, y, originLngLat) {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = Math.cos((originLngLat[1] * Math.PI) / 180) * 111_320;
  return [
    originLngLat[0] + x / metersPerDegLng,
    originLngLat[1] + y / metersPerDegLat,
  ];
}
function toHex(n) {
  if (n === undefined || n === null || !isFinite(n)) return "—";
  return "0x" + (n >>> 0).toString(16).toUpperCase();
}
function cleanTemp(t) {
  if (t === undefined || t === null || !isFinite(t)) return null;
  if (t <= -20 || t === 0 || t > 150) return null;
  return t;
}
function httpBaseFromWs(wsUrl) {
  try {
    const u = new URL(wsUrl);
    return `${u.protocol === "wss:" ? "https" : "http"}://${u.hostname}:8080`;
  } catch {
    return "http://localhost:8080";
  }
}
const fmt = (n, d = 1) =>
  n === undefined || n === null || !isFinite(n) ? "—" : Number(n).toFixed(d);
const fmtInt = (n) =>
  n === undefined || n === null || !isFinite(n) ? "—" : Math.round(n);

// --- UI primitives ---
const Badge = ({ children, color = "bg-gray-200" }) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-black ${color} shadow-sm`}
  >
    {children}
  </span>
);
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-gradient-to-br from-black/95 to-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-lg shadow-2xl shadow-black/20 ${className}`}
  >
    {children}
  </div>
);
const Field = ({ label, children }) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-400">{label}</label>
    {children}
  </div>
);
const TextInput = ({ value, onChange, placeholder, disabled }) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className="w-full px-3 py-2 bg-gradient-to-r from-black to-gray-900 border border-gray-800/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/50 focus:border-white/50 transition-all duration-200 backdrop-blur-sm"
  />
);
const Checkbox = ({ checked, onChange }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    className="w-4 h-4 bg-black border border-gray-800 rounded text-white focus:ring-white/50 focus:ring-1"
  />
);
const Button = ({
  children,
  onClick,
  variant = "default",
  size = "default",
  className = "",
}) => {
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
    >
      {children}
    </button>
  );
};

// --- Complex Components ---
const CameraFeed = ({ src, alt, placeholder }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);
  return (
    <div className="w-full h-full relative bg-gradient-to-r from-black via-gray-900 to-black">
      {!hasError && src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
          <Camera size={48} className="mb-4 opacity-60" />
          <div className="text-sm font-medium mb-2">{placeholder}</div>
          <div className="text-xs opacity-80">No video stream available</div>
        </div>
      )}
      {isLoading && !hasError && (
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

const AttributionControl = ({ text }) => {
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
    },
    ref
  ) => {
    const containerRef = useRef(null);
    const mapState = useRef({ map: null, marker: null });
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
        } catch { }
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
            el.className =
              "w-3 h-3 bg-blue-400 rounded-full border-2 border-white shadow";
            mapState.current.marker = new maplibregl.Marker({ element: el })
              .setLngLat(robotPosition)
              .addTo(map);
          });
          map.on("error", () => {
            if (!cancelled) setMapFailed(true);
          });
        } catch (e) {
          if (!cancelled) setMapFailed(true);
        }
      })();
      return () => {
        cancelled = true;
        mapState.current.map?.remove();
        mapState.current = { map: null, marker: null };
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const map = mapState.current.map;
      if (!map) return;
      map.setStyle(styleUrl);
      const updateAttribution = () => {
        if (!map.isStyleLoaded()) return;
        const sources = map.getStyle().sources;
        const attributions = Object.values(sources)
          .map((s) => s.attribution)
          .filter(Boolean);
        onAttributionChange([...new Set(attributions)].join(" | "));
      };
      map.on("styledata", updateAttribution);
      return () => map.off("styledata", updateAttribution);
    }, [styleUrl, onAttributionChange]);

    useEffect(() => {
      if (mapState.current.map && mapState.current.marker) {
        mapState.current.marker.setLngLat(robotPosition);
        if (isFollowing) {
          mapState.current.map.panTo(robotPosition, {
            duration: 500,
            essential: true,
          });
        }
      }
    }, [robotPosition, isFollowing]);

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
        tiles: [
          "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxzoom: 19,
      },
    },
    layers: [{ id: "satellite", type: "raster", source: "maxar-imagery" }],
  },
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
  const mapRef = useRef(null);

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
    } catch { }
  };

  const [cfg, setCfg] = useState({
    rosbridgeUrl: "ws://192.168.50.10:9090",
    frontCameraUrl:
      "http://192.168.50.10:8080/stream?topic=/camera/camera1/color/image_raw",
    rearCameraUrl:
      "http://192.168.50.10:8080/stream?topic=/camera/camera2/color/image_raw",
    odomTopic: "/odom",
    pathTopic: "/plan",
    gpsTopic: "/fix",
    useGps: false,
  });
  useEffect(() => {
    const base = httpBaseFromWs(cfg.rosbridgeUrl);
    setCfg((prev) => {
      const d1 =
        "http://192.168.50.10:8080/stream?topic=/camera/camera1/color/image_raw";
      const d2 =
        "http://192.168.50.10:8080/stream?topic=/camera/camera2/color/image_raw";
      const next = { ...prev };
      if (prev.frontCameraUrl === d1)
        next.frontCameraUrl = `${base}/stream?topic=/camera/camera1/color/image_raw`;
      if (prev.rearCameraUrl === d2)
        next.rearCameraUrl = `${base}/stream?topic=/camera/camera2/color/image_raw`;
      return next;
    });
  }, [cfg.rosbridgeUrl]);

  const [status, setStatus] = useState(null);
  const [center, setCenter] = useState([14.4208, 50.088]);
  const [robotPosition, setRobotPosition] = useState([14.4208, 50.088]);

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

  // --- Live ROS Connection Hook ---
  useEffect(() => {
    if (mode !== "ros") {
      setRosConnected(false);
      return;
    }

    const ros = new ROSLIB.Ros({ url: cfg.rosbridgeUrl });

    ros.on("connection", () => {
      console.log("Connected to websocket server.");
      setRosConnected(true);
    });

    ros.on("error", (error) => {
      console.error("Error connecting to websocket server: ", error);
      setRosConnected(false);
    });

    ros.on("close", () => {
      console.log("Connection to websocket server closed.");
      setRosConnected(false);
    });

    const statusListener = new ROSLIB.Topic({
      ros: ros,
      name: "/hunter_status",
      messageType: "hunter_msgs/HunterStatus",
    });

    statusListener.subscribe((message) => {
      setStatus(message);
    });

    const odomListener = new ROSLIB.Topic({
      ros: ros,
      name: cfg.useGps ? cfg.gpsTopic : cfg.odomTopic,
      messageType: "nav_msgs/Odometry", // Assuming odom for simplicity, GPS would need a different message type and logic
    });

    odomListener.subscribe((message) => {
      const { x, y } = message.pose.pose.position;
      const pt = enuToLngLat(x, y, center);
      setRobotPosition(pt);
    });

    return () => {
      statusListener.unsubscribe();
      odomListener.unsubscribe();
      ros.close();
    };
  }, [mode, cfg, center]);

  const handleRecenter = () => {
    setIsFollowingRobot(true);
    mapRef.current?.recenter();
  };

  const handleUserInteraction = useCallback(() => {
    setIsFollowingRobot(false);
  }, []);

  const handleAttributionChange = useCallback((text) => {
    setAttributionText(text);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-white">
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

      <div className="absolute left-0 right-0 bottom-0 top-12 sm:top-16">
        <MapArea
          ref={mapRef}
          center={center}
          robotPosition={robotPosition}
          isFollowing={isFollowingRobot}
          onUserInteraction={handleUserInteraction}
          styleUrl={mapStyles[mapStyleKey]}
          onAttributionChange={handleAttributionChange}
        />

        <AttributionControl text={attributionText} />

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
            {/* Front Camera Feed */}
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

            {/* Rear Camera Feed */}
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
                {" "}
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
                </div>{" "}
              </>
            )}
          </div>
          {statusExpanded ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-96px)]">
              {" "}
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
              </div>{" "}
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
              </div>{" "}
            </div>
          ) : (
            <div className="pointer-events-none select-none" />
          )}
        </Card>
      </div>

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
                    <Field label="Position Source">
                      <div className="flex items-center gap-3 mb-2">
                        <Checkbox
                          checked={cfg.useGps}
                          onChange={(v) => setCfg({ ...cfg, useGps: v })}
                        />
                        <span className="text-sm text-gray-400">
                          Use GPS (NavSatFix)
                        </span>
                      </div>
                      <TextInput
                        value={cfg.useGps ? cfg.gpsTopic : cfg.odomTopic}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            [cfg.useGps ? "gpsTopic" : "odomTopic"]:
                              e.target.value,
                          })
                        }
                        placeholder={cfg.useGps ? "/fix" : "/odom"}
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
