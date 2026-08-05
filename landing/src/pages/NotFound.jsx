import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="not-found">
      <span>404</span>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link to="/" className="primary-button">Return home</Link>
    </section>
  );
}
