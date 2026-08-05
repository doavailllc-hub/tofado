import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({
  allowedRoles,
  roles,
  children,
}) {
  const { user } = useAuth();
  const permittedRoles = allowedRoles || roles;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permittedRoles && !permittedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return children;
}
