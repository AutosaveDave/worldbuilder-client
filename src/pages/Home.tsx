import { Box, Typography, Button, Card, CardContent, alpha } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PublicIcon from "@mui/icons-material/Public";
import SettingsIcon from "@mui/icons-material/Settings";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import { isConfigured } from "../api/worldbuilder";

export default function Home() {
  const navigate = useNavigate();
  const configured = isConfigured();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="70vh"
      textAlign="center"
      gap={4}
    >
      <AutoStoriesIcon sx={{ fontSize: 80, color: "primary.main" }} />
      <Typography variant="h4" fontWeight={700}>
        Worldbuilder Explorer
      </Typography>
      <Typography variant="body1" color="text.secondary" maxWidth={500}>
        Browse and explore your game worlds — characters, factions, planets, quests, timelines, and
        more. Connect to your Worldbuilder server to get started.
      </Typography>

      {!configured && (
        <Card
          sx={(t) => ({
            bgcolor: alpha(t.palette.warning.main, 0.08),
            border: `1px solid ${alpha(t.palette.warning.main, 0.3)}`,
            maxWidth: 450,
          })}
        >
          <CardContent>
            <Typography variant="body2" color="warning.light" mb={1}>
              API not configured yet. Set your server URL and API key in Settings to connect.
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => navigate("/settings")}
            >
              Open Settings
            </Button>
          </CardContent>
        </Card>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={<PublicIcon />}
        onClick={() => navigate("/worlds")}
        sx={{ px: 4, py: 1.5 }}
      >
        Browse Worlds
      </Button>
    </Box>
  );
}
