import { Card, CardActionArea, CardContent, Typography, Chip, Stack, Box, alpha } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { Entity, EntityType } from "../types";
import { ENTITY_SINGULAR } from "../types";

interface Props {
  entity: Entity;
  entityType: EntityType;
  worldId: string;
}

export default function EntityCard({ entity, entityType, worldId }: Props) {
  const navigate = useNavigate();
  const singular = ENTITY_SINGULAR[entityType];

  const displayName = entity.name || entity.title || entity.id;
const subtitle = entity.type || (entity.role as string) || (entity.category as string);

  return (
    <Card>
      <CardActionArea
        onClick={() =>
          navigate(`/worlds/${worldId}/${entityType}/${entity.id}`, {
            state: { entity },
          })
        }
        sx={{ height: "100%" }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
              {displayName}
            </Typography>
            <Chip
              label={singular}
              size="small"
              sx={(t) => ({
                bgcolor: alpha(t.palette.primary.main, 0.15),
                color: t.palette.primary.light,
                fontSize: "0.7rem",
                textTransform: "capitalize",
              })}
            />
          </Box>

          {subtitle && (
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {subtitle}
            </Typography>
          )}

          {entity.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {entity.description}
            </Typography>
          )}

          {entity.tags && (entity.tags as string[]).length > 0 && (
            <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" useFlexGap>
              {(entity.tags as string[]).slice(0, 4).map((tag: string) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
              ))}
              {(entity.tags as string[]).length > 4 && (
                <Chip label={`+${(entity.tags as string[]).length - 4}`} size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
              )}
            </Stack>
          )}

          {entity.status && (
            <Chip
              label={String(entity.status)}
              size="small"
              color={entity.status === "alive" || entity.status === "active" ? "success" : "default"}
              sx={{ mt: 1.5, textTransform: "capitalize" }}
            />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
