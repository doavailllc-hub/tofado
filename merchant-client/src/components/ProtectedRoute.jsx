import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountDestination } from '../services/navigation';
export default function ProtectedRoute({ allowedRoles, roles, children }) {
  const location = useLocation();
  const { user, booting, sessionError, restoreSession, logout } = useAuth();
  if (booting) return <main role="status" style={{ padding: 32 }}>Loading your account...</main>;
  if (sessionError) return <main role="alert" style={{ padding: 32 }}><p>{sessionError}</p><button onClick={restoreSession}>Try again</button> <button onClick={logout}>Sign out</button></main>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  const permittedRoles = allowedRoles || roles;
  if (permittedRoles && !permittedRoles.includes(user.role)) return <Navigate to={accountDestination(user)} replace />;
  if (user.role === 'wholesaler' && user.verification_status !== 'verified' && location.pathname !== '/wholesaler/profile') return <Navigate to="/wholesaler/profile" replace />;
  return children;
}
