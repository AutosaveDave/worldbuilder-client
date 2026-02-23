import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Stack,
  Chip,
  alpha,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { getApiUrl, getApiKey, setApiUrl, setApiKey, isConfigured } from "../api/worldbuilder";

export default function Settings() {
  const [url, setUrl] = useState(getApiUrl);
  const [key, setKey] = useState(getApiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiUrl(url.trim());
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const configured = isConfigured();

  return (
    <Box maxWidth={600}>
      <Typography variant="h4" mb={3}>
        Settings
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" mb={2}>
          API Connection
        </Typography>

        <Stack spacing={3}>
          <TextField
            label="API URL"
            fullWidth
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://us-central1-PROJECT_ID.cloudfunctions.net/mcp/mcp"
            helperText="The full URL to the MCP endpoint on your Firebase Cloud Function"
          />

          <TextField
            label="API Key"
            fullWidth
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="your-api-key"
            helperText="The x-api-key value configured on your server"
          />

          <Box display="flex" alignItems="center" gap={2}>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
              Save
            </Button>
            <Chip
              icon={configured ? <CheckCircleIcon /> : undefined}
              label={configured ? "Connected" : "Not configured"}
              color={configured ? "success" : "warning"}
              size="small"
            />
          </Box>

          {saved && <Alert severity="success">Settings saved. Refresh pages to use the new config.</Alert>}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" mb={1}>
          Environment Variables
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          You can also set defaults using environment variables in a <code>.env</code> file:
        </Typography>
        <Box
          component="pre"
          sx={(t) => ({
            p: 2,
            borderRadius: 1,
            bgcolor: alpha(t.palette.common.black, 0.3),
            fontSize: "0.8rem",
            overflow: "auto",
          })}
        >
          {`VITE_WORLDBUILDER_API_URL=https://us-central1-PROJECT_ID.cloudfunctions.net/mcp/mcp
VITE_WORLDBUILDER_API_KEY=your-api-key`}
        </Box>
      </Paper>
    </Box>
  );
}
