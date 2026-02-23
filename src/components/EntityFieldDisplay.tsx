import { Typography, Box, Chip, Stack, alpha } from "@mui/material";

interface Props {
  label: string;
  value: unknown;
}

/**
 * Renders a key-value field from an entity with smart formatting.
 */
export default function EntityField({ label, value }: Props) {
  if (value === null || value === undefined || value === "") return null;

  // Skip internal fields
  if (["id", "createdAt", "updatedAt", "worldId"].includes(label)) return null;

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

  return (
    <Box mb={2}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 1.5, fontSize: "0.65rem" }}
      >
        {formatLabel(label)}
      </Typography>
      <Box mt={0.25}>{rendered}</Box>
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
