import { useState, useMemo } from "react";
import { Outlet, useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
  Breadcrumbs,
  Link,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import PublicIcon from "@mui/icons-material/Public";
import HomeIcon from "@mui/icons-material/Home";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

const DRAWER_WIDTH = 260;

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    let acc = "";
    for (const p of parts) {
      acc += `/${p}`;
      crumbs.push({ label: decodeURIComponent(p), path: acc });
    }
    return crumbs;
  }, [location.pathname]);

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <AutoStoriesIcon color="primary" />
        <Typography variant="h6" color="primary" fontWeight={700} noWrap>
          Worldbuilder
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1 }}>
        <ListItemButton
          selected={location.pathname === "/"}
          onClick={() => {
            navigate("/");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary="Home" />
        </ListItemButton>
        <ListItemButton
          selected={location.pathname.startsWith("/worlds")}
          onClick={() => {
            navigate("/worlds");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <PublicIcon />
          </ListItemIcon>
          <ListItemText primary="Worlds" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" } }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar position="sticky" sx={{ zIndex: (t) => t.zIndex.drawer - 1 }}>
          <Toolbar>
            {isMobile && (
              <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Breadcrumbs
              sx={{
                color: "text.secondary",
                fontSize: "0.85rem",
                "& .MuiBreadcrumbs-separator": { mx: 0.5 },
              }}
            >
              <Link component={RouterLink} to="/" color="inherit" underline="hover">
                Home
              </Link>
              {breadcrumbs.map((crumb, i) => (
                <Link
                  key={crumb.path}
                  component={RouterLink}
                  to={crumb.path}
                  color={i === breadcrumbs.length - 1 ? "text.primary" : "inherit"}
                  underline="hover"
                  sx={{ textTransform: "capitalize" }}
                >
                  {crumb.label}
                </Link>
              ))}
            </Breadcrumbs>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            p: { xs: 2, sm: 3 },
            maxWidth: 1400,
            width: "100%",
            mx: "auto",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
