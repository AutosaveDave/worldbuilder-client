import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, Grid, Button, TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useToolQuery } from "../hooks/useWorldbuilder";
import LoadingState from "../components/LoadingState";
import EntityCard from "../components/EntityCard";
import type { Entity, EntityType } from "../types";
import { ENTITY_LABELS } from "../types";

export default function EntityList() {
  const { worldId, entityType } = useParams<{ worldId: string; entityType: string }>();
  const et = entityType as EntityType;
  const label = ENTITY_LABELS[et] ?? entityType;

  const [page, setPage] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch, nextPageToken, totalCount } = useToolQuery<Entity[]>(
    `list_${entityType}`,
    { worldId: worldId!, limit: 50, startAfter: page },
    [worldId, entityType, page]
  );

  // Client-side filter on loaded data
  const filtered = data?.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (e.name || e.title || "").toLowerCase();
    const desc = (e.description || "").toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h4">{label}</Typography>
        {totalCount !== undefined && (
          <Typography variant="body2" color="text.secondary">
            {totalCount} total
          </Typography>
        )}
      </Box>

      <TextField
        size="small"
        placeholder={`Filter ${label.toLowerCase()}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3, width: { xs: "100%", sm: 350 } }}
      />

      <LoadingState loading={loading} error={error} onRetry={refetch}>
        <Grid container spacing={2}>
          {filtered?.map((entity) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={entity.id}>
              <EntityCard entity={entity} entityType={et} worldId={worldId!} />
            </Grid>
          ))}

          {filtered && filtered.length === 0 && (
            <Grid size={12}>
              <Typography color="text.secondary" textAlign="center" py={6}>
                {search ? "No matches found." : `No ${label.toLowerCase()} in this world yet.`}
              </Typography>
            </Grid>
          )}
        </Grid>

        {nextPageToken && (
          <Box display="flex" justifyContent="center" mt={3}>
            <Button variant="outlined" onClick={() => setPage(nextPageToken)}>
              Load More
            </Button>
          </Box>
        )}
      </LoadingState>
    </Box>
  );
}
