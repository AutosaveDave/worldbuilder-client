import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  alpha,
} from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import SearchIcon from "@mui/icons-material/Search";
import { useToolQuery } from "../hooks/useWorldbuilder";
import LoadingState from "../components/LoadingState";
import type { Relationship } from "../types";
import { ENTITY_TYPES, ENTITY_LABELS } from "../types";

const RELATIONSHIP_TYPES = [
  "ALLIED_WITH", "ENEMY_OF", "MEMBER_OF", "LEADER_OF", "LOCATED_AT",
  "LOCATED_ON", "PARENT_OF", "CHILD_OF", "TRADES_WITH", "CONTROLS",
  "CREATED_BY", "OWNS", "SERVES", "WORSHIPS", "STUDIES", "MANUFACTURES",
  "SUPPLIES", "RIVALS", "MENTORS", "PROTECTS", "THREATENS", "INHABITS", "CUSTOM",
];

export default function RelationshipsPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();

  const [entityId, setEntityId] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [relType, setRelType] = useState("");
  const [searched, setSearched] = useState(false);

  const shouldFetch = searched && !!entityId;

  const args: Record<string, unknown> = {
    worldId: worldId!,
    entityId,
    limit: 100,
  };
  if (entityTypeFilter) args.entityType = entityTypeFilter;
  if (relType) args.relationshipType = relType;

  const { data, loading, error, refetch } = useToolQuery<Relationship[]>(
    "find_entity_relationships",
    shouldFetch ? args : { worldId: worldId!, entityId: "__none__" },
    [worldId, entityId, entityTypeFilter, relType, searched]
  );

  const handleSearch = () => {
    setSearched(true);
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <HubIcon color="secondary" sx={{ fontSize: 32 }} />
        <Typography variant="h4">Relationship Graph</Typography>
      </Box>

      {/* Search controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" mb={2}>
          Find relationships for an entity
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-end">
          <TextField
            label="Entity ID"
            size="small"
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              setSearched(false);
            }}
            sx={{ minWidth: 250 }}
            placeholder="e.g. commander-kira-voss"
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Entity Type</InputLabel>
            <Select
              value={entityTypeFilter}
              label="Entity Type"
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setSearched(false);
              }}
            >
              <MenuItem value="">Any</MenuItem>
              {ENTITY_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Relationship Type</InputLabel>
            <Select
              value={relType}
              label="Relationship Type"
              onChange={(e) => {
                setRelType(e.target.value);
                setSearched(false);
              }}
            >
              <MenuItem value="">Any</MenuItem>
              {RELATIONSHIP_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={!entityId}
          >
            Search
          </Button>
        </Stack>
      </Paper>

      {/* Results */}
      {shouldFetch && (
        <LoadingState loading={loading} error={error} onRetry={refetch}>
          {data && data.length === 0 && (
            <Typography color="text.secondary" textAlign="center" py={6}>
              No relationships found for this entity.
            </Typography>
          )}

          <Grid container spacing={2}>
            {data?.map((rel) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={rel.id}>
                <Paper sx={{ p: 2, height: "100%" }}>
                  {/* Relationship type badge */}
                  <Chip
                    label={(rel.type || "CUSTOM").replace(/_/g, " ")}
                    size="small"
                    color="primary"
                    sx={{ mb: 1.5, fontWeight: 600 }}
                  />

                  {/* Source → Target */}
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Chip
                      label={`${rel.sourceType}/${rel.sourceId}`}
                      size="small"
                      variant="outlined"
                      clickable
                      onClick={() =>
                        navigate(
                          `/worlds/${worldId}/${rel.sourceType}/${rel.sourceId}`
                        )
                      }
                    />
                    <Typography variant="body2" color="text.secondary">
                      {rel.bidirectional ? "⟷" : "→"}
                    </Typography>
                    <Chip
                      label={`${rel.targetType}/${rel.targetId}`}
                      size="small"
                      variant="outlined"
                      clickable
                      onClick={() =>
                        navigate(
                          `/worlds/${worldId}/${rel.targetType}/${rel.targetId}`
                        )
                      }
                    />
                  </Box>

                  {/* Strength */}
                  {rel.strength !== undefined && (
                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        Strength: {rel.strength}/10
                      </Typography>
                      <Box
                        sx={(t) => ({
                          height: 4,
                          borderRadius: 2,
                          bgcolor: alpha(t.palette.divider, 0.3),
                          mt: 0.5,
                        })}
                      >
                        <Box
                          sx={{
                            height: "100%",
                            width: `${((rel.strength ?? 0) / 10) * 100}%`,
                            borderRadius: 2,
                            bgcolor: "primary.main",
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  {rel.description && (
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      {rel.description}
                    </Typography>
                  )}

                  {rel.status && (
                    <Chip
                      label={rel.status}
                      size="small"
                      sx={{ mt: 1, textTransform: "capitalize" }}
                      color={rel.status === "active" ? "success" : "default"}
                    />
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </LoadingState>
      )}
    </Box>
  );
}
