import { useState, useMemo, useEffect, useRef } from "react";
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
import { callTool } from "../api/worldbuilder";
import { ENTITY_SINGULAR, type EntityType } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // ─── Resolve UUID breadcrumb segments to entity names ─────────
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const nameCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    // Identify UUID segments and what they represent
    const toResolve: { id: string; fetchFn: () => Promise<string | null> }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (!UUID_RE.test(seg)) continue;
      if (nameCache.current[seg]) continue; // already cached

      // UUID right after "worlds" → it's a worldId
      if (parts[i - 1] === "worlds") {
        toResolve.push({
          id: seg,
          fetchFn: async () => {
            try {
              const res = await callTool<{ world?: { name?: string }; name?: string }>(
                "get_world",
                { worldId: seg }
              );
              const w = res.data;
              return (w as any)?.name ?? (w as any)?.world?.name ?? null;
            } catch {
              return null;
            }
          },
        });
      }
      // UUID after an entity-type segment → it's an entityId
      // Pattern: worlds/<worldId>/<entityType>/<entityId> → indices 0/1/2/3
      else if (i >= 3 && parts[i - 3] === "worlds") {
        const maybeType = parts[i - 1] as EntityType;
        const worldId = parts[i - 2];
        const singular = ENTITY_SINGULAR[maybeType];
        if (singular && UUID_RE.test(worldId)) {
          toResolve.push({
            id: seg,
            fetchFn: async () => {
              try {
                const res = await callTool<{ name?: string; title?: string }>(
                  `get_${singular}`,
                  { worldId, id: seg }
                );
                return res.data?.name ?? res.data?.title ?? null;
              } catch {
                return null;
              }
            },
          });
        }
        // Pattern: worlds/<worldId>/galaxy/<starSystemId>
        else if (parts[i - 1] === "galaxy" && UUID_RE.test(worldId)) {
          toResolve.push({
            id: seg,
            fetchFn: async () => {
              try {
                const res = await callTool<{ name?: string }>(
                  "get_star_system",
                  { worldId, id: seg }
                );
                return res.data?.name ?? null;
              } catch {
                return null;
              }
            },
          });
        }
      }
    }

    if (toResolve.length === 0) return;

    let cancelled = false;
    (async () => {
      const results: Record<string, string> = {};
      await Promise.all(
        toResolve.map(async ({ id, fetchFn }) => {
          const name = await fetchFn();
          if (name) results[id] = name;
        })
      );
      if (!cancelled) {
        Object.assign(nameCache.current, results);
        setNameMap((prev) => ({ ...prev, ...results }));
      }
    })();

    return () => { cancelled = true; };
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
              {breadcrumbs.map((crumb, i) => {
                const displayLabel = UUID_RE.test(crumb.label)
                  ? nameMap[crumb.label] ?? "…"
                  : crumb.label;
                return (
                  <Link
                    key={crumb.path}
                    component={RouterLink}
                    to={crumb.path}
                    color={i === breadcrumbs.length - 1 ? "text.primary" : "inherit"}
                    underline="hover"
                    sx={{ textTransform: "capitalize" }}
                  >
                    {displayLabel}
                  </Link>
                );
              })}
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
