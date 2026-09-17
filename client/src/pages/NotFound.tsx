import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-slate">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/shop" className="mt-8 inline-block rounded-full bg-navy px-6 py-3 font-semibold text-white">
        Go to the shop
      </Link>
    </div>
  );
}
