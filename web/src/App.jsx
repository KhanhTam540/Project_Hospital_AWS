import React from "react";
<<<<<<< HEAD
import { Toaster } from "react-hot-toast";
import AppRoutes from "./routes/AppRoutes";
=======
import AppRoutes from "./routes/AppRoutes";
import { Toaster } from "react-hot-toast";
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c

function App() {
  return (
    <>
      <AppRoutes />
<<<<<<< HEAD
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{ duration: 4000 }}
      />
=======
      <Toaster position="top-right" reverseOrder={false} />
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
    </>
  );
}

export default App;
