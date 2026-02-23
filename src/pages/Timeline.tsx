import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  alpha,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import { useState } from "react";
import { useToolQuery } from "../hooks/useWorldbuilder";
import LoadingState from "../components/LoadingState";
import type { TimelineEvent } from "../types";

export default function TimelinePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const [era, setEra] = useState("");
  const [significance, setSignificance] = useState("");

  const args: Record<string, unknown> = {
    worldId: worldId!,
    limit: 100,
    sortBy: "sortOrder",
    sortDirection: "asc",
  };
  if (era) args.era = era;
  if (significance) args.significance = significance;

  const { data: rawData, loading, error, refetch } = useToolQuery<TimelineEvent[]>(
    "list_events",
    args,
    [worldId, era, significance]
  );

  // Sort chronologically: primary by sortOrder, then extract numeric year from date
  const data = rawData
    ? [...rawData].sort((a, b) => {
        const orderA = a.sortOrder;
        const orderB = b.sortOrder;
        // If both have sortOrder, compare numerically
        if (orderA != null && orderB != null) return orderA - orderB;
        // If only one has sortOrder, it comes first
        if (orderA != null) return -1;
        if (orderB != null) return 1;
        // Fall back to extracting numeric year from date string (e.g. "Year 3042, Month 7")
        const yearA = parseYearFromDate(a.date);
        const yearB = parseYearFromDate(b.date);
        return yearA - yearB;
      })
    : null;

  // Collect unique eras for filter
  const eras = [...new Set(data?.map((e) => e.era).filter(Boolean) as string[])];

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <TimelineIcon color="secondary" sx={{ fontSize: 32 }} />
        <Typography variant="h4">Timeline</Typography>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        {eras.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Era</InputLabel>
            <Select value={era} label="Era" onChange={(e) => setEra(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {eras.map((e) => (
                <MenuItem key={e} value={e}>
                  {e}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Significance</InputLabel>
          <Select value={significance} label="Significance" onChange={(e) => setSignificance(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="minor">Minor</MenuItem>
            <MenuItem value="moderate">Moderate</MenuItem>
            <MenuItem value="major">Major</MenuItem>
            <MenuItem value="world-changing">World-Changing</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <LoadingState loading={loading} error={error} onRetry={refetch}>
        {data && data.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={6}>
            No events found.
          </Typography>
        )}

        {data?.map((event, i) => (
          <Box key={event.id} display="flex" mb={0}>
            {/* Timeline spine */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mr: 2, minWidth: 24 }}>
              <Box
                sx={(t) => ({
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: significanceColor(event.significance),
                  border: `2px solid ${alpha(t.palette.background.paper, 0.5)}`,
                  zIndex: 1,
                })}
              />
              {i < data.length - 1 && (
                <Box
                  sx={(t) => ({
                    width: 2,
                    flex: 1,
                    bgcolor: alpha(t.palette.divider, 0.4),
                  })}
                />
              )}
            </Box>

            {/* Event card */}
            <Paper sx={{ p: 2, mb: 2, flex: 1 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {event.name}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  {event.date && <Chip label={event.date} size="small" variant="outlined" />}
                  {event.era && <Chip label={event.era} size="small" />}
                  {event.significance && (
                    <Chip
                      label={event.significance}
                      size="small"
                      sx={{
                        bgcolor: alpha(significanceColor(event.significance), 0.2),
                        color: significanceColor(event.significance),
                        textTransform: "capitalize",
                      }}
                    />
                  )}
                </Stack>
              </Box>

              {event.type && (
                <Chip label={event.type} size="small" sx={{ mt: 0.5, textTransform: "capitalize" }} />
              )}

              {event.description && (
                <Typography variant="body2" color="text.secondary" mt={1}>
                  {event.description}
                </Typography>
              )}

              {event.outcome && (
                <Typography variant="body2" mt={1}>
                  <strong>Outcome:</strong> {event.outcome}
                </Typography>
              )}

              {event.consequences && event.consequences.length > 0 && (
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Consequences:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mt={0.5}>
                    {event.consequences.map((c, j) => (
                      <Chip key={j} label={c} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}
            </Paper>
          </Box>
        ))}
      </LoadingState>
    </Box>
  );
}

function significanceColor(sig?: string): string {
  switch (sig) {
    case "world-changing":
      return "#ff1744";
    case "major":
      return "#ff9100";
    case "moderate":
      return "#00e5ff";
    case "minor":
    default:
      return "#90a4ae";
  }
}

/** Extract the first number from a date string like "Year 3042, Month 7" → 3042 */
function parseYearFromDate(date?: string): number {
  if (!date) return Infinity;
  const match = date.match(/(\d+)/);
  return match ? Number(match[1]) : Infinity;
}
