import { Box, CircularProgress, Typography, Alert, Button } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

interface Props {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
}

export default function LoadingState({ loading, error, onRetry, children }: Props) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ my: 2 }}
        action={
          onRetry ? (
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  return <>{children}</>;
}
