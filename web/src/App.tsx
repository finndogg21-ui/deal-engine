import { Routes, Route, Link, Navigate } from 'react-router-dom';
import SiteLayout from './layouts/SiteLayout.js';
import AppShell from './layouts/AppShell.js';

import Landing from './pages/Landing.js';
import HowItWorks from './pages/site/HowItWorks.js';
import Pricing from './pages/site/Pricing.js';
import Faq from './pages/site/Faq.js';
import About from './pages/site/About.js';
import Contact from './pages/site/Contact.js';
import Privacy from './pages/site/Privacy.js';
import Terms from './pages/site/Terms.js';
import DeleteAccount from './pages/site/DeleteAccount.js';
import RetailerPage from './pages/site/Retailer.js';
import { SignIn, SignUp, Forgot, Reset, ConfirmDelete } from './pages/site/Auth.js';

import Welcome from './pages/app/Welcome.js';
import AllDeals from './pages/AllDeals.js';
import Watchlist from './pages/app/Watchlist.js';
import Inventory from './pages/app/Inventory.js';
import Orders from './pages/app/Orders.js';
import Profit from './pages/app/Profit.js';
import PennyWatch from './pages/app/PennyWatch.js';
import RetailerDeals from './pages/app/RetailerDeals.js';
import StockCheck from './pages/app/StockCheck.js';
import Admin from './pages/app/Admin.js';

/** Placeholder. One constant, one edit when the real name is picked. */
export const BRAND = "Finnley's Deals";

function NotFound() {
  return (
    <div className="wrap page-head">
      <h1>No page here</h1>
      <p className="lede">The link is wrong, or the page moved.</p>
      <p style={{ marginTop: 'var(--s5)' }}>
        <Link className="btn" to="/">Back to the front page</Link>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public site: one frame, one spacing scale, one nav. */}
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/account/delete/confirm" element={<ConfirmDelete />} />
        <Route path="/stores/:slug" element={<RetailerPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Setup sits outside both frames: no nav to tab into behind the dialog,
          and no menu to a product that is not configured yet. */}
      <Route path="/welcome" element={<Welcome />} />

      <Route path="/app" element={<AppShell />}>
        <Route index element={<AllDeals />} />
        <Route path="penny" element={<PennyWatch />} />
        {/* The queue merged into My watchlist; keep old links working. */}
        <Route path="queue" element={<Navigate to="/app/watchlist" replace />} />
        <Route path="deals/:retailer" element={<RetailerDeals />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="stock/:retailer" element={<StockCheck />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="profit" element={<Profit />} />
        <Route path="admin" element={<Admin />} />
        {/* Alert and penny-watch deep links land here. On a phone this is a
            pushed route rather than a squeezed side panel (F10). */}
        <Route path="deal/:productId/:storeId" element={<AllDeals />} />
      </Route>

      <Route path="/dashboard" element={<AppShell />}>
        <Route index element={<AllDeals />} />
      </Route>
    </Routes>
  );
}
