import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Chip,
  Stack,
  Divider,
  alpha,
  Paper,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import PlaceIcon from "@mui/icons-material/Place";
import MemoryIcon from "@mui/icons-material/Memory";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import PetsIcon from "@mui/icons-material/Pets";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import EventIcon from "@mui/icons-material/Event";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import HubIcon from "@mui/icons-material/Hub";
import TimelineIcon from "@mui/icons-material/Timeline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import RadarIcon from "@mui/icons-material/Radar";
import SelfImprovementIcon from "@mui/icons-material/SelfImprovement";
import StarsIcon from "@mui/icons-material/Stars";
import MapIcon from "@mui/icons-material/Map";
import { useToolQuery } from "../hooks/useWorldbuilder";
import LoadingState from "../components/LoadingState";
import type { EntityType, WorldSummary } from "../types";
import { ENTITY_TYPES, ENTITY_LABELS } from "../types";

const ICONS: Record<EntityType, React.ReactNode> = {
  characters: <PersonIcon />,
  factions: <GroupsIcon />,
  planets: <PublicIcon />,
  locations: <PlaceIcon />,
  technologies: <MemoryIcon />,
  vehicles: <DirectionsCarIcon />,
  species: <PetsIcon />,
  items: <Inventory2Icon />,
  quests: <AssignmentTurnedInIcon />,
  events: <EventIcon />,
  lore: <MenuBookIcon />,
  economies: <AccountBalanceIcon />,
  relationships: <HubIcon />,
  abilities: <AutoAwesomeIcon />,
  conflicts: <LocalFireDepartmentIcon />,
  "galactic-regions": <RadarIcon />,
  religions: <SelfImprovementIcon />,
  "star-systems": <StarsIcon />,
};

export default function WorldDetail() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();

  const { data: summary, loading, error, refetch } = useToolQuery<WorldSummary>(
    "get_world_summary",
    { worldId: worldId! },
    [worldId]
  );

  const world = summary?.world;
  const counts = summary?.entityCounts ?? world?.entityCounts ?? {};

  return (
    <Box>
      <LoadingState loading={loading} error={error} onRetry={refetch}>
        {world && (
          <>
            {/* World header */}
            <Box mb={4}>
              <Typography variant="h4" gutterBottom>
                {world.name}
              </Typography>
              <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
                {world.genre && (
                  <Chip
                    label={world.genre}
                    size="small"
                    sx={(t) => ({
                      bgcolor: alpha(t.palette.secondary.main, 0.15),
                      color: t.palette.secondary.light,
                      textTransform: "capitalize",
                    })}
                  />
                )}
                {world.status && (
                  <Chip
                    label={world.status}
                    size="small"
                    color={world.status === "active" ? "success" : "default"}
                    sx={{ textTransform: "capitalize" }}
                  />
                )}
                {world.tags?.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Stack>
              {world.description && (
                <Typography variant="body1" color="text.secondary" mt={1}>
                  {world.description}
                </Typography>
              )}
            </Box>

            {/* World settings */}
            {world.settings && (
              <Paper sx={{ p: 2, mb: 3, bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
                <Typography variant="overline" color="text.secondary">
                  World Settings
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mt={1}>
                  {world.settings.scale && (
                    <Chip label={`Scale: ${world.settings.scale}`} size="small" />
                  )}
                  {world.settings.techLevel && (
                    <Chip label={`Tech: ${world.settings.techLevel}`} size="small" />
                  )}
                  {world.settings.tone && (
                    <Chip label={`Tone: ${world.settings.tone}`} size="small" />
                  )}
                  {world.settings.timelineStart && (
                    <Chip
                      label={`${world.settings.timelineStart} → ${world.settings.timelineEnd ?? "?"}`}
                      size="small"
                    />
                  )}
                  {world.settings.themes?.map((t) => (
                    <Chip key={t} label={t} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Paper>
            )}

            <Divider sx={{ mb: 3 }} />

            {/* Entity category grid */}
            <Typography variant="h5" mb={2}>
              Explore Entities
            </Typography>
            <Grid container spacing={2} mb={4}>
              {ENTITY_TYPES.map((et) => {
                const count = counts[et] ?? 0;
                return (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={et}>
                    <Card>
                      <CardActionArea
                        onClick={() => navigate(`/worlds/${worldId}/${et}`)}
                        sx={{ height: "100%" }}
                      >
                        <CardContent sx={{ textAlign: "center", py: 3 }}>
                          <Box sx={{ color: "primary.main", mb: 1 }}>{ICONS[et]}</Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {ENTITY_LABELS[et]}
                          </Typography>
                          <Typography variant="h5" color="text.secondary" fontWeight={700} mt={0.5}>
                            {count}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            {/* Timeline / Graph / Galaxy shortcuts */}
            <Grid container spacing={2} mb={4}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card>
                  <CardActionArea onClick={() => navigate(`/worlds/${worldId}/timeline`)}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <TimelineIcon color="secondary" sx={{ fontSize: 36 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Timeline
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          View events in chronological order
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card>
                  <CardActionArea onClick={() => navigate(`/worlds/${worldId}/graph`)}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <HubIcon color="secondary" sx={{ fontSize: 36 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Relationship Graph
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Explore entity connections
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card>
                  <CardActionArea onClick={() => navigate(`/worlds/${worldId}/galaxy`)}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <MapIcon color="secondary" sx={{ fontSize: 36 }} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Galaxy Map
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Explore star systems in 3D
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            </Grid>

            {/* Notable entities from summary */}
            {summary?.notableCharacters && summary.notableCharacters.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" mb={1}>
                  Notable Characters
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {summary.notableCharacters.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name ?? c.id}
                      onClick={() => navigate(`/worlds/${worldId}/characters/${c.id}`)}
                      clickable
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {summary?.keyFactions && summary.keyFactions.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" mb={1}>
                  Key Factions
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {summary.keyFactions.map((f) => (
                    <Chip
                      key={f.id}
                      label={f.name ?? f.id}
                      onClick={() => navigate(`/worlds/${worldId}/factions/${f.id}`)}
                      clickable
                      color="secondary"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </LoadingState>
    </Box>
  );
}
