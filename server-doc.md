# Worldbuilder Server — API Documentation

Complete guide for consuming the Worldbuilder Firebase Cloud Functions API from a React application.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [Making Requests (MCP over HTTP)](#making-requests-mcp-over-http)
- [React Integration Guide](#react-integration-guide)
- [API Reference — Worlds](#api-reference--worlds)
- [API Reference — Entity CRUD (13 Types)](#api-reference--entity-crud-13-types)
- [Entity Schemas](#entity-schemas)
  - [Characters](#characters)
  - [Factions](#factions)
  - [Planets](#planets)
  - [Locations](#locations)
  - [Technologies](#technologies)
  - [Vehicles](#vehicles)
  - [Species](#species)
  - [Items](#items)
  - [Quests](#quests)
  - [Events](#events)
  - [Lore](#lore)
  - [Economies](#economies)
  - [Relationships](#relationships)
- [API Reference — Special Tools](#api-reference--special-tools)
  - [Relationship Graph Traversal](#relationship-graph-traversal)
  - [Timeline](#timeline)
  - [Game Runtime](#game-runtime)
- [Pagination](#pagination)
- [Error Handling](#error-handling)
- [Firestore Data Structure](#firestore-data-structure)
- [Local Development with Emulators](#local-development-with-emulators)

---

## Overview

The Worldbuilder server is a **Firebase Cloud Function** that exposes a single HTTP endpoint implementing the **Model Context Protocol (MCP)** over Streamable HTTP. It provides a complete CRUD API for managing game worlds and their entities — characters, factions, planets, locations, technologies, vehicles, species, items, quests, events, lore, economies, and relationships.

| Property        | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **Protocol**    | MCP (Model Context Protocol) — JSON-RPC 2.0 over Streamable HTTP                |
| **Transport**   | HTTP POST with SSE (Server-Sent Events) response                                |
| **Region**      | `us-central1`                                                                    |
| **Base URL**    | `https://us-central1-<PROJECT_ID>.cloudfunctions.net/mcp`                        |
| **MCP Endpoint**| `POST /mcp`                                                                      |
| **Health Check**| `GET /`                                                                          |
| **Auth**        | API key via `x-api-key` header                                                   |

---

## Architecture

```
React App
   │
   │  HTTP POST (JSON-RPC 2.0)
   ▼
┌─────────────────────────────────────┐
│  Firebase Cloud Function (mcp)      │
│  ┌───────────────────────────────┐  │
│  │  Express (cors, auth, json)   │  │
│  │  POST /mcp                    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  MCP Server (stateless) │  │  │
│  │  │  StreamableHTTPTransport│  │  │
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │  Tool Handlers    │  │  │  │
│  │  │  │  (CRUD, Runtime)  │  │  │  │
│  │  │  └────────┬──────────┘  │  │  │
│  │  └───────────┼─────────────┘  │  │
│  └──────────────┼────────────────┘  │
│                 ▼                    │
│          Firestore Database          │
└─────────────────────────────────────┘
```

The server is **stateless** — each POST creates a fresh MCP server instance. There are no sessions to manage.

---

## Authentication

Every request (except `OPTIONS` preflight) must include the `x-api-key` header:

```
x-api-key: YOUR_API_KEY
```

| Status Code | Meaning                        |
| ----------- | ------------------------------ |
| `401`       | Missing `x-api-key` header     |
| `403`       | Invalid API key                |

The API key is configured via Firebase Secrets Manager (`WORLDBUILDER_API_KEY` secret).

---

## Making Requests (MCP over HTTP)

All tool calls are sent as **JSON-RPC 2.0** messages to the `/mcp` endpoint. The response uses **Server-Sent Events (SSE)** format.

### Request Format

```http
POST /mcp
Content-Type: application/json
Accept: application/json, text/event-stream
x-api-key: YOUR_API_KEY

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "TOOL_NAME",
    "arguments": {
      ...tool arguments...
    }
  }
}
```

### Response Format

The response body is an SSE stream. Each meaningful message is on a `data:` line containing a JSON-RPC result:

```
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{...}"}]}}
```

The actual payload is inside `result.content[0].text` as a **JSON string** that must be parsed separately. That parsed object has the shape:

```json
{
  "success": true,
  "data": { ...entity data... },
  "nextPageToken": "optional-cursor",
  "totalCount": 42
}
```

### Parsing the Response (Step by Step)

1. Read the response body as text
2. Find the line starting with `data: `
3. Parse the JSON-RPC envelope: `JSON.parse(line.replace("data: ", ""))`
4. Extract the inner text: `envelope.result.content[0].text`
5. Parse the tool result: `JSON.parse(innerText)`
6. The final object has `{ success, data, nextPageToken?, totalCount? }`

---

## React Integration Guide

### API Client

Create a reusable client module for your React app:

```typescript
// src/api/worldbuilder.ts

const API_URL = "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/mcp/mcp";
const API_KEY = import.meta.env.VITE_WORLDBUILDER_API_KEY; // or process.env.REACT_APP_...

interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  nextPageToken?: string;
  totalCount?: number;
}

let requestId = 0;

export async function callTool<T = any>(
  toolName: string,
  args: Record<string, any>
): Promise<ToolResponse<T>> {
  const id = ++requestId;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();

  // Parse SSE: find the "data: " line with content
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const envelope = JSON.parse(line.slice(6));

      if (envelope.error) {
        throw new Error(envelope.error.message || "RPC error");
      }

      const innerText = envelope.result.content[0].text;
      return JSON.parse(innerText) as ToolResponse<T>;
    }
  }

  throw new Error("No data line found in SSE response");
}
```

### React Hook Example

```typescript
// src/hooks/useWorldbuilder.ts
import { useState, useEffect, useCallback } from "react";
import { callTool } from "../api/worldbuilder";

export function useToolQuery<T>(
  toolName: string,
  args: Record<string, any>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callTool<T>(toolName, args);
      if (result.success) {
        setData(result.data ?? null);
      } else {
        setError(result.error ?? "Unknown error");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
```

### Usage in Components

```tsx
// List all worlds
function WorldList() {
  const { data: worlds, loading } = useToolQuery("list_worlds", { limit: 50 });

  if (loading) return <p>Loading…</p>;
  return (
    <ul>
      {worlds?.map((w: any) => (
        <li key={w.id}>{w.name}</li>
      ))}
    </ul>
  );
}

// Get a single character
function CharacterDetail({ worldId, characterId }: { worldId: string; characterId: string }) {
  const { data, loading } = useToolQuery(
    "get_character",
    { worldId, id: characterId },
    [worldId, characterId]
  );

  if (loading) return <p>Loading…</p>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

// Search factions by type
function FactionSearch({ worldId }: { worldId: string }) {
  const { data, loading } = useToolQuery(
    "search_factions",
    { worldId, field: "type", operator: "==", value: "military" },
    [worldId]
  );
  // ...
}
```

---

## API Reference — Worlds

Worlds are **top-level documents** (not subcollections). All other entities belong to a world.

### `create_world`

Create a new game world.

```json
{
  "name": "Elysium Reach",                        // required
  "id": "custom-id",                              // optional — auto-generated if omitted
  "description": "A sprawling sci-fi universe",   // optional
  "genre": "sci-fi",                              // optional
  "tags": ["space-opera", "hard-sci-fi"],          // default: []
  "settings": {                                    // optional
    "techLevel": "spacefaring",
    "magicSystem": false,
    "magicDescription": null,
    "timelineStart": "Year 0",
    "timelineEnd": "Year 5000",
    "scale": "galaxy",
    "tone": "heroic",
    "themes": ["exploration", "politics"]
  }
}
```

### `get_world`

```json
{ "worldId": "elysium-reach" }
```

### `update_world`

Only provided fields are updated.

```json
{
  "worldId": "elysium-reach",
  "name": "Elysium Reach (Revised)",
  "status": "active"                   // "active" | "archived" | "generating"
}
```

### `delete_world`

**Irreversible.** Deletes the world and ALL entities within it (all 13 subcollections are cascade-deleted).

```json
{ "worldId": "elysium-reach" }
```

### `list_worlds`

```json
{
  "limit": 20,                          // 1–100, default 20
  "startAfter": "optional-cursor"       // from previous response's nextPageToken
}
```

---

## API Reference — Entity CRUD (13 Types)

Every entity type follows an **identical CRUD pattern**. The tool names use this convention:

| Operation     | Tool Name                        | Required Args                  |
| ------------- | -------------------------------- | ------------------------------ |
| Create        | `create_{entity}`                | `worldId`, `name`, + fields    |
| Get           | `get_{entity}`                   | `worldId`, `id`                |
| Update        | `update_{entity}`                | `worldId`, `id`, + fields      |
| Delete        | `delete_{entity}`                | `worldId`, `id`                |
| List          | `list_{collection}`              | `worldId`, + optional filters  |
| Search        | `search_{collection}`            | `worldId`, `field`, `operator`, `value` |
| Batch Create  | `batch_create_{collection}`      | `worldId`, `items[]` (max 500) |

### Entity ↔ Collection Name Mapping

| Entity       | Singular (tools)  | Plural / Collection (tools) |
| ------------ | ----------------- | --------------------------- |
| Character    | `character`       | `characters`                |
| Faction      | `faction`         | `factions`                  |
| Planet       | `planet`          | `planets`                   |
| Location     | `location`        | `locations`                 |
| Technology   | `technology`      | `technologies`              |
| Vehicle      | `vehicle`         | `vehicles`                  |
| Species      | `species`         | `species`                   |
| Item         | `item`            | `items`                     |
| Quest        | `quest`           | `quests`                    |
| Event        | `event`           | `events`                    |
| Lore         | `lore`            | `lore`                      |
| Economy      | `economy`         | `economies`                 |
| Relationship | `relationship`    | `relationships`             |

### Generic CRUD Example (Characters)

**Create:**
```json
{
  "name": "create_character",
  "arguments": {
    "worldId": "elysium-reach",
    "name": "Commander Kira Voss",
    "role": "leader",
    "factionId": "federation-navy",
    "status": "alive"
  }
}
```

**Get:**
```json
{
  "name": "get_character",
  "arguments": { "worldId": "elysium-reach", "id": "commander-kira-voss" }
}
```

**Update:**
```json
{
  "name": "update_character",
  "arguments": {
    "worldId": "elysium-reach",
    "id": "commander-kira-voss",
    "status": "missing",
    "locationId": "sector-7"
  }
}
```

**Delete:**
```json
{
  "name": "delete_character",
  "arguments": { "worldId": "elysium-reach", "id": "commander-kira-voss" }
}
```

**List with filters:**
```json
{
  "name": "list_characters",
  "arguments": {
    "worldId": "elysium-reach",
    "factionId": "federation-navy",
    "status": "alive",
    "limit": 50
  }
}
```

**Search (flexible field query):**
```json
{
  "name": "search_characters",
  "arguments": {
    "worldId": "elysium-reach",
    "field": "role",
    "operator": "==",
    "value": "villain",
    "limit": 10
  }
}
```

**Batch Create:**
```json
{
  "name": "batch_create_characters",
  "arguments": {
    "worldId": "elysium-reach",
    "items": [
      { "name": "NPC Alpha", "role": "merchant" },
      { "name": "NPC Beta", "role": "guard" }
    ]
  }
}
```

### Search Operators

All `search_*` tools accept this flexible query format:

| Operator             | Description                                        | Example Value              |
| -------------------- | -------------------------------------------------- | -------------------------- |
| `==`                 | Equals                                             | `"alive"`                  |
| `!=`                 | Not equals                                         | `"dead"`                   |
| `<`                  | Less than                                          | `5`                        |
| `<=`                 | Less than or equal                                 | `10`                       |
| `>`                  | Greater than                                       | `0`                        |
| `>=`                 | Greater than or equal                              | `100`                      |
| `array-contains`     | Array field contains value                         | `"telepathic"`             |
| `in`                 | Value is one of (pass array)                       | `["alive", "missing"]`     |
| `array-contains-any` | Array field contains any of (pass array)            | `["brave", "cunning"]`     |

---

## Entity Schemas

### Characters

| Field              | Type                          | Required | Description                                          |
| ------------------ | ----------------------------- | -------- | ---------------------------------------------------- |
| `name`             | string                        | ✅        | Character name                                       |
| `title`            | string                        |          | Title/rank (e.g., "Commander")                       |
| `description`      | string                        |          | Physical and general description                     |
| `speciesId`        | string                        |          | Species ID                                           |
| `factionId`        | string                        |          | Primary faction ID                                   |
| `locationId`       | string                        |          | Current location ID                                  |
| `planetId`         | string                        |          | Current planet ID                                    |
| `role`             | string                        |          | "npc", "leader", "merchant", "villain", etc.         |
| `backstory`        | string                        |          | Character backstory                                  |
| `personality`      | string                        |          | Personality description                              |
| `traits`           | string[]                      |          | ["brave", "cunning", "loyal"]                        |
| `skills`           | Record\<string, number\>      |          | `{"swordsmanship": 8, "diplomacy": 5}`               |
| `stats`            | Record\<string, number\>      |          | `{"strength": 14, "intelligence": 10}`               |
| `inventoryItemIds` | string[]                      |          | Item IDs in inventory                                |
| `appearance`       | string                        |          | Detailed appearance                                  |
| `age`              | string                        |          | Age or age description                               |
| `status`           | enum                          |          | `alive` \| `dead` \| `missing` \| `unknown` \| `imprisoned` \| `exiled` (default: `alive`) |
| `dialogue`         | object                        |          | `{ greeting?, farewell?, topics[], personality_notes? }` |
| `motivations`      | string[]                      |          | Desires and motivations                              |
| `fears`            | string[]                      |          | Fears                                                |
| `secrets`          | string[]                      |          | Secrets (GM only)                                    |
| `tags`             | string[]                      |          | Tags for categorization                              |

**List filters:** `factionId`, `speciesId`, `locationId`, `planetId`, `role`, `status`

### Factions

| Field                    | Type     | Required | Description                                      |
| ------------------------ | -------- | -------- | ------------------------------------------------ |
| `name`                   | string   | ✅        | Faction name                                     |
| `description`            | string   |          | Detailed description                             |
| `type`                   | string   |          | "government", "military", "religious", "criminal", "guild", "corporation", "tribe", "resistance" |
| `alignment`              | string   |          | "lawful-good", "chaotic-evil", "neutral", etc.   |
| `territory`              | string   |          | Controlled territory description                 |
| `leaderCharacterId`      | string   |          | Leader character ID                              |
| `parentFactionId`        | string   |          | Parent faction ID (sub-factions)                 |
| `resources`              | string[] |          | Key resources controlled                         |
| `goals`                  | string[] |          | Major goals and ambitions                        |
| `values`                 | string[] |          | Core values                                      |
| `headquartersLocationId` | string   |          | HQ location ID                                   |
| `emblem`                 | string   |          | Emblem/symbol description                        |
| `motto`                  | string   |          | Motto or slogan                                  |
| `strength`               | string   |          | Military/political strength                      |
| `publicOpinion`          | string   |          | Public perception                                |
| `history`                | string   |          | Brief history                                    |
| `tags`                   | string[] |          | Tags                                             |

**List filters:** `type`, `alignment`

### Planets

| Field                  | Type            | Required | Description                                  |
| ---------------------- | --------------- | -------- | -------------------------------------------- |
| `name`                 | string          | ✅        | Planet name                                  |
| `description`          | string          |          | Detailed description                         |
| `type`                 | string          |          | "terrestrial", "gas-giant", "ice-world", "desert", "ocean", "moon", "station", "ringworld", "artificial" |
| `climate`              | string          |          | Primary climate                              |
| `atmosphere`           | string          |          | Atmospheric composition                      |
| `gravity`              | string          |          | Gravity level ("low", "standard", "0.8g")    |
| `population`           | string          |          | Population                                   |
| `dominantSpeciesId`    | string          |          | Dominant species ID                          |
| `controllingFactionId` | string          |          | Controlling faction ID                       |
| `resources`            | string[]        |          | Natural resources                            |
| `coordinates`          | `{x, y, z}`    |          | Galactic coordinates                         |
| `parentPlanetId`       | string          |          | Parent planet (if moon)                      |
| `systemName`           | string          |          | Star system name                             |
| `moons`                | string[]        |          | Moon names or IDs                            |
| `hazards`              | string[]        |          | Environmental hazards                        |
| `pointsOfInterest`     | string[]        |          | Notable features                             |
| `history`              | string          |          | Planetary history                            |
| `tags`                 | string[]        |          | Tags                                         |

**List filters:** `type`, `controllingFactionId`, `systemName`

### Locations

| Field                  | Type               | Required | Description                                    |
| ---------------------- | ------------------ | -------- | ---------------------------------------------- |
| `name`                 | string             | ✅        | Location name                                  |
| `description`          | string             |          | Detailed description                           |
| `type`                 | string             |          | "city", "dungeon", "outpost", "landmark", "building", "region", "district", "ruins", "fortress", "space-station", "port" |
| `planetId`             | string             |          | Planet this location is on                     |
| `parentLocationId`     | string             |          | Parent location (nested locations)             |
| `coordinates`          | `{x, y, z?}`      |          | Map coordinates                                |
| `population`           | string             |          | Population                                     |
| `controllingFactionId` | string             |          | Controlling faction ID                         |
| `dangerLevel`          | number (0–10)      |          | 0 = safe, 10 = lethal                          |
| `resources`            | string[]           |          | Available resources                            |
| `pointsOfInterest`     | string[]           |          | Notable features                               |
| `connectedLocationIds` | string[]           |          | Adjacent location IDs                          |
| `atmosphere`           | string             |          | Mood/atmosphere                                |
| `economy`              | string             |          | Economic description                           |
| `notableNpcIds`        | string[]           |          | Character IDs of notable NPCs here             |
| `history`              | string             |          | Location history                               |
| `tags`                 | string[]           |          | Tags                                           |

**List filters:** `planetId`, `type`, `controllingFactionId`, `parentLocationId`

### Technologies

| Field             | Type     | Required | Description                                      |
| ----------------- | -------- | -------- | ------------------------------------------------ |
| `name`            | string   | ✅        | Technology name                                  |
| `description`     | string   |          | What the technology does                         |
| `type`            | string   |          | "weapon", "transport", "medical", "communication", "energy", "manufacturing", "agricultural", "defense", "computing", "biotech" |
| `techLevel`       | string   |          | "primitive", "medieval", "industrial", "modern", "advanced", "futuristic", "quantum", "transcendent" |
| `originFactionId` | string   |          | Faction that developed it                        |
| `originSpeciesId` | string   |          | Species that developed it                        |
| `prerequisites`   | string[] |          | Technology ID prerequisites (tech trees)         |
| `effects`         | string   |          | What it enables                                  |
| `availability`    | enum     |          | `common` \| `uncommon` \| `rare` \| `restricted` \| `secret` \| `lost` \| `theoretical` (default: `common`) |
| `era`             | string   |          | Era developed                                    |
| `risks`           | string   |          | Usage risks                                      |
| `socialImpact`    | string   |          | Impact on society                                |
| `tags`            | string[] |          | Tags                                             |

**List filters:** `type`, `techLevel`, `availability`, `originFactionId`

### Vehicles

| Field                  | Type     | Required | Description                          |
| ---------------------- | -------- | -------- | ------------------------------------ |
| `name`                 | string   | ✅        | Vehicle name/model                   |
| `description`          | string   |          | Description                          |
| `type`                 | string   |          | "ship", "starship", "aircraft", "ground-vehicle", "mech", "mount", "submarine", "hover" |
| `class`                | string   |          | "fighter", "cruiser", "transport", "capital", "scout", "cargo" |
| `manufacturer`         | string   |          | Manufacturer name                    |
| `manufacturerFactionId`| string   |          | Manufacturer faction ID              |
| `speed`                | string   |          | Speed rating                         |
| `capacity`             | string   |          | Passenger/cargo capacity             |
| `armament`             | string[] |          | Weapons/defensive systems            |
| `technologyIds`        | string[] |          | Technology IDs used                  |
| `cost`                 | string   |          | Cost/value                           |
| `rarity`               | enum     |          | `common` \| `uncommon` \| `rare` \| `legendary` \| `unique` \| `prototype` (default: `common`) |
| `dimensions`           | string   |          | Size/dimensions                      |
| `crew`                 | string   |          | Crew requirements                    |
| `range`                | string   |          | Operating range                      |
| `specialFeatures`      | string[] |          | Special features                     |
| `history`              | string   |          | Notable history                      |
| `tags`                 | string[] |          | Tags                                 |

**List filters:** `type`, `class`, `manufacturerFactionId`, `rarity`

### Species

| Field           | Type                     | Required | Description                                  |
| --------------- | ------------------------ | -------- | -------------------------------------------- |
| `name`          | string                   | ✅        | Species name                                 |
| `description`   | string                   |          | Description                                  |
| `type`          | string                   |          | "sentient", "beast", "synthetic", "hybrid", "undead", "elemental", "plant", "fungal" |
| `homePlanetId`  | string                   |          | Homeworld planet ID                          |
| `physiology`    | string                   |          | Physical characteristics                     |
| `traits`        | string[]                 |          | ["night-vision", "telepathic", "amphibious"] |
| `abilities`     | string[]                 |          | Special abilities                            |
| `culture`       | string                   |          | Cultural overview                            |
| `governance`    | string                   |          | Governance model                             |
| `lifespan`      | string                   |          | Average lifespan                             |
| `population`    | string                   |          | Population estimate                          |
| `language`      | string                   |          | Primary language(s)                          |
| `diet`          | string                   |          | Dietary requirements                         |
| `reproduction`  | string                   |          | Reproduction details                         |
| `weaknesses`    | string[]                 |          | Known weaknesses                             |
| `relations`     | Record\<string, string\> |          | Disposition toward other species             |
| `history`       | string                   |          | Species history                              |
| `tags`          | string[]                 |          | Tags                                         |

**List filters:** `type`, `homePlanetId`

### Items

| Field            | Type     | Required | Description                              |
| ---------------- | -------- | -------- | ---------------------------------------- |
| `name`           | string   | ✅        | Item name                                |
| `description`    | string   |          | Description                              |
| `type`           | string   |          | "weapon", "armor", "consumable", "artifact", "tool", "currency", "material", "quest-item", "key" |
| `rarity`         | enum     |          | `common` \| `uncommon` \| `rare` \| `epic` \| `legendary` \| `unique` \| `artifact` (default: `common`) |
| `value`          | number   |          | Monetary value                           |
| `weight`         | number   |          | Weight/encumbrance                       |
| `effects`        | string[] |          | Effects when used/equipped               |
| `requirements`   | string   |          | Usage requirements                       |
| `craftingRecipe`  | object   |          | `{ ingredients: [{itemId?, name, quantity}], skillRequired?, facility? }` |
| `technologyId`   | string   |          | Associated technology ID                 |
| `loreText`       | string   |          | In-world flavor text                     |
| `stackable`      | boolean  |          | Can be stacked (default: false)          |
| `maxStack`       | number   |          | Max stack size                           |
| `tags`           | string[] |          | Tags                                     |

**List filters:** `type`, `rarity`

### Quests

| Field              | Type     | Required | Description                          |
| ------------------ | -------- | -------- | ------------------------------------ |
| `name`             | string   | ✅        | Quest name                           |
| `description`      | string   |          | Description                          |
| `type`             | string   |          | "main", "side", "bounty", "fetch", "escort", "exploration", "puzzle", "repeatable" |
| `giverCharacterId` | string   |          | Quest giver character ID             |
| `locationId`       | string   |          | Location ID                          |
| `prerequisites`    | string[] |          | Quest IDs that must be done first    |
| `objectives`       | object[] |          | `[{description, type?, targetId?, quantity?, completed (default false), optional (default false)}]` |
| `rewards`          | object[] |          | `[{type, itemId?, amount?, factionId?, description?}]` |
| `difficulty`       | string   |          | "trivial", "easy", "medium", "hard", "legendary" |
| `status`           | enum     |          | `available` \| `active` \| `completed` \| `failed` \| `hidden` (default: `available`) |
| `chainQuestIds`    | string[] |          | Same-chain quest IDs                 |
| `levelRequirement` | number   |          | Minimum level                        |
| `timeLimit`        | string   |          | Time limit                           |
| `consequences`     | string   |          | Consequences of completion/failure   |
| `loreText`         | string   |          | In-world lore text                   |
| `tags`             | string[] |          | Tags                                 |

**List filters:** `type`, `status`, `giverCharacterId`, `locationId`, `difficulty`

### Events

| Field             | Type     | Required | Description                            |
| ----------------- | -------- | -------- | -------------------------------------- |
| `name`            | string   | ✅        | Event name/title                       |
| `description`     | string   |          | What happened                          |
| `type`            | string   |          | "battle", "discovery", "founding", "disaster", "treaty", "assassination", "revolution", "migration" |
| `date`            | string   |          | In-world date                          |
| `sortOrder`       | number   |          | Numeric timeline position (lower = earlier) |
| `era`             | string   |          | Historical era                         |
| `significance`    | enum     |          | `minor` \| `moderate` \| `major` \| `world-changing` (default: `moderate`) |
| `participantIds`  | object[] |          | `[{type, id, role?}]`                  |
| `locationId`      | string   |          | Location ID                            |
| `planetId`        | string   |          | Planet ID                              |
| `consequences`    | string[] |          | Resulting consequences                 |
| `relatedEventIds` | string[] |          | Related event IDs                      |
| `outcome`         | string   |          | Result of the event                    |
| `casualties`      | string   |          | Casualties/losses                      |
| `tags`            | string[] |          | Tags                                   |

**List filters:** `type`, `era`, `significance`, `planetId`, `locationId`

### Lore

| Field              | Type     | Required | Description                          |
| ------------------ | -------- | -------- | ------------------------------------ |
| `title`            | string   | ✅        | Lore title                           |
| `content`          | string   | ✅        | Full text body of knowledge          |
| `category`         | string   |          | "myth", "history", "science", "religion", "law", "culture", "prophecy", "legend" |
| `tags`             | string[] |          | Tags                                 |
| `relatedEntityIds` | object[] |          | `[{type, id}]`                       |
| `era`              | string   |          | Era/time period                      |
| `confidentiality`  | enum     |          | `public` \| `faction-secret` \| `lost` \| `forbidden` \| `restricted` \| `classified` (default: `public`) |
| `author`           | string   |          | In-world author                      |
| `reliability`      | enum     |          | `verified` \| `mostly-true` \| `disputed` \| `legend` \| `propaganda` \| `false` (default: `verified`) |
| `language`         | string   |          | Original language/script             |

**List filters:** `category`, `era`, `confidentiality`, `reliability`

### Economies

| Field                | Type     | Required | Description                        |
| -------------------- | -------- | -------- | ---------------------------------- |
| `name`               | string   | ✅        | Economy name                       |
| `description`        | string   |          | Description                        |
| `type`               | string   |          | "planetary", "faction", "regional", "black-market", "interstellar", "tribal" |
| `currencyName`       | string   |          | Currency name                      |
| `currencySymbol`     | string   |          | Currency symbol                    |
| `scope`              | object   |          | `{planetId?, factionId?, locationId?}` |
| `resources`          | object[] |          | `[{itemId?, name, basePrice?, supply?, demand?, description?}]` — supply/demand: "surplus" \| "abundant" \| "stable" \| "scarce" \| "critical" |
| `tradeRoutes`        | object[] |          | `[{fromLocationId, toLocationId, goods[], risk, description?}]` — risk: "safe" \| "low" \| "moderate" \| "high" \| "extreme" |
| `taxRate`            | string   |          | Tax rate                           |
| `wealthDistribution` | string   |          | Wealth distribution description    |
| `economicSystem`     | string   |          | "free-market", "command", "feudal", "mixed", "barter", "post-scarcity" |
| `majorIndustries`    | string[] |          | Major industries                   |
| `tags`               | string[] |          | Tags                               |

**List filters:** `type`, `economicSystem`

### Relationships

| Field           | Type                     | Required | Description                                    |
| --------------- | ------------------------ | -------- | ---------------------------------------------- |
| `type`          | string                   | ✅        | See relationship types below                   |
| `sourceType`    | string                   | ✅        | Source entity collection (e.g., "characters")  |
| `sourceId`      | string                   | ✅        | Source entity ID                               |
| `targetType`    | string                   | ✅        | Target entity collection                       |
| `targetId`      | string                   | ✅        | Target entity ID                               |
| `strength`      | number (1–10)            |          | 1 = weak, 10 = absolute                       |
| `description`   | string                   |          | Description of the relationship                |
| `metadata`      | Record\<string, any\>    |          | Additional metadata (e.g., `{role: "commander", since: "Year 342"}`) |
| `bidirectional` | boolean                  |          | Whether it goes both ways (default: false)     |
| `status`        | enum                     |          | `active` \| `inactive` \| `broken` \| `secret` \| `historical` (default: `active`) |
| `tags`          | string[]                 |          | Tags                                           |

**Relationship types:** `ALLIED_WITH`, `ENEMY_OF`, `MEMBER_OF`, `LEADER_OF`, `LOCATED_AT`, `LOCATED_ON`, `PARENT_OF`, `CHILD_OF`, `TRADES_WITH`, `CONTROLS`, `CREATED_BY`, `OWNS`, `SERVES`, `WORSHIPS`, `STUDIES`, `MANUFACTURES`, `SUPPLIES`, `RIVALS`, `MENTORS`, `PROTECTS`, `THREATENS`, `INHABITS`, `CUSTOM`

**List filters:** `type`, `sourceType`, `targetType`, `status`

---

## API Reference — Special Tools

### Relationship Graph Traversal

#### `find_entity_relationships`

Find all relationships connected to a specific entity (both incoming and outgoing).

```json
{
  "name": "find_entity_relationships",
  "arguments": {
    "worldId": "elysium-reach",
    "entityId": "commander-kira-voss",
    "entityType": "characters",              // optional — narrows the search
    "relationshipType": "MEMBER_OF",         // optional — filter by type
    "direction": "both",                     // "outgoing" | "incoming" | "both" (default)
    "limit": 50                              // 1–100, default 50
  }
}
```

### Timeline

#### `get_timeline`

Get chronologically sorted events for a world.

```json
{
  "name": "get_timeline",
  "arguments": {
    "worldId": "elysium-reach",
    "era": "Golden Age",                     // optional — filter by era
    "significance": "major",                 // optional — "major" returns major + world-changing
    "limit": 50,                             // default 50
    "startAfter": "cursor"                   // optional pagination
  }
}
```

### Game Runtime

#### `get_npc_context`

Get rich context for an NPC — their faction, species, location, planet, relationships, and inventory. Ideal for generating dialogue or behavior.

```json
{
  "name": "get_npc_context",
  "arguments": {
    "worldId": "elysium-reach",
    "characterId": "commander-kira-voss"
  }
}
```

#### `get_location_context`

Get rich context for a location — its planet, present NPCs, available quests, recent events, and controlling faction.

```json
{
  "name": "get_location_context",
  "arguments": {
    "worldId": "elysium-reach",
    "locationId": "nexus-station"
  }
}
```

#### `get_faction_context`

Get rich context for a faction — its members, relationships, controlled territories, and technologies.

```json
{
  "name": "get_faction_context",
  "arguments": {
    "worldId": "elysium-reach",
    "factionId": "federation-navy"
  }
}
```

#### `get_world_summary`

Get a high-level overview of a world — entity counts, key factions, major planets, notable characters, recent events, and species.

```json
{
  "name": "get_world_summary",
  "arguments": {
    "worldId": "elysium-reach"
  }
}
```

#### `record_game_event`

Record a gameplay event and optionally update related entities atomically.

```json
{
  "name": "record_game_event",
  "arguments": {
    "worldId": "elysium-reach",
    "event": {
      "name": "Battle of Nexus Station",
      "description": "The Federation Navy clashed with the Syndicate over control of Nexus Station.",
      "type": "battle",
      "date": "Year 3042, Month 7",
      "sortOrder": 3042.7,
      "significance": "major",
      "participantIds": [
        { "type": "factions", "id": "federation-navy", "role": "attacker" },
        { "type": "factions", "id": "syndicate", "role": "defender" }
      ],
      "locationId": "nexus-station",
      "consequences": ["Federation gains control of Nexus Station", "Syndicate retreats to Outer Rim"]
    },
    "entityUpdates": [
      {
        "collection": "locations",
        "id": "nexus-station",
        "updates": { "controllingFactionId": "federation-navy" }
      }
    ]
  }
}
```

#### `update_game_state`

Batch-update multiple entities across collections in a single atomic operation (up to 500 updates).

```json
{
  "name": "update_game_state",
  "arguments": {
    "worldId": "elysium-reach",
    "updates": [
      { "collection": "characters", "id": "kira-voss", "updates": { "locationId": "nexus-station" } },
      { "collection": "characters", "id": "enemy-leader", "updates": { "status": "dead" } },
      { "collection": "locations", "id": "nexus-station", "updates": { "controllingFactionId": "federation-navy" } }
    ]
  }
}
```

#### `query_world`

The most versatile search tool — query any entity type with flexible filters, sorting, and pagination.

```json
{
  "name": "query_world",
  "arguments": {
    "worldId": "elysium-reach",
    "entityType": "characters",
    "filters": [
      { "field": "status", "operator": "==", "value": "alive" },
      { "field": "role", "operator": "in", "value": ["leader", "villain"] }
    ],
    "sortBy": { "field": "name", "direction": "asc" },
    "limit": 20
  }
}
```

**Supported `entityType` values:** `characters`, `factions`, `planets`, `locations`, `items`, `quests`, `events`, `lore`, `technologies`, `vehicles`, `species`, `economies`, `relationships`

---

## Pagination

All list/search tools support cursor-based pagination:

1. Send the initial request with a `limit` (default: 20, max: 100)
2. The response includes `nextPageToken` if more results exist
3. Pass `nextPageToken` as `startAfter` in the next request

```typescript
// Example: paginate through all characters
async function getAllCharacters(worldId: string) {
  const all: any[] = [];
  let cursor: string | undefined;

  do {
    const result = await callTool("list_characters", {
      worldId,
      limit: 100,
      startAfter: cursor,
    });
    if (result.success && result.data) {
      all.push(...result.data);
      cursor = result.nextPageToken ?? undefined;
    } else {
      break;
    }
  } while (cursor);

  return all;
}
```

---

## Error Handling

### HTTP-Level Errors

| Code  | Cause                                       |
| ----- | ------------------------------------------- |
| `401` | Missing `x-api-key` header                  |
| `403` | Invalid API key                              |
| `405` | Wrong HTTP method (GET/DELETE on `/mcp`)     |
| `500` | Internal server error                        |

### JSON-RPC Errors

Returned inside the SSE response:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal server error",
    "data": "Detailed error message"
  },
  "id": 1
}
```

### Tool-Level Errors

Returned inside the parsed tool result:

```json
{
  "success": false,
  "error": "Character not found"
}
```

### React Error Handling Pattern

```typescript
try {
  const result = await callTool("get_character", { worldId, id: characterId });

  if (!result.success) {
    // Tool-level error (entity not found, validation error, etc.)
    console.error("Tool error:", result.error);
    return;
  }

  // Use result.data
} catch (err) {
  // Network or HTTP-level error
  console.error("Request failed:", err);
}
```

---

## Firestore Data Structure

```
/worlds/{worldId}                          ← Top-level collection
  ├── id, name, genre, description, status, tags, settings
  ├── entityCounts: { characters: N, factions: N, ... }
  ├── createdAt, updatedAt
  │
  ├── /characters/{characterId}            ← Subcollections
  ├── /factions/{factionId}
  ├── /planets/{planetId}
  ├── /locations/{locationId}
  ├── /technologies/{technologyId}
  ├── /vehicles/{vehicleId}
  ├── /species/{speciesId}
  ├── /items/{itemId}
  ├── /quests/{questId}
  ├── /events/{eventId}
  ├── /lore/{loreId}
  ├── /economies/{economyId}
  └── /relationships/{relationshipId}
```

All entities live as subcollections under their parent world. The world document maintains `entityCounts` which auto-increment/decrement on create/delete.

---

## Local Development with Emulators

### Start Emulators

```bash
cd worldbuilder-server
firebase emulators:start
```

| Service    | Port   |
| ---------- | ------ |
| Functions  | `5001` |
| Firestore  | `8080` |
| Emulator UI| `4000` |

### Local API URL

When using emulators, the base URL changes to:

```
http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1/mcp/mcp
```

The `WORLDBUILDER_API_KEY` is not required when running locally without the secret configured — all requests are allowed through.

### Environment Variables for React

Create a `.env` file in your React project:

```env
# Production
VITE_WORLDBUILDER_API_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/mcp/mcp
VITE_WORLDBUILDER_API_KEY=your-api-key

# Local development (override in .env.local)
VITE_WORLDBUILDER_API_URL=http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1/mcp/mcp
VITE_WORLDBUILDER_API_KEY=any-value
```

---

## Complete Tool Reference

| Tool Name                      | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| `create_world`                 | Create a new game world                                  |
| `get_world`                    | Get a world by ID                                        |
| `update_world`                 | Update world metadata/settings                           |
| `delete_world`                 | Delete a world and all entities (irreversible)            |
| `list_worlds`                  | List all worlds with pagination                          |
| `create_{entity}`              | Create entity (×13 types)                                |
| `get_{entity}`                 | Get entity by ID (×13 types)                             |
| `update_{entity}`              | Update entity (×13 types)                                |
| `delete_{entity}`              | Delete entity (×13 types)                                |
| `list_{collection}`            | List entities with filters (×13 types)                   |
| `search_{collection}`          | Search entities with flexible queries (×13 types)        |
| `batch_create_{collection}`    | Batch create up to 500 entities (×13 types)              |
| `find_entity_relationships`    | Find all relationships for an entity                     |
| `get_timeline`                 | Get chronological event timeline                         |
| `get_npc_context`              | Get rich NPC context (faction, species, inventory, etc.) |
| `get_location_context`         | Get rich location context (NPCs, quests, events, etc.)   |
| `get_faction_context`          | Get rich faction context (members, territories, etc.)    |
| `get_world_summary`            | High-level world overview with counts                    |
| `record_game_event`            | Record event + optional entity updates (atomic)          |
| `update_game_state`            | Batch update up to 500 entities (atomic)                 |
| `query_world`                  | Flexible query on any entity type                        |

**Total: 96 tools** (5 world + 91 entity CRUD [7 × 13] + 7 special)
