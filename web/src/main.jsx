import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { configureAmplify } from "./config/amplify";
import "./styles/index.css";

configureAmplify();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

const application = (
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        {application}
      </GoogleOAuthProvider>
    ) : (
      application
    )}
  </React.StrictMode>,
);
