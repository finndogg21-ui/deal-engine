import { Routes, Route, Link } from 'react-router-dom';
import Landing from './pages/Landing.js';
import AppShell from './layouts/AppShell.js';
import Dashboard from './pages/Dashboard.js';
import Welcome from './pages/app/Welcome.js';
import { PennyWatch, Watchlist, StockCheck, Inventory, Orders, Profit } from './pages/app/stubs.js';

/** Placeholder. One constant, one edit when the real name is picked. */
export const BRAND = "Finnley's Deals";

function NotFound() {
  return (
    <div className="notfound">
      <h1>No page here.</h1>
      <p>The link is wrong, or the page moved.</p>
      <Link to="/">Back to the front page</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Setup sits outside the shell — no nav to tab into behind the dialog,
          and no menu to a product that isn't configured yet. */}
      <Route path="/welcome" element={<Welcome />} />

      <Route path="/app" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="penny" element={<PennyWatch />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="stock/:retailer" element={<StockCheck />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="profit" element={<Profit />} />
      </Route>

      {/* Old bookmark. */}
      <Route path="/dashboard" element={<AppShell />}>
        <Route index element={<Dashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
