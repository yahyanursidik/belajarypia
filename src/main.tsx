import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthSessionProvider } from "./app/providers/AuthSessionProvider";
import { RefineAppProvider } from "./app/providers/RefineProvider";
import { AppRoutes } from "./routes/AppRoutes";
import "./styles/global.css";
import {SystemIdentity} from "./components/SystemIdentity";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SystemIdentity/>
      <AuthSessionProvider>
        <RefineAppProvider>
          <AppRoutes />
        </RefineAppProvider>
      </AuthSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
