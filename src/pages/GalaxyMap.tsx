import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Chip,
  Stack,
  CircularProgress,
  Button,
  Divider,
  alpha,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import PublicIcon from "@mui/icons-material/Public";
import ExploreIcon from "@mui/icons-material/Explore";
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
    O: "#5c7aff",
    B: "#7a9fff",
    A: "#a4bfff",
    F: "#f5f0ff",
    G: "#ffe44d",
    K: "#ff8c00",
    M: "#ff4500",
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

/**
 * Compute multi-star orbit layout so that the cumulative center of mass
 * sits at the origin.  Each star orbits at radius r_i = k / m_i where
 * k is chosen large enough that no two stars collide.
 */
function computeStarLayout(stars: StarData[]) {
  const N = stars.length;

  const infos = stars.map((s, i) => ({
    displayR: i === 0
      ? Math.max(0.6, Math.sqrt(s.radius) * 0.8)
      : Math.max(0.4, Math.sqrt(s.radius) * 0.6),
    color: spectralColor(s.spectralClass),
    mass: s.mass || 1,
  }));

  if (N <= 1) {
    return { infos, orbitRadii: [0], maxExtent: infos[0]?.displayR ?? 0.6 };
  }

  const totalMass = infos.reduce((sum, s) => sum + s.mass, 0);
  const safetyFactor = 2.5;
  const angleStep = (2 * Math.PI) / N;

  // Minimum k so no adjacent pair collides
  let minK = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const requiredDist = (infos[i].displayR + infos[j].displayR) * safetyFactor;
    const mi = infos[i].mass;
    const mj = infos[j].mass;
    const cosA = Math.cos(angleStep);
    const distCoeff = Math.sqrt(
      1 / (mi * mi) + 1 / (mj * mj) - (2 * cosA) / (mi * mj)
    );
    if (distCoeff > 0) {
      minK = Math.max(minK, requiredDist / distCoeff);
    }
  }

  // Honour data-defined orbit separations
  const maxDataOrbit = Math.max(0, ...stars.map((s) => (s.orbitRadius ?? 0) * 20));
  let dataK = 0;
  if (maxDataOrbit > 0) {
    if (N === 2) {
      // separation = r0+r1 = k*(1/m0 + 1/m1) = k*totalMass/(m0*m1)
      dataK = (maxDataOrbit * infos[0].mass * infos[1].mass) / totalMass;
    } else {
      dataK = (maxDataOrbit * totalMass) / N;
    }
  }

  const k = Math.max(minK, dataK);
  const orbitRadii = infos.map((info) => k / info.mass);
  const maxExtent = Math.max(...orbitRadii.map((r, i) => r + infos[i].displayR));

  return { infos, orbitRadii, maxExtent };
}

/** Scale factor to push planet orbits outside the multi-star exclusion zone */
function computeOrbitScale(starMaxExtent: number, planets: Planet[]): number {
  if (planets.length === 0) return 1;
  const buffer = 1.5;
  const exclusionRadius = starMaxExtent + buffer;
  let minPerihelion = Infinity;
  for (const p of planets) {
    const a = Math.sqrt(p.orbit.semiMajorAxis) * 9;
    const perihelion = a * (1 - p.orbit.eccentricity);
    minPerihelion = Math.min(minPerihelion, perihelion);
  }
  if (minPerihelion >= exclusionRadius) return 1;
  return exclusionRadius / minPerihelion;
}

// ─── Selection ring component ───────────────────────────────────
function SelectionRing({ radius, color }: { radius: number; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 0.5;
    }
  });
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 1.6, radius * 2.0, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Multi-Star Orbit System ────────────────────────────────────
function MultiStarSystem({ stars }: { stars: StarData[] }) {
  const layout = useMemo(() => computeStarLayout(stars), [stars]);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const N = stars.length;

  useFrame(({ clock }) => {
    if (N < 2) return;
    const t = clock.elapsedTime * 0.15;
    if (N === 2) {
      // Binary: stars on opposite sides of the center of mass
      if (groupRefs.current[0]) {
        groupRefs.current[0].position.x = layout.orbitRadii[0] * Math.cos(t);
        groupRefs.current[0].position.z = layout.orbitRadii[0] * Math.sin(t);
      }
      if (groupRefs.current[1]) {
        groupRefs.current[1].position.x = layout.orbitRadii[1] * Math.cos(t + Math.PI);
        groupRefs.current[1].position.z = layout.orbitRadii[1] * Math.sin(t + Math.PI);
      }
    } else {
      // N >= 3: equally spaced around the barycenter
      for (let i = 0; i < N; i++) {
        const angle = t + (2 * Math.PI * i) / N;
        const ref = groupRefs.current[i];
        if (ref) {
          ref.position.x = layout.orbitRadii[i] * Math.cos(angle);
          ref.position.z = layout.orbitRadii[i] * Math.sin(angle);
        }
      }
    }
  });

  // Circular orbit trail points (deduplicate nearly-equal radii)
  const orbitTrails = useMemo(() => {
    if (N < 2) return [];
    const seen = new Map<string, { radius: number; color: string }>();
    layout.orbitRadii.forEach((r, i) => {
      const key = r.toFixed(4);
      if (!seen.has(key)) seen.set(key, { radius: r, color: layout.infos[i].color });
    });
    return [...seen.values()].map(({ radius, color }) => {
      const pts: [number, number, number][] = [];
      const segments = 96;
      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        pts.push([radius * Math.cos(theta), 0, radius * Math.sin(theta)]);
      }
      return { pts, color };
    });
  }, [N, layout]);

  return (
    <>
      {layout.infos.map((star, i) => (
        <group key={i} ref={(el) => { groupRefs.current[i] = el; }}>
          {/* Star body */}
          <mesh>
            <sphereGeometry args={[star.displayR, 32, 32]} />
            <meshBasicMaterial color={star.color} />
          </mesh>
          {/* Light */}
          <pointLight color={star.color} intensity={i === 0 ? 8 : 5} distance={120} decay={1.2} />
          {/* Glow */}
          <mesh>
            <sphereGeometry args={[star.displayR * 1.5, 32, 32]} />
            <meshBasicMaterial color={star.color} transparent opacity={0.10} />
          </mesh>
        </group>
      ))}

      {/* Star orbit trails */}
      {orbitTrails.map((trail, i) => (
        <Line
          key={`star-orbit-${i}`}
          points={trail.pts}
          color={trail.color}
          lineWidth={1}
          transparent
          opacity={0.12}
        />
      ))}
    </>
  );
}

// ─── Galaxy-level Star Marker ───────────────────────────────────
function StarMarker({
  system,
  isSelected,
  onSelect,
}: {
  system: StarSystem;
  isSelected: boolean;
  onSelect: (systemId: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const primaryStar = system.stars[0];
  const color = spectralColor(primaryStar.spectralClass);
  const pos = cylToCartesian(system.position.azimuth, system.position.distance, system.position.elevation);
  const displayRadius = starDisplayRadius(primaryStar.spectralClass, primaryStar.radius);

  useFrame(() => {
    if (glowRef.current) {
      const s = isSelected ? 3.5 : 2.2;
      glowRef.current.scale.setScalar(s);
    }
  });

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = "auto";
  }, []);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isSelected) return;
    onSelect(system.id);
  }, [system, isSelected, onSelect]);

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

      {/* Enlarged invisible hit-area for easier clicking/tapping */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[Math.max(displayRadius * 2, 0.7), 16, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Point light for glow  */}
      <pointLight color={color} intensity={isSelected ? 2 : 0.6} distance={3} decay={2} />

      {/* Selection ring highlight */}
      {isSelected && <SelectionRing radius={displayRadius} color={color} />}
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
  orbitScale = 1,
}: {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  color?: string;
  opacity?: number;
  orbitScale?: number;
}) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const a = Math.sqrt(semiMajorAxis) * 9 * orbitScale;
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
  }, [semiMajorAxis, eccentricity, inclination, orbitScale]);

  return <Line points={points} color={color} lineWidth={1} transparent opacity={opacity} />;
}

// ─── Planet Sphere (System detail view) ─────────────────────────
function PlanetSphere({
  planet,
  isSelected,
  onSelect,
  orbitScale = 1,
}: {
  planet: Planet;
  isSelected: boolean;
  onSelect: (planetId: string) => void;
  orbitScale?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { orbit, render: r } = planet;
  const a = Math.sqrt(orbit.semiMajorAxis) * 9 * orbitScale;
  const b = a * Math.sqrt(1 - orbit.eccentricity * orbit.eccentricity);
  const angle = orbit.currentAngle * DEG2RAD;
  const inc = orbit.inclination * DEG2RAD;

  const x = a * Math.cos(angle);
  const z = b * Math.sin(angle);
  const y = z * Math.sin(inc);
  const zr = z * Math.cos(inc);

  const displayRadius = Math.max(0.25, Math.sqrt(r.radius) * 0.45);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = "auto";
  }, []);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(isSelected ? "" : planet.id);
  }, [isSelected, onSelect, planet.id]);

  return (
    <group position={[x, y, zr]}>
      {/* Planet body */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[displayRadius, 32, 32]} />
        <meshStandardMaterial
          color={r.primaryColor}
          roughness={0.55}
          metalness={0.05}
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

      {/* Selection ring highlight */}
      {isSelected && <SelectionRing radius={displayRadius} color={r.primaryColor} />}
    </group>
  );
}

// ─── System Detail View (zoomed in) ─────────────────────────────
function SystemDetailScene({
  system,
  planets,
  selectedPlanetId,
  onSelectPlanet,
}: {
  system: StarSystem;
  planets: Planet[];
  selectedPlanetId: string;
  onSelectPlanet: (planetId: string) => void;
}) {
  const starLayout = useMemo(() => computeStarLayout(system.stars), [system.stars]);

  // Scale planet orbits outward if any perihelion falls inside the star exclusion zone
  const orbitScale = useMemo(
    () => computeOrbitScale(starLayout.maxExtent, planets),
    [planets, starLayout.maxExtent],
  );

  return (
    <group>
      {/* All stars — single stars sit at center, multi-star systems orbit the COM */}
      <MultiStarSystem stars={system.stars} />

      {/* Planet orbits and planets */}
      {planets.map((planet) => (
        <group key={planet.id}>
          <OrbitEllipse
            semiMajorAxis={planet.orbit.semiMajorAxis}
            eccentricity={planet.orbit.eccentricity}
            inclination={planet.orbit.inclination}
            color={planet.render.primaryColor}
            opacity={0.2}
            orbitScale={orbitScale}
          />
          <PlanetSphere
            planet={planet}
            isSelected={selectedPlanetId === planet.id}
            onSelect={onSelectPlanet}
            orbitScale={orbitScale}
          />
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
  onSelectSystem: _onSelectSystem,
  selectedStarId,
  onSelectStarId,
  selectedPlanetId,
  onSelectPlanetId,
}: {
  starSystems: StarSystem[];
  planets: Planet[];
  selectedSystem: StarSystem | null;
  onSelectSystem: (system: StarSystem | null) => void;
  selectedStarId: string;
  onSelectStarId: (id: string) => void;
  selectedPlanetId: string;
  onSelectPlanetId: (id: string) => void;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Camera targets
  const galaxyCamPos = useMemo(() => new THREE.Vector3(0, 30, 35), []);
  const galaxyLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  // Compute the max visual extent so the camera can frame all planets AND stars
  const maxOrbitExtent = useMemo(() => {
    if (!selectedSystem) return 0;
    const extents: number[] = [];

    // Star layout extent (accounts for multi-star orbits)
    const starLayout = computeStarLayout(selectedSystem.stars);
    extents.push(starLayout.maxExtent);

    // Planet orbit extents (with collision-avoidance scaling)
    const sysPlanets = planets.filter((p) => p.starSystemId === selectedSystem.id);
    const oScale = computeOrbitScale(starLayout.maxExtent, sysPlanets);
    for (const p of sysPlanets) {
      extents.push(Math.sqrt(p.orbit.semiMajorAxis) * 9 * oScale);
    }

    return extents.length > 0 ? Math.max(...extents) : 5;
  }, [selectedSystem, planets]);

  const systemCamPos = useMemo(() => {
    if (!selectedSystem) return new THREE.Vector3(0, 30, 35);
    const [x, y, z] = cylToCartesian(
      selectedSystem.position.azimuth,
      selectedSystem.position.distance,
      selectedSystem.position.elevation
    );
    // Frame camera to fit all orbits: compute distance from FOV
    const halfFov = (55 / 2) * DEG2RAD;
    const padding = 1.35; // 35% breathing room around edges
    const camDist = Math.min(200, Math.max(10, (maxOrbitExtent * padding) / Math.tan(halfFov)));
    // Place camera above and behind at a ~36° elevation angle
    const elevFrac = 0.55;
    const fwdFrac = 0.75;
    const norm = Math.sqrt(elevFrac ** 2 + fwdFrac ** 2);
    return new THREE.Vector3(
      x,
      y + (camDist * elevFrac) / norm,
      z + (camDist * fwdFrac) / norm
    );
  }, [selectedSystem, maxOrbitExtent]);

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
        maxDistance={selectedSystem ? Math.min(300, Math.max(80, maxOrbitExtent * 4)) : 80}
        target={targetLook}
      />

      {/* Background stars */}
      <Stars radius={120} depth={80} count={3000} factor={3} saturation={0.1} fade speed={0.5} />

      {/* Ambient + directional */}
      <ambientLight intensity={0.18} />

      {/* Galactic center glow */}
      {!selectedSystem && (
        <group>
          <pointLight color="#ffd89b" intensity={2} distance={15} decay={2} />
        </group>
      )}

      {/* Galaxy view: star markers */}
      {!selectedSystem &&
        starSystems.map((sys) => (
          <StarMarker
            key={sys.id}
            system={sys}
            isSelected={selectedStarId === sys.id}
            onSelect={onSelectStarId}
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
          <SystemDetailScene
            system={selectedSystem}
            planets={systemPlanets}
            selectedPlanetId={selectedPlanetId}
            onSelectPlanet={onSelectPlanetId}
          />
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
  const [selectedStarId, setSelectedStarId] = useState("");
  const [selectedPlanetId, setSelectedPlanetId] = useState("");

  // Reset selections when navigating between galaxy / system views
  useEffect(() => {
    setSelectedStarId("");
    setSelectedPlanetId("");
  }, [selectedSystem]);

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
    setSelectedStarId("");
    setSelectedPlanetId("");
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
            selectedStarId={selectedStarId}
            onSelectStarId={setSelectedStarId}
            selectedPlanetId={selectedPlanetId}
            onSelectPlanetId={setSelectedPlanetId}
          />
        ) : (
          <>
            <Stars radius={120} depth={80} count={3000} factor={3} saturation={0.1} fade speed={0.5} />
            <ambientLight intensity={0.1} />
          </>
        )}
      </Canvas>

      {/* ── HUD Info Panel ─────────────────────────────────────── */}
      {(() => {
        // Galaxy view: show selected star system info
        if (!selectedSystem && selectedStarId && starSystems) {
          const sys = starSystems.find((s) => s.id === selectedStarId);
          if (!sys) return null;
          const star = sys.stars[0];
          const sysPlanets = planets?.filter((p) => p.starSystemId === sys.id) ?? [];
          return (
            <Paper
              sx={{
                position: "absolute",
                bottom: 24,
                right: 24,
                zIndex: 10,
                width: 320,
                maxHeight: "50vh",
                overflow: "auto",
                bgcolor: alpha("#0a0f1e", 0.92),
                backdropFilter: "blur(12px)",
                border: `1px solid ${alpha("#fff", 0.12)}`,
                p: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>
                  {sys.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setSelectedStarId("")}
                  sx={{ color: alpha("#fff", 0.5), "&:hover": { color: "#fff" } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
                <Chip
                  label={sys.systemType === "binary" ? "Binary" : "Single"}
                  size="small"
                  sx={{ bgcolor: alpha("#7c4dff", 0.25), color: "#c9b0ff", fontSize: "0.7rem" }}
                />
                <Chip
                  label={`${star.spectralClass}-class`}
                  size="small"
                  sx={{ bgcolor: alpha(spectralColor(star.spectralClass), 0.25), color: spectralColor(star.spectralClass), fontSize: "0.7rem" }}
                />
                {sys.status && (
                  <Chip
                    label={sys.status}
                    size="small"
                    sx={{ bgcolor: alpha("#fff", 0.08), color: "#aaa", fontSize: "0.7rem" }}
                  />
                )}
              </Stack>
              {sys.description && (
                <Typography variant="body2" sx={{ color: alpha("#fff", 0.65), mb: 1, fontSize: "0.78rem" }}>
                  {sys.description}
                </Typography>
              )}
              <Divider sx={{ borderColor: alpha("#fff", 0.08), mb: 1 }} />
              <Typography variant="caption" sx={{ color: alpha("#fff", 0.5), display: "block", mb: 0.5 }}>
                Temperature: {star.surfaceTemperature?.toLocaleString()}K &middot; Habitable zone: {sys.habitableZone}
              </Typography>
              {sysPlanets.length > 0 && (
                <Typography variant="caption" sx={{ color: alpha("#fff", 0.5), display: "block", mb: 1 }}>
                  {sysPlanets.length} planet{sysPlanets.length !== 1 ? "s" : ""}: {sysPlanets.map((p) => p.name).join(", ")}
                </Typography>
              )}
              <Button
                variant="contained"
                size="small"
                fullWidth
                startIcon={<ExploreIcon />}
                onClick={() => handleSelectSystem(sys)}
                sx={{
                  mt: 0.5,
                  bgcolor: "#7c4dff",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#9e73ff" },
                }}
              >
                View System
              </Button>
            </Paper>
          );
        }

        // System view: show selected planet info
        if (selectedSystem && selectedPlanetId && planets) {
          const planet = planets.find((p) => p.id === selectedPlanetId);
          if (!planet) return null;
          return (
            <Paper
              sx={{
                position: "absolute",
                bottom: 24,
                right: 24,
                zIndex: 10,
                width: 320,
                maxHeight: "50vh",
                overflow: "auto",
                bgcolor: alpha("#0a0f1e", 0.92),
                backdropFilter: "blur(12px)",
                border: `1px solid ${alpha("#fff", 0.12)}`,
                p: 2,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <PublicIcon sx={{ color: planet.render.primaryColor, fontSize: 20 }} />
                <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700, flex: 1 }}>
                  {planet.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setSelectedPlanetId("")}
                  sx={{ color: alpha("#fff", 0.5), "&:hover": { color: "#fff" } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
                <Chip
                  label={planet.type}
                  size="small"
                  sx={{ bgcolor: alpha(planet.render.primaryColor, 0.25), color: planet.render.primaryColor, fontSize: "0.7rem" }}
                />
                <Chip
                  label={planet.habitability}
                  size="small"
                  sx={{
                    bgcolor: alpha(planet.habitability === "habitable" ? "#4caf50" : "#ff9800", 0.2),
                    color: planet.habitability === "habitable" ? "#81c784" : "#ffb74d",
                    fontSize: "0.7rem",
                  }}
                />
              </Stack>
              {planet.description && (
                <Typography variant="body2" sx={{ color: alpha("#fff", 0.65), mb: 1, fontSize: "0.78rem" }}>
                  {planet.description}
                </Typography>
              )}
              <Divider sx={{ borderColor: alpha("#fff", 0.08), mb: 1 }} />
              <Stack spacing={0.3} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: alpha("#fff", 0.5) }}>
                  Climate: {planet.climate} &middot; Atmosphere: {planet.atmosphere}
                </Typography>
                <Typography variant="caption" sx={{ color: alpha("#fff", 0.5) }}>
                  Gravity: {planet.gravity} &middot; Orbit period: {planet.orbit.orbitalPeriod} days
                </Typography>
                {planet.moons.length > 0 && (
                  <Typography variant="caption" sx={{ color: alpha("#fff", 0.5) }}>
                    Moons: {planet.moons.join(", ")}
                  </Typography>
                )}
              </Stack>
              {planet.pointsOfInterest.length > 0 && (
                <>
                  <Typography variant="caption" sx={{ color: alpha("#fff", 0.4), fontWeight: 600, display: "block", mb: 0.3 }}>
                    Points of Interest
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {planet.pointsOfInterest.map((poi) => (
                      <Chip
                        key={poi}
                        label={poi}
                        size="small"
                        sx={{ bgcolor: alpha("#fff", 0.06), color: "#aaa", fontSize: "0.68rem" }}
                      />
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          );
        }

        return null;
      })()}
    </Box>
  );
}
