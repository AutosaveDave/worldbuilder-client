import { useParams, useLocation } from "react-router-dom";
import { Box, Typography, Divider, Chip, Stack, Paper, Grid, alpha } from "@mui/material";
import { useToolQuery } from "../hooks/useWorldbuilder";
import LoadingState from "../components/LoadingState";
import EntityFieldDisplay from "../components/EntityFieldDisplay";
import type { Entity, EntityType } from "../types";
import { ENTITY_SINGULAR } from "../types";

/** Fields to display prominently at the top */
const TOP_FIELDS = ["name", "title", "description", "type", "status", "role", "category"];

export default function EntityDetail() {
  const { worldId, entityType, entityId } = useParams<{
    worldId: string;
    entityType: string;
    entityId: string;
  }>();
  const location = useLocation();
  const et = entityType as EntityType;
  const singular = ENTITY_SINGULAR[et];

  // If navigated with state, use it; otherwise fetch
  const passedEntity = (location.state as { entity?: Entity })?.entity;

  const { data, loading, error, refetch } = useToolQuery<Entity>(
    `get_${singular}`,
    { worldId: worldId!, id: entityId! },
    [worldId, entityType, entityId]
  );

  const entity = data ?? passedEntity;

  const otherEntries = entity
    ? Object.entries(entity).filter(
        ([k]) => !TOP_FIELDS.includes(k) && !["id", "createdAt", "updatedAt", "worldId"].includes(k)
      )
    : [];

  return (
    <Box>
      <LoadingState loading={loading && !passedEntity} error={error} onRetry={refetch}>
        {entity && (
          <>
            {/* Header */}
            <Box mb={3}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Chip
                  label={singular}
                  size="small"
                  sx={(t) => ({
                    bgcolor: alpha(t.palette.primary.main, 0.15),
                    color: t.palette.primary.light,
                    textTransform: "capitalize",
                  })}
                />
                <Typography variant="caption" color="text.secondary">
                  {entity.id}
                </Typography>
              </Stack>

              <Typography variant="h4">{entity.name || entity.title || entity.id}</Typography>

              {entity.description && (
                <Typography variant="body1" color="text.secondary" mt={1} sx={{ whiteSpace: "pre-wrap" }}>
                  {entity.description as string}
                </Typography>
              )}

              <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
                {entity.type ? <Chip label={String(entity.type)} size="small" color="secondary" /> : null}
                {entity.status ? (
                  <Chip
                    label={String(entity.status)}
                    size="small"
                    color={entity.status === "alive" || entity.status === "active" ? "success" : "default"}
                    sx={{ textTransform: "capitalize" }}
                  />
                ) : null}
                {entity.role ? <Chip label={String(entity.role)} size="small" variant="outlined" /> : null}
              </Stack>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Detail fields */}
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" mb={2}>
                    Details
                  </Typography>
                  {otherEntries.map(([key, value]) => (
                    <EntityFieldDisplay key={key} label={key} value={value} />
                  ))}
                  {otherEntries.length === 0 && (
                    <Typography color="text.secondary">No additional details.</Typography>
                  )}
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                {/* Tags */}
                {entity.tags && (entity.tags as string[]).length > 0 && (
                  <Paper sx={{ p: 3, mb: 2 }}>
                    <Typography variant="h6" mb={1}>
                      Tags
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {(entity.tags as string[]).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Paper>
                )}

                {/* Metadata */}
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" mb={1}>
                    Metadata
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    ID: {entity.id}
                  </Typography>
                  {entity.createdAt && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Created: {new Date(entity.createdAt).toLocaleString()}
                    </Typography>
                  )}
                  {entity.updatedAt && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Updated: {new Date(entity.updatedAt).toLocaleString()}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </LoadingState>
    </Box>
  );
}
