import { useParams } from 'react-router-dom';
import Stub from './Stub.js';

export function PennyWatch() {
  return (
    <Stub
      section="Find"
      title="Penny watch"
      summary="Items that walked the full markdown ladder and then vanished from the site while stock stayed on the floor. Ranked by how likely they are to ring up at a cent."
      points={[
        'Scored 0–100, with the reasoning shown',
        'Filtered to stores within your range',
        'Verified finds from people who were just there',
        'One tap to record what you actually found',
      ]}
      blockedBy="the daily scan collecting price history"
    />
  );
}

export function Watchlist() {
  return (
    <Stub
      section="Find"
      title="My watchlist"
      summary="Type a product — 'blender', not a model number — and get told when one drops. Matching runs on categories, so every brand counts."
      points={[
        'Minimum discount and maximum price per watch',
        'A daily cap so alerts stay worth reading',
        'Quiet hours',
        'A running total of what you have saved',
      ]}
      blockedBy="Keepa, and the term-to-category mapping"
    />
  );
}

export function StockCheck() {
  const { retailer } = useParams();
  const name = (retailer ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Stub
      section="Stock check"
      title={`${name} stock check`}
      summary={`Look up any ${name} SKU and see which nearby stores have it, how many are left, and what it costs there.`}
      points={[
        'Per-store quantity, not just in stock or out',
        'Aisle and bay where the retailer publishes it',
        'Distance from your home stores',
        'Price history for that SKU at that store',
      ]}
      blockedBy="a store-level data vendor (Unwrangle)"
    />
  );
}

export function Inventory() {
  return (
    <Stub
      section="Resell"
      title="Inventory"
      summary="What you bought, what it cost, and where it is. The half of the product nobody else builds."
      points={[
        'Add straight from a deal, with cost basis filled in',
        'Condition, quantity, and storage location',
        'What is listed and what is still sitting',
      ]}
    />
  );
}

export function Orders() {
  return (
    <Stub
      section="Resell"
      title="Orders"
      summary="Listings and sales across eBay, Facebook Marketplace, and wherever else you move things."
      points={[
        'Sale price, fees, and shipping per order',
        'Status from listed through delivered',
        'Later: import order confirmations from email',
      ]}
    />
  );
}

export function Profit() {
  return (
    <Stub
      section="Resell"
      title="Profit"
      summary="What you actually made, after fees. Not revenue, not gross — the number worth filming."
      points={[
        'Net per item and per month',
        'Return on the money you put in',
        'Which stores and categories actually pay',
        'Later: expected profit shown at alert time',
      ]}
      blockedBy="inventory and orders, plus a resale comps source for predictions"
    />
  );
}
