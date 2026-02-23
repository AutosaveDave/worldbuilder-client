import { createTheme, alpha } from "@mui/material/styles";

const BRAND = "#7c4dff"; // deep purple accent
const SURFACE = "#121829"; // dark navy

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: BRAND },
    secondary: { main: "#00e5ff" },
    background: {
      default: "#0a0f1e",
      paper: SURFACE,
    },
    divider: alpha("#ffffff", 0.08),
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: `"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif`,
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${alpha("#ffffff", 0.2)} transparent`,
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: alpha("#ffffff", 0.2),
          },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#ffffff", 0.08)}`,
          backdropFilter: "blur(12px)",
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:hover": {
            borderColor: alpha(BRAND, 0.4),
            boxShadow: `0 0 20px ${alpha(BRAND, 0.15)}`,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: SURFACE,
          borderRight: `1px solid ${alpha("#ffffff", 0.06)}`,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: alpha(SURFACE, 0.8),
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${alpha("#ffffff", 0.06)}`,
        },
      },
    },
  },
});

export default theme;
