import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import WorldList from "./pages/WorldList";
import WorldDetail from "./pages/WorldDetail";
import EntityList from "./pages/EntityList";
import EntityDetail from "./pages/EntityDetail";
import TimelinePage from "./pages/Timeline";
import RelationshipsPage from "./pages/Relationships";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/worlds" element={<WorldList />} />
          <Route path="/worlds/:worldId" element={<WorldDetail />} />
          <Route path="/worlds/:worldId/timeline" element={<TimelinePage />} />
          <Route path="/worlds/:worldId/graph" element={<RelationshipsPage />} />
          <Route path="/worlds/:worldId/:entityType" element={<EntityList />} />
          <Route path="/worlds/:worldId/:entityType/:entityId" element={<EntityDetail />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
