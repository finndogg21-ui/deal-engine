import { Routes, Route, Link, Navigate } from 'react-router-dom';
import LedgerPreview from './pages/LedgerPreview.js';
import DealPage from './pages/DealPage.js';
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
import PennyDealPage from './pages/PennyDealPage.js';
import Admin from './pages/app/Admin.js';
import ReportFind from './pages/app/ReportFind.js';

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
        {/* Design review surface for the store ledger. Not linked in nav. */}
        <Route path="/design/ledger" element={<LedgerPreview />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Setup sits outside both frames: no nav to tab into behind the dialog,
          and no menu to a product that is not configured yet. */}
      <Route path="/welcome" element={<Welcome />} />

      {/* THE TAPE: the app is ONE page — Find, with two spools (All deals /
          Penny deals). Every culled route redirects rather than 404s so old
          links, alerts, and bookmarks keep working. */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<AllDeals />} />
        <Route path="penny" element={<Navigate to="/app?tab=penny" replace />} />
        {/* Every penny report is its own shareable page. */}
        <Route path="p/:reportId" element={<PennyDealPage />} />
        {/* Every verified deal gets its own page — shareable, bookmarkable, and
            openable in a second tab while standing in the aisle. */}
        <Route path="d/:retailer/:itemId" element={<DealPage />} />
        <Route path="admin" element={<Admin />} />
        {/* Dollar General is community-fed: members report their own in-store
            penny scans here, because DG's penny price is register-only. */}
        <Route path="report" element={<ReportFind />} />
        {/* Alert and penny-watch deep links land here. On a phone this is a
            pushed route rather than a squeezed side panel (F10). */}
        <Route path="deal/:productId/:storeId" element={<AllDeals />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>

      <Route path="/dashboard" element={<AppShell />}>
        <Route index element={<AllDeals />} />
      </Route>
    </Routes>
  );
}
