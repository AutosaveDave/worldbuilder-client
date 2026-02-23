import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Grid,
  alpha,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useToolQuery } from "../hooks/useWorldbuilder";
import LoadingState from "../components/LoadingState";
import type { World } from "../types";

export default function WorldList() {
  const { data, loading, error, refetch } = useToolQuery<World[]>("list_worlds", { limit: 100 });
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h4" mb={3}>
        Worlds
      </Typography>

      <LoadingState loading={loading} error={error} onRetry={refetch}>
        <Grid container spacing={2}>
          {data?.map((world) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={world.id}>
              <Card sx={{ height: "100%" }}>
                <CardActionArea
                  onClick={() => navigate(`/worlds/${world.id}`)}
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom noWrap>
                      {world.name}
                    </Typography>

                    {world.genre && (
                      <Chip
                        label={world.genre}
                        size="small"
                        sx={(t) => ({
                          bgcolor: alpha(t.palette.secondary.main, 0.15),
                          color: t.palette.secondary.light,
                          mb: 1,
                          textTransform: "capitalize",
                        })}
                      />
                    )}

                    {world.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {world.description}
                      </Typography>
                    )}

                    {world.tags && world.tags.length > 0 && (
                      <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" useFlexGap>
                        {world.tags.slice(0, 4).map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
                        ))}
                      </Stack>
                    )}

                    {world.entityCounts && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                        {Object.values(world.entityCounts).reduce((a, b) => a + b, 0)} entities
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}

          {data && data.length === 0 && (
            <Grid size={12}>
              <Typography color="text.secondary" textAlign="center" py={6}>
                No worlds found. Create one on your server to get started.
              </Typography>
            </Grid>
          )}
        </Grid>
      </LoadingState>
    </Box>
  );
}
