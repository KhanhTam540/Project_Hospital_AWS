import React from "react";
import ReactDOM from "react-dom/client";
<<<<<<< HEAD
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { configureAmplify } from "./config/amplify";
=======
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { configureAmplify } from "./config/amplify";

>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
import "./styles/index.css";

configureAmplify();

<<<<<<< HEAD
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

const application = (
=======
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const appTree = (
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
<<<<<<< HEAD
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
=======
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {clientId ? (
      <GoogleOAuthProvider clientId={clientId}>{appTree}</GoogleOAuthProvider>
    ) : (
      appTree
    )}
  </React.StrictMode>
);