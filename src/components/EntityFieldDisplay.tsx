import { Typography, Box, Chip, Stack, alpha, IconButton, Tooltip } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { ENTITY_SINGULAR } from "../types";
import type { EntityType } from "../types";

/** Reverse map: singular tool name → entity collection type */
const SINGULAR_TO_TYPE: Record<string, EntityType> = Object.fromEntries(
  Object.entries(ENTITY_SINGULAR).map(([type, singular]) => [singular, type as EntityType])
) as Record<string, EntityType>;

/**
 * Given a field name like "factionId" or "starSystemId", return the
 * entity collection type (e.g. "factions", "star-systems") or null.
 */
function fieldToEntityType(fieldName: string): EntityType | null {
  if (!fieldName.endsWith("Id") || fieldName === "id" || fieldName === "worldId") return null;
  const singular = fieldName.slice(0, -2); // strip "Id"
  const snakeCase = singular.replace(/([A-Z])/g, "_$1").toLowerCase();
  return SINGULAR_TO_TYPE[snakeCase] ?? null;
}

interface Props {
  label: string;
  value: unknown;
  worldId?: string;
  /** Extra entity data – used to resolve generic refs like sourceType+sourceId */
  entityData?: Record<string, unknown>;
}

/**
 * Renders a key-value field from an entity with smart formatting.
 */
export default function EntityField({ label, value, worldId, entityData }: Props) {
  if (value === null || value === undefined || value === "") return null;

  // Skip internal fields
  if (["id", "createdAt", "updatedAt", "worldId"].includes(label)) return null;

  // Resolve entity reference for *Id fields
  let refEntityType = fieldToEntityType(label);

  // Handle generic refs: if field is "sourceId"/"targetId" etc., look for a sibling "sourceType"/"targetType"
  if (!refEntityType && label.endsWith("Id") && typeof value === "string" && entityData) {
    const prefix = label.slice(0, -2); // e.g. "source"
    const typeField = entityData[`${prefix}Type`];
    if (typeof typeField === "string") {
      // typeField might be singular like "character" or plural like "characters"
      const asPlural = SINGULAR_TO_TYPE[typeField]
        ? SINGULAR_TO_TYPE[typeField]
        : (Object.keys(ENTITY_SINGULAR).includes(typeField) ? typeField as EntityType : null);
      if (asPlural) refEntityType = asPlural;
    }
  }

  const refId = refEntityType && typeof value === "string" ? value : null;

  const renderValue = () => {
    // Arrays → chips
    if (Array.isArray(value)) {
      if (value.length === 0) return null;

      // Array of objects
      if (typeof value[0] === "object") {
        return (
          <Box component="pre" sx={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", m: 0 }}>
            {JSON.stringify(value, null, 2)}
          </Box>
        );
      }

      return (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {value.map((v, i) => (
            <Chip key={i} label={String(v)} size="small" variant="outlined" />
          ))}
        </Stack>
      );
    }

    // Objects → formatted JSON
    if (typeof value === "object") {
      return (
        <Box
          component="pre"
          sx={(t) => ({
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
            m: 0,
            p: 1.5,
            borderRadius: 1,
            bgcolor: alpha(t.palette.primary.main, 0.05),
          })}
        >
          {JSON.stringify(value, null, 2)}
        </Box>
      );
    }

    // Boolean
    if (typeof value === "boolean") {
      return (
        <Chip
          label={value ? "Yes" : "No"}
          size="small"
          color={value ? "success" : "default"}
        />
      );
    }

    // Long text
    if (typeof value === "string" && value.length > 120) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
          {value}
        </Typography>
      );
    }

    return (
      <Typography variant="body2" color="text.primary">
        {String(value)}
      </Typography>
    );
  };

  const rendered = renderValue();
  if (!rendered) return null;

  const refButton =
    refId && worldId && refEntityType ? (
      <Tooltip title={`Open ${refEntityType.replace("-", " ")} detail`} arrow>
        <IconButton
          size="small"
          color="primary"
          onClick={() =>
            window.open(
              `${window.location.origin}${window.location.pathname}#/worlds/${worldId}/${refEntityType}/${refId}`,
              "_blank"
            )
          }
          sx={{ ml: 0.5 }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : null;

  return (
    <Box mb={2}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 1.5, fontSize: "0.65rem" }}
      >
        {formatLabel(label)}
      </Typography>
      <Box mt={0.25} display="flex" alignItems="center">
        {rendered}
        {refButton}
      </Box>
    </Box>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .toUpperCase();
}
