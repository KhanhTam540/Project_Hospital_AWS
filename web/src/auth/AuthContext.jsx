import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { isCognitoEnabled } from "../config/cognito";
import { cognitoSignOut, getCognitoSession } from "./cognitoAuth";
import { getEffectiveRole, getClaimsFromStorage } from "./rbac";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [maTK, setMaTK] = useState(localStorage.getItem("maTK"));
  const [loaiNS, setLoaiNS] = useState(localStorage.getItem("loaiNS"));
  const [user, setUser] = useState(readStoredUser());
  const [loading, setLoading] = useState(isCognitoEnabled());

  const setSession = useCallback(({ token: t, role: r, maTK: id, loaiNS: ln, user: u }) => {
    if (t) {
      setToken(t);
      localStorage.setItem("token", t);
    }
    if (r) {
      setRole(r);
      localStorage.setItem("role", r);
    }
    if (id) {
      setMaTK(id);
      localStorage.setItem("maTK", id);
    }
    setLoaiNS(ln || "");
    localStorage.setItem("loaiNS", ln || "");
    if (u) {
      setUser(u);
      localStorage.setItem("user", JSON.stringify(u));
    }
  }, []);

  useEffect(() => {
    if (!isCognitoEnabled()) {
      setLoading(false);
      return;
    }

    const restoreSession = async () => {
      try {
        const session = await getCognitoSession();
        if (session?.tokens) {
          const storedRole = getEffectiveRole();
          setRole(storedRole);
          setToken(localStorage.getItem("token"));
          setMaTK(localStorage.getItem("maTK"));
          setLoaiNS(localStorage.getItem("loaiNS") || "");
          setUser(readStoredUser());
        }
      } catch {
        /* no active session */
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const logout = async () => {
    if (isCognitoEnabled()) {
      await cognitoSignOut();
    } else {
      localStorage.clear();
    }
    setToken(null);
    setRole(null);
    setMaTK(null);
    setLoaiNS(null);
    setUser(null);
    window.location.href = "/login";
  };

  const claims = getClaimsFromStorage();
  const effectiveRole = role || getEffectiveRole();

  return (
    <AuthContext.Provider
      value={{
        token,
        role: effectiveRole,
        maTK,
        loaiNS,
        user,
        claims,
        loading,
        setToken,
        setRole,
        setMaTK,
        setLoaiNS,
        setUser,
        setSession,
        logout,
        isCognito: isCognitoEnabled(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
