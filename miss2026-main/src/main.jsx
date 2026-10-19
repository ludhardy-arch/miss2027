import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import Demo from "./pages/Demo";
import "./styles/global.css";
import { AppProvider } from "./context/AppContext";

// The public demo deliberately mounts without AppProvider or Firebase listeners.
function Root() {
  const [isDemo, setIsDemo] = React.useState(() => window.location.hash.startsWith("#/demo"));
  React.useEffect(() => {
    const sync = () => setIsDemo(window.location.hash.startsWith("#/demo"));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  if (isDemo) {
    return <HashRouter><Routes><Route path="/demo" element={<Demo />} /></Routes></HashRouter>;
  }
  return <AppProvider><App /></AppProvider>;
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Root /></React.StrictMode>
);
