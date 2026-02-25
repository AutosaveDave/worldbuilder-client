import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Chip,
  Stack,
  CircularProgress,
  alpha,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../api/firebase";

// ─── Types ──────────────────────────────────────────────────────
interface StarData {
  name: string;
  spectralClass: string;
  luminosityClass: string;
  surfaceTemperature: number;
  radius: number;
  mass: number;
  orbitRadius?: number;
  orbitAngle?: number;
}

interface StarSystem {
  id: string;
  name: string;
  description?: string;
  systemType: string;
  galacticRegionId: string;
  position: { azimuth: number; distance: number; elevation: number };
  stars: StarData[];
  habitableZone: string;
  numberOfPlanets: number;
  resources: string[];
  hazards: string[];
  status: string;
}

interface PlanetOrbit {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  orbitalPeriod: number;
  currentAngle: number;
}

interface PlanetRender {
  radius: number;
  primaryColor: string;
  secondaryColor: string;
  atmosphereColor: string;
  atmosphereIntensity: number;
  texture: string;
  cloudCover: number;
}

interface Planet {
  id: string;
  name: string;
  description?: string;
  type: string;
  climate: string;
  atmosphere: string;
  gravity: string;
  starSystemId: string;
  orbit: PlanetOrbit;
  render: PlanetRender;
  habitability: string;
  moons: string[];
  pointsOfInterest: string[];
}

// ─── Helpers ────────────────────────────────────────────────────
const DEG2RAD = Math.PI / 180;

/** Convert cylindrical (azimuth°, distance, elevation) → Cartesian */
function cylToCartesian(azimuth: number, distance: number, elevation: number): [number, number, number] {
  const a = azimuth * DEG2RAD;
  return [
    distance * Math.cos(a),
    elevation,
    distance * Math.sin(a),
  ];
}

/** Map spectral class to hex color */
function spectralColor(spectralClass: string): string {
  const map: Record<string, string> = {
    O: "#9bb0ff",
    B: "#aabfff",
    A: "#cad7ff",
    F: "#f8f7ff",
    G: "#fff4ea",
    K: "#ffd2a1",
    M: "#ffad60",
  };
  return map[spectralClass?.toUpperCase()] ?? "#ffffff";
}

/** Star display radius — brighter bigger  */
function starDisplayRadius(spectralClass: string, stellarRadius: number): number {
  const base = 0.12;
  const scale = spectralClass === "O" || spectralClass === "B" ? 1.6 :
    spectralClass === "F" ? 1.2 :
    spectralClass === "G" ? 1.0 :
    spectralClass === "K" ? 0.85 :
    spectralClass === "M" ? 0.65 : 1;
  return base * scale * Math.max(0.6, Math.min(stellarRadius, 2));
}

// ─── Galaxy-level Star Marker ───────────────────────────────────
function StarMarker({
  system,
  planets,
  onClick,
}: {
  system: StarSystem;
  planets: Planet[];
  onClick: (system: StarSystem) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const primaryStar = system.stars[0];
  const color = spectralColor(primaryStar.spectralClass);
  const pos = cylToCartesian(system.position.azimuth, system.position.distance, system.position.elevation);
  const displayRadius = starDisplayRadius(primaryStar.spectralClass, primaryStar.radius);

  useFrame(() => {
    if (glowRef.current) {
      const s = hovered ? 3.5 : 2.2;
      glowRef.current.scale.setScalar(s);
    }
  });

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(system);
  }, [onClick, system]);

  const systemPlanets = planets.filter((p) => p.type !== "moon" && p.type !== "station");
  const systemMoons = planets.filter((p) => p.type === "moon");

  return (
    <group position={pos}>
      {/* Glow sprite */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[displayRadius, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>

      {/* Star core */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[displayRadius, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Point light for glow  */}
      <pointLight color={color} intensity={hovered ? 2 : 0.6} distance={3} decay={2} />

      {/* Hover label */}
      {hovered && (
        <Html distanceFactor={20} style={{ pointerEvents: "none" }}>
          <Paper
            elevation={8}
            sx={{
              p: 1.5,
              minWidth: 200,
              maxWidth: 280,
              bgcolor: alpha("#0a0f1e", 0.92),
              border: `1px solid ${alpha(color, 0.5)}`,
              backdropFilter: "blur(8px)",
              transform: "translate(12px, -50%)",
            }}
          >
            <Typography variant="subtitle2" sx={{ color, fontWeight: 700 }}>
              {system.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {system.systemType === "binary" ? "Binary" : "Single"} system &middot;{" "}
              {primaryStar.spectralClass}-class &middot; {primaryStar.surfaceTemperature}K
            </Typography>
            {systemPlanets.length > 0 && (
              <Box mt={0.5}>
                <Typography variant="caption" sx={{ color: "#aaa", fontWeight: 600 }}>
                  Planets ({systemPlanets.length}):
                </Typography>
                {systemPlanets.map((p) => (
                  <Typography key={p.id} variant="caption" display="block" sx={{ pl: 1, color: "#ccc" }}>
                    • {p.name} — {p.type}, {p.habitability}
                  </Typography>
                ))}
              </Box>
            )}
            {systemMoons.length > 0 && (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
                + {systemMoons.length} moon{systemMoons.length > 1 ? "s" : ""}
              </Typography>
            )}
            <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" useFlexGap>
              <Chip label={system.status} size="small" sx={{ height: 18, fontSize: 10 }} />
            </Stack>
          </Paper>
        </Html>
      )}
    </group>
  );
}

// ─── Orbit Ellipse Line ──────────────────────────────────────────
function OrbitEllipse({
  semiMajorAxis,
  eccentricity,
  inclination,
  color = "#ffffff",
  opacity = 0.18,
}: {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  color?: string;
  opacity?: number;
}) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const a = semiMajorAxis * 6; // scale for visual display
    const b = a * Math.sqrt(1 - eccentricity * eccentricity);
    const inc = inclination * DEG2RAD;
    const segments = 96;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = a * Math.cos(theta);
      const z = b * Math.sin(theta);
      const y = z * Math.sin(inc);
      const zr = z * Math.cos(inc);
      pts.push([x, y, zr]);
    }
    return pts;
  }, [semiMajorAxis, eccentricity, inclination]);

  return <Line points={points} color={color} lineWidth={1} transparent opacity={opacity} />;
}

// ─── Planet Sphere (System detail view) ─────────────────────────
function PlanetSphere({
  planet,
  showLabel,
}: {
  planet: Planet;
  showLabel?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const { orbit, render: r } = planet;
  const a = orbit.semiMajorAxis * 6;
  const b = a * Math.sqrt(1 - orbit.eccentricity * orbit.eccentricity);
  const angle = orbit.currentAngle * DEG2RAD;
  const inc = orbit.inclination * DEG2RAD;

  const x = a * Math.cos(angle);
  const z = b * Math.sin(angle);
  const y = z * Math.sin(inc);
  const zr = z * Math.cos(inc);

  const displayRadius = Math.max(0.25, r.radius * 0.5);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  return (
    <group position={[x, y, zr]}>
      {/* Planet body */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[displayRadius, 32, 32]} />
        <meshStandardMaterial
          color={r.primaryColor}
          emissive={r.primaryColor}
          emissiveIntensity={0.15}
          roughness={0.7}
        />
      </mesh>

      {/* Atmosphere glow */}
      {r.atmosphereIntensity > 0.05 && (
        <mesh>
          <sphereGeometry args={[displayRadius * 1.12, 32, 32]} />
          <meshBasicMaterial
            color={r.atmosphereColor}
            transparent
            opacity={r.atmosphereIntensity * 0.4}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Hover label */}
      {(hovered || showLabel) && (
        <Html distanceFactor={15} style={{ pointerEvents: "none" }}>
          <Paper
            elevation={8}
            sx={{
              p: 1.5,
              minWidth: 180,
              maxWidth: 260,
              bgcolor: alpha("#0a0f1e", 0.92),
              border: `1px solid ${alpha(r.primaryColor, 0.5)}`,
              backdropFilter: "blur(8px)",
              transform: "translate(12px, -50%)",
            }}
          >
            <Typography variant="subtitle2" sx={{ color: r.primaryColor, fontWeight: 700 }}>
              {planet.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {planet.type} &middot; {planet.climate}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Habitability: {planet.habitability}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Atmosphere: {planet.atmosphere}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Gravity: {planet.gravity}
            </Typography>
            {planet.pointsOfInterest?.length > 0 && (
              <Box mt={0.5}>
                <Typography variant="caption" sx={{ color: "#aaa", fontWeight: 600 }}>
                  Points of Interest:
                </Typography>
                {planet.pointsOfInterest.map((poi) => (
                  <Typography key={poi} variant="caption" display="block" sx={{ pl: 1, color: "#ccc" }}>
                    • {poi}
                  </Typography>
                ))}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
              Orbit: {orbit.semiMajorAxis} AU &middot; Period: {orbit.orbitalPeriod} yr
            </Typography>
          </Paper>
        </Html>
      )}
    </group>
  );
}

// ─── System Detail View (zoomed in) ─────────────────────────────
function SystemDetailScene({
  system,
  planets,
}: {
  system: StarSystem;
  planets: Planet[];
}) {
  const primaryStar = system.stars[0];
  const primaryColor = spectralColor(primaryStar.spectralClass);

  return (
    <group>
      {/* Central star */}
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color={primaryColor} />
      </mesh>
      <pointLight color={primaryColor} intensity={3} distance={60} decay={1.5} />

      {/* Star glow */}
      <mesh>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial color={primaryColor} transparent opacity={0.10} />
      </mesh>

      {/* Secondary star (if binary) */}
      {system.stars.length > 1 && system.stars[1] && (() => {
        const s2 = system.stars[1];
        const sColor = spectralColor(s2.spectralClass);
        const orbitR = (s2.orbitRadius ?? 0.2) * 20;
        const angle = (s2.orbitAngle ?? 0) * DEG2RAD;
        const sx = orbitR * Math.cos(angle);
        const sz = orbitR * Math.sin(angle);
        return (
          <group position={[sx, 0, sz]}>
            <mesh>
              <sphereGeometry args={[0.6, 24, 24]} />
              <meshBasicMaterial color={sColor} />
            </mesh>
            <pointLight color={sColor} intensity={1.5} distance={30} decay={2} />
            <mesh>
              <sphereGeometry args={[0.9, 24, 24]} />
              <meshBasicMaterial color={sColor} transparent opacity={0.08} />
            </mesh>
          </group>
        );
      })()}

      {/* Planet orbits and planets */}
      {planets.map((planet) => (
        <group key={planet.id}>
          <OrbitEllipse
            semiMajorAxis={planet.orbit.semiMajorAxis}
            eccentricity={planet.orbit.eccentricity}
            inclination={planet.orbit.inclination}
            color={planet.render.primaryColor}
            opacity={0.2}
          />
          <PlanetSphere planet={planet} />
        </group>
      ))}
    </group>
  );
}

// ─── Camera animator ─────────────────────────────────────────────
function CameraAnimator({
  targetPosition,
  targetLookAt,
  active,
}: {
  targetPosition: THREE.Vector3;
  targetLookAt: THREE.Vector3;
  active: boolean;
}) {
  const { camera } = useThree();
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (!active) return;
    camera.position.lerp(targetPosition, 0.04);
    lookAtRef.current.lerp(targetLookAt, 0.04);
    camera.lookAt(lookAtRef.current);
  });

  return null;
}

// ─── Galaxy scene content ────────────────────────────────────────
function GalaxyScene({
  starSystems,
  planets,
  selectedSystem,
  onSelectSystem,
}: {
  starSystems: StarSystem[];
  planets: Planet[];
  selectedSystem: StarSystem | null;
  onSelectSystem: (system: StarSystem | null) => void;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Camera targets
  const galaxyCamPos = useMemo(() => new THREE.Vector3(0, 30, 35), []);
  const galaxyLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const systemCamPos = useMemo(() => {
    if (!selectedSystem) return new THREE.Vector3(0, 30, 35);
    const [x, y, z] = cylToCartesian(
      selectedSystem.position.azimuth,
      selectedSystem.position.distance,
      selectedSystem.position.elevation
    );
    return new THREE.Vector3(x, y + 15, z + 20);
  }, [selectedSystem]);

  const systemLookAt = useMemo(() => {
    if (!selectedSystem) return new THREE.Vector3(0, 0, 0);
    const [x, y, z] = cylToCartesian(
      selectedSystem.position.azimuth,
      selectedSystem.position.distance,
      selectedSystem.position.elevation
    );
    return new THREE.Vector3(x, y, z);
  }, [selectedSystem]);

  // Disable orbit controls during animation
  const [animating, setAnimating] = useState(false);
  const prevSelected = useRef<string | null>(null);

  useEffect(() => {
    const currentId = selectedSystem?.id ?? null;
    if (currentId !== prevSelected.current) {
      prevSelected.current = currentId;
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [selectedSystem]);

  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 30, 35);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  const targetPos = selectedSystem ? systemCamPos : galaxyCamPos;
  const targetLook = selectedSystem ? systemLookAt : galaxyLookAt;

  const systemPlanets = useMemo(() => {
    if (!selectedSystem) return [];
    return planets.filter((p) => p.starSystemId === selectedSystem.id);
  }, [selectedSystem, planets]);

  return (
    <>
      <CameraAnimator
        targetPosition={targetPos}
        targetLookAt={targetLook}
        active={animating}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={80}
        target={targetLook}
      />

      {/* Background stars */}
      <Stars radius={120} depth={80} count={3000} factor={3} saturation={0.1} fade speed={0.5} />

      {/* Ambient + directional */}
      <ambientLight intensity={0.15} />

      {/* Galactic center glow */}
      {!selectedSystem && (
        <group>
          <mesh>
            <sphereGeometry args={[1.2, 32, 32]} />
            <meshBasicMaterial color="#ffd89b" transparent opacity={0.25} />
          </mesh>
          <pointLight color="#ffd89b" intensity={2} distance={15} decay={2} />
        </group>
      )}

      {/* Galaxy view: star markers */}
      {!selectedSystem &&
        starSystems.map((sys) => (
          <StarMarker
            key={sys.id}
            system={sys}
            planets={planets.filter((p) => p.starSystemId === sys.id)}
            onClick={onSelectSystem}
          />
        ))}

      {/* System detail view */}
      {selectedSystem && (
        <group
          position={cylToCartesian(
            selectedSystem.position.azimuth,
            selectedSystem.position.distance,
            selectedSystem.position.elevation
          )}
        >
          <SystemDetailScene system={selectedSystem} planets={systemPlanets} />
        </group>
      )}
    </>
  );
}

// ─── Main Page Component ─────────────────────────────────────────
export default function GalaxyMap() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const [selectedSystem, setSelectedSystem] = useState<StarSystem | null>(null);
  const [starSystems, setStarSystems] = useState<StarSystem[] | null>(null);
  const [planets, setPlanets] = useState<Planet[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch star systems and planets directly from Firestore
  useEffect(() => {
    if (!worldId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getDocs(collection(db, "worlds", worldId, "star-systems")),
      getDocs(collection(db, "worlds", worldId, "planets")),
    ])
      .then(([sysSnap, planetSnap]) => {
        if (cancelled) return;
        setStarSystems(
          sysSnap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as StarSystem))
        );
        setPlanets(
          planetSnap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as Planet))
        );
      })
      .catch((err) => {
        console.error("Firestore fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [worldId]);

  const handleSelectSystem = useCallback((system: StarSystem | null) => {
    setSelectedSystem(system);
  }, []);

  const handleBack = useCallback(() => {
    if (selectedSystem) {
      setSelectedSystem(null);
    } else {
      navigate(`/worlds/${worldId}`);
    }
  }, [selectedSystem, navigate, worldId]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "calc(100vh - 64px)", bgcolor: "#000" }}>
      {/* Top bar */}
      <Box
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <IconButton
          onClick={handleBack}
          sx={{
            bgcolor: alpha("#0a0f1e", 0.8),
            backdropFilter: "blur(8px)",
            border: `1px solid ${alpha("#fff", 0.1)}`,
            color: "#fff",
            "&:hover": { bgcolor: alpha("#0a0f1e", 0.95) },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Paper
          sx={{
            px: 2,
            py: 0.8,
            bgcolor: alpha("#0a0f1e", 0.8),
            backdropFilter: "blur(8px)",
            border: `1px solid ${alpha("#fff", 0.1)}`,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: "#fff", fontWeight: 600 }}>
            {selectedSystem ? selectedSystem.name : "Galaxy Map"}
          </Typography>
          {selectedSystem && (
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              {selectedSystem.systemType === "binary" ? "Binary" : "Single"} &middot;{" "}
              {selectedSystem.stars[0]?.spectralClass}-class &middot; Click back to return
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Loading overlay */}
      {loading && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            bgcolor: alpha("#000", 0.7),
          }}
        >
          <Stack alignItems="center" spacing={2}>
            <CircularProgress sx={{ color: "#7c4dff" }} />
            <Typography color="#fff">Loading galaxy data…</Typography>
          </Stack>
        </Box>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 30, 35], fov: 55, near: 0.1, far: 500 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        {(starSystems && planets) ? (
          <GalaxyScene
            starSystems={starSystems}
            planets={planets}
            selectedSystem={selectedSystem}
            onSelectSystem={handleSelectSystem}
          />
        ) : (
          <>
            <Stars radius={120} depth={80} count={3000} factor={3} saturation={0.1} fade speed={0.5} />
            <ambientLight intensity={0.1} />
          </>
        )}
      </Canvas>
    </Box>
  );
}
