import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PublicIcon from "@mui/icons-material/Public";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

export default function Home() {
  const navigate = useNavigate();

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
        more.
      </Typography>

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
