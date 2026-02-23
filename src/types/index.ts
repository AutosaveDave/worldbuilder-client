// ─── API Response ───────────────────────────────────────────────
export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  nextPageToken?: string;
  totalCount?: number;
}

// ─── World ──────────────────────────────────────────────────────
export interface WorldSettings {
  techLevel?: string;
  magicSystem?: boolean;
  magicDescription?: string | null;
  timelineStart?: string;
  timelineEnd?: string;
  scale?: string;
  tone?: string;
  themes?: string[];
}

export interface World {
  id: string;
  name: string;
  description?: string;
  genre?: string;
  tags?: string[];
  status?: string;
  settings?: WorldSettings;
  entityCounts?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Entity types ───────────────────────────────────────────────
export type EntityType =
  | "characters"
  | "factions"
  | "planets"
  | "locations"
  | "technologies"
  | "vehicles"
  | "species"
  | "items"
  | "quests"
  | "events"
  | "lore"
  | "economies"
  | "relationships";

export const ENTITY_TYPES: EntityType[] = [
  "characters",
  "factions",
  "planets",
  "locations",
  "technologies",
  "vehicles",
  "species",
  "items",
  "quests",
  "events",
  "lore",
  "economies",
  "relationships",
];

/** Maps collection name → singular tool name */
export const ENTITY_SINGULAR: Record<EntityType, string> = {
  characters: "character",
  factions: "faction",
  planets: "planet",
  locations: "location",
  technologies: "technology",
  vehicles: "vehicle",
  species: "species",
  items: "item",
  quests: "quest",
  events: "event",
  lore: "lore",
  economies: "economy",
  relationships: "relationship",
};

/** Human-readable labels */
export const ENTITY_LABELS: Record<EntityType, string> = {
  characters: "Characters",
  factions: "Factions",
  planets: "Planets",
  locations: "Locations",
  technologies: "Technologies",
  vehicles: "Vehicles",
  species: "Species",
  items: "Items",
  quests: "Quests",
  events: "Events",
  lore: "Lore",
  economies: "Economies",
  relationships: "Relationships",
};

/** MUI icon names per entity (used for display) */
export const ENTITY_ICONS: Record<EntityType, string> = {
  characters: "Person",
  factions: "Groups",
  planets: "Public",
  locations: "Place",
  technologies: "Memory",
  vehicles: "DirectionsCar",
  species: "Pets",
  items: "Inventory2",
  quests: "AssignmentTurnedIn",
  events: "Event",
  lore: "MenuBook",
  economies: "AccountBalance",
  relationships: "Hub",
};

// ─── Generic entity (common fields) ────────────────────────────
export interface Entity {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── Timeline event ─────────────────────────────────────────────
export interface TimelineEvent extends Entity {
  date?: string;
  sortOrder?: number;
  era?: string;
  significance?: string;
  participantIds?: { type: string; id: string; role?: string }[];
  locationId?: string;
  planetId?: string;
  consequences?: string[];
  outcome?: string;
}

// ─── Relationship ───────────────────────────────────────────────
export interface Relationship extends Entity {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  strength?: number;
  bidirectional?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── World Summary ──────────────────────────────────────────────
export interface WorldSummary {
  world: World;
  entityCounts: Record<string, number>;
  keyFactions?: Entity[];
  majorPlanets?: Entity[];
  notableCharacters?: Entity[];
  recentEvents?: Entity[];
  species?: Entity[];
}
