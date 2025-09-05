'use client'

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Settings, Wifi, Camera, Activity, Navigation } from "lucide-react";

// --- utils ---
function enuToLngLat(x, y, originLngLat){
  const metersPerDegLat = 111_320;
  const metersPerDegLng = Math.cos(originLngLat[1] * Math.PI/180) * 111_320;
  return [originLngLat[0] + (x / metersPerDegLng), originLngLat[1] + (y / metersPerDegLat)];
}
function yawFromQuat(q){
  if(!q) return 0;
  const {x=0,y=0,z=0,w=1} = q;
  return Math.atan2(2*(w*z + x*y), 1 - 2*(y*y + z*z));
}

// Tiny UI primitives (dark, compact)
const Badge = ({color="bg-emerald-500", children}) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md ${color} text-white`}>{children}</span>
);
const Field = ({label, children}) => (
  <label className="block text-xs text-gray-400 mb-1">{label}<div className="mt-1">{children}</div></label>
);
const TextInput = (props) => (
  <input className="w-full px-3 py-2 text-sm rounded-lg bg-gray-900/70 border border-gray-700/70 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40" {...props} />
);
const Checkbox = ({checked, onChange}) => (
  <input type="checkbox" className="accent-blue-500 w-4 h-4" checked={checked} onChange={e=>onChange(e.target.checked)} />
);

export default function HunterDashboard(){
  // Layout / UI
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rosConnected, setRosConnected] = useState(false);
  const [mode, setMode] = useState("mock"); // "mock" | "ros"

  // Config (persisted)
  const [cfg, setCfg] = useState(()=>{
    if (typeof window !== 'undefined') {
      try { const s = JSON.parse(localStorage.getItem('hunter_dash_cfg')||'null'); if (s) return s; } catch {}
    }
    return {
      rosbridgeUrl: "ws://localhost:9090",
      mjpegUrl: "http://localhost:8080/stream?topic=/camera/image_raw",
      odomTopic: "/odom",
      pathTopic: "/plan",
      gpsTopic: "/fix",
      useGps: false,
    };
  });
  useEffect(()=>{ try{ localStorage.setItem('hunter_dash_cfg', JSON.stringify(cfg)); }catch{} }, [cfg]);

  // Data
  const [status, setStatus] = useState(null); // hunter_msgs/HunterStatus
  const [center, setCenter] = useState([14.4208, 50.0880]); // Prague
  const [zoom, setZoom] = useState(16);

  // Map
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return;
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: {
        version: 8,
        sources: {
          dark: {
            type: "raster",
            tiles: [
              "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
              "https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap, © CARTO"
          }
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#0b0f14" } },
          { id: "basemap", type: "raster", source: "dark", paint: { "raster-opacity": 0.9 } }
        ]
      },
      center,
      zoom,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      map.addSource('robot', { type:'geojson', data:{ type:'FeatureCollection', features:[] }});
      map.addLayer({ id:'robot-glow', type:'circle', source:'robot', paint:{ 'circle-radius': 14, 'circle-color':'#60a5fa', 'circle-opacity':0.15, 'circle-blur':1 } });
      map.addLayer({ id:'robot', type:'circle', source:'robot', paint:{ 'circle-radius': 6, 'circle-color':'#93c5fd', 'circle-stroke-width':2, 'circle-stroke-color':'#fff' } });

      map.addSource('heading', { type:'geojson', data:{ type:'FeatureCollection', features:[] }});
      map.addLayer({ id:'heading', type:'line', source:'heading', paint:{ 'line-width': 2, 'line-color':'#93c5fd' } });

      map.addSource('trail', { type:'geojson', data:{ type:'FeatureCollection', features:[] }});
      map.addLayer({ id:'trail', type:'line', source:'trail', paint:{ 'line-width': 2, 'line-color':'#34d399', 'line-opacity':0.8 } });

      map.addSource('route', { type:'geojson', data:{ type:'FeatureCollection', features:[] }});
      map.addLayer({ id:'route', type:'line', source:'route', paint:{ 'line-width': 3, 'line-color':'#f87171', 'line-dasharray':[2,2], 'line-opacity':0.9 } });
    });

    map.on('moveend', () => {
      const c = map.getCenter(); setCenter([c.lng, c.lat]); setZoom(map.getZoom());
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  // --- MOCK LOOP (read-only UI preview) ---
  useEffect(() => {
    if (mode !== 'mock') return;
    const map = mapRef.current; if (!map) return;
    let t = 0; const trail = [];
    const h = setInterval(()=>{
      t += 0.04; const r=140; const x=Math.cos(t)*r, y=Math.sin(t)*r; const theta=t+Math.PI/2;
      const pt = enuToLngLat(x,y,center);
      map.getSource('robot')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:pt } }] });
      const ahead = enuToLngLat(x+4*Math.cos(theta), y+4*Math.sin(theta), center);
      map.getSource('heading')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'LineString', coordinates:[pt,ahead] } }] });
      trail.push(pt); if (trail.length>300) trail.shift();
      map.getSource('trail')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'LineString', coordinates:trail } }] });
      const route=[center, enuToLngLat(250,80,center), enuToLngLat(520,-50,center)];
      map.getSource('route')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'LineString', coordinates:route } }] });
      setRosConnected(true);
      setStatus({ linear_velocity: Math.abs(Math.sin(t*0.5))*1.6, steering_angle: (Math.cos(t*0.6)*0.3), battery_voltage: 51 - t*0.01, control_mode: 0, vehicle_state: 0, error_code: 0, actuator_states:[{rpm:1200,motor_temperature:45,driver_temperature:40},{rpm:1195,motor_temperature:44,driver_temperature:39},{rpm:1202,motor_temperature:46,driver_temperature:41}] });
    }, 120);
    return ()=>clearInterval(h);
  }, [mode, center]);

  // --- ROS LIVE (read-only; subscribe only) ---
  useEffect(() => {
    if (mode !== 'ros') { setRosConnected(false); return; }
    let roslib, poseSub, gpsSub, pathSub, statusSub; let closed=false; const map = mapRef.current; if(!map) return;
    (async () => {
      const { default: ROSLIB } = await import('roslib');
      roslib = new ROSLIB.Ros({ url: cfg.rosbridgeUrl });
      roslib.on('connection', ()=> setRosConnected(true));
      roslib.on('close', ()=> setRosConnected(false));
      roslib.on('error', ()=> setRosConnected(false));

      statusSub = new ROSLIB.Topic({ ros: roslib, name: '/hunter_status', messageType: 'hunter_msgs/HunterStatus' });
      statusSub.subscribe(msg => { if(!closed) setStatus(msg); });

      if (cfg.useGps && cfg.gpsTopic){
        gpsSub = new ROSLIB.Topic({ ros: roslib, name: cfg.gpsTopic, messageType: 'sensor_msgs/NavSatFix' });
        gpsSub.subscribe(msg => {
          if (!isFinite(msg.latitude) || !isFinite(msg.longitude)) return;
          const pt=[msg.longitude, msg.latitude];
          map.getSource('robot')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:pt } }] });
        });
      } else if (cfg.odomTopic){
        poseSub = new ROSLIB.Topic({ ros: roslib, name: cfg.odomTopic, messageType: 'nav_msgs/Odometry' });
        const trail=[];
        poseSub.subscribe(msg => {
          const p = msg.pose?.pose; if(!p) return;
          const x=p.position?.x||0, y=p.position?.y||0; const yaw = yawFromQuat(p.orientation);
          const pt=enuToLngLat(x,y,center);
          map.getSource('robot')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:pt } }] });
          const ahead=enuToLngLat(x+4*Math.cos(yaw), y+4*Math.sin(yaw), center);
          map.getSource('heading')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'LineString', coordinates:[pt,ahead] } }] });
          trail.push(pt); if(trail.length>400) trail.shift();
          map.getSource('trail')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'LineString', coordinates:trail } }] });
        });
      }

      if (cfg.pathTopic){
        pathSub = new ROSLIB.Topic({ ros: roslib, name: cfg.pathTopic, messageType: 'nav_msgs/Path' });
        pathSub.subscribe(msg => {
          const coords=(msg.poses||[]).map(p=>{ const v=p.pose?.position||{}; return enuToLngLat(v.x||0, v.y||0, center); });
          map.getSource('route')?.setData({ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'LineString', coordinates:coords } }] });
        });
      }
    })();
    return () => {
      closed=true;
      try{ poseSub?.unsubscribe(); }catch{}
      try{ gpsSub?.unsubscribe(); }catch{}
      try{ pathSub?.unsubscribe(); }catch{}
      try{ statusSub?.unsubscribe(); }catch{}
    };
  }, [mode, cfg, center]);

  // --- UI ---
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0f14] text-gray-200">
      {/* Top bar */}
      <div className="h-12 px-3 md:px-4 border-b border-gray-800 flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${rosConnected? 'bg-emerald-500 animate-pulse':'bg-red-500'}`} />
          <span className="text-sm text-gray-400">{rosConnected? 'ROS connected':'ROS disconnected'}</span>
          <Badge color="bg-blue-600/80">read‑only</Badge>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1"><Activity size={14} className="text-gray-500"/><span>{(status?.linear_velocity??0).toFixed?.(2)} m/s</span></div>
          <div className="flex items-center gap-1"><Navigation size={14} className="text-gray-500"/><span>{(((status?.steering_angle)||0)*180/Math.PI).toFixed(1)}°</span></div>
          <div className="flex items-center gap-1"><span className="text-gray-500">🔋</span><span>{status?.battery_voltage?.toFixed?.(1)??'—'} V</span></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setMode(m=>m==='mock'?'ros':'mock')} className="text-xs px-2 py-1 rounded-md border border-gray-700 bg-gray-900/60 hover:bg-gray-800/60">{mode==='mock'?'Sim':'Live'}</button>
          <button onClick={()=>setSettingsOpen(true)} className="p-2 rounded-md border border-gray-700 bg-gray-900/60 hover:bg-gray-800/60" title="Settings"><Settings size={16}/></button>
        </div>
      </div>

      {/* Main area */}
      <div className="relative h-[calc(100vh-48px)] w-full">
        {/* Map */}
        <div ref={mapDivRef} className="absolute inset-0" />

        {/* Camera PiP */}
        <div className="absolute bottom-3 right-3 w-[28vw] max-w-[460px] min-w-[280px] aspect-video rounded-xl border border-gray-800 overflow-hidden bg-black/60 backdrop-blur">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] bg-black/50 border-b border-gray-800">
            <div className="flex items-center gap-1"><Camera size={12} className="text-gray-400"/><span className="text-gray-400">Camera</span></div>
            <span className="text-gray-500 truncate max-w-[60%]">{cfg.mjpegUrl}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.mjpegUrl} alt="camera" className="w-full h-full object-contain" />
        </div>

        {/* Status strip (bottom-left) */}
        <div className="absolute bottom-3 left-3 p-2 rounded-lg bg-black/50 border border-gray-800 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div><div className="text-gray-400">Ctrl</div><div className="font-medium">{String(status?.control_mode ?? '—')}</div></div>
            <div><div className="text-gray-400">Veh</div><div className="font-medium">{String(status?.vehicle_state ?? '—')}</div></div>
            <div><div className="text-gray-400">Err</div><div className="font-medium">{String(status?.error_code ?? '—')}</div></div>
          </div>
          {Array.isArray(status?.actuator_states) && status.actuator_states.length>0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {status.actuator_states.map((a,i)=> (
                <div key={i} className="px-2 py-1 rounded bg-gray-900/70 border border-gray-800">
                  <div className="text-[10px] text-gray-400">Act {i}</div>
                  <div className="text-[11px]">RPM {a.rpm ?? '—'}</div>
                  <div className="text-[11px]">Tm {a.motor_temperature ?? '—'}°C</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings drawer (outside main screen) */}
      {settingsOpen && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setSettingsOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-[360px] max-w-[85vw] bg-[#0b0f14] border-l border-gray-800 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-gray-300"><Settings size={16}/><span className="text-sm font-semibold">Settings</span></div>
              <button onClick={()=>setSettingsOpen(false)} className="text-xs px-2 py-1 rounded-md border border-gray-700 bg-gray-900/60 hover:bg-gray-800/60">Close</button>
            </div>
            <div className="space-y-4">
              <Field label="Mode">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setMode('mock')} className={`text-xs px-2 py-1 rounded-md border ${mode==='mock'?'border-blue-500 text-blue-400':'border-gray-700 text-gray-300'} bg-gray-900/60`}>Sim</button>
                  <button onClick={()=>setMode('ros')} className={`text-xs px-2 py-1 rounded-md border ${mode==='ros'?'border-blue-500 text-blue-400':'border-gray-700 text-gray-300'} bg-gray-900/60`}>Live</button>
                </div>
              </Field>
              <Field label="ROSBridge WebSocket">
                <TextInput value={cfg.rosbridgeUrl} onChange={e=>setCfg({...cfg, rosbridgeUrl:e.target.value})} placeholder="ws://HOST:9090" />
              </Field>
              <Field label="Use GPS (NavSatFix)">
                <div className="flex items-center gap-2">
                  <Checkbox checked={cfg.useGps} onChange={(v)=>setCfg({...cfg, useGps:v})} />
                  <TextInput value={cfg.gpsTopic} onChange={e=>setCfg({...cfg, gpsTopic:e.target.value})} disabled={!cfg.useGps} placeholder="/fix" />
                </div>
              </Field>
              <Field label="Odometry topic (nav_msgs/Odometry)">
                <TextInput value={cfg.odomTopic} onChange={e=>setCfg({...cfg, odomTopic:e.target.value})} disabled={cfg.useGps} placeholder="/odom" />
              </Field>
              <Field label="Path topic (nav_msgs/Path)">
                <TextInput value={cfg.pathTopic} onChange={e=>setCfg({...cfg, pathTopic:e.target.value})} placeholder="/plan" />
              </Field>
              <Field label="Camera MJPEG URL (web_video_server)">
                <TextInput value={cfg.mjpegUrl} onChange={e=>setCfg({...cfg, mjpegUrl:e.target.value})} placeholder="http://HOST:8080/stream?topic=/camera/image_raw" />
              </Field>
              <div className="text-[11px] text-gray-500 border-t border-gray-800 pt-3">This UI is <b>read‑only</b>. It subscribes to topics and never publishes commands.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
