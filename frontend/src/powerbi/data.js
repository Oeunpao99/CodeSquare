// Practice dataset for the Power BI track: "Lotus Bean Coffee", a fictional
// café chain. Generated deterministically (seeded RNG) so every student sees the
// same numbers. Column names match the ones the lessons use:
// Sales[Amount], Sales[Quantity], Sales[Unit Price], Sales[Unit Cost],
// Sales[CustomerID], Products[Product], Products[Category], Stores[Store],
// Stores[City], 'Date'[Date].

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COMPANY = 'Lotus Bean Coffee';

export const PRODUCTS = [
  { ProductKey: 1, Product: 'Iced Latte', Category: 'Coffee', Price: 2.75, Cost: 0.9, w: 14 },
  { ProductKey: 2, Product: 'Americano', Category: 'Coffee', Price: 2.25, Cost: 0.6, w: 10 },
  { ProductKey: 3, Product: 'Palm Sugar Latte', Category: 'Coffee', Price: 3.25, Cost: 1.0, w: 12 },
  { ProductKey: 4, Product: 'Cappuccino', Category: 'Coffee', Price: 2.75, Cost: 0.85, w: 7 },
  { ProductKey: 5, Product: 'Jasmine Tea', Category: 'Tea', Price: 1.75, Cost: 0.4, w: 6 },
  { ProductKey: 6, Product: 'Lemon Iced Tea', Category: 'Tea', Price: 2.0, Cost: 0.5, w: 8 },
  { ProductKey: 7, Product: 'Matcha Latte', Category: 'Tea', Price: 3.0, Cost: 1.1, w: 6 },
  { ProductKey: 8, Product: 'Croissant', Category: 'Bakery', Price: 2.0, Cost: 0.8, w: 6 },
  { ProductKey: 9, Product: 'Banana Bread', Category: 'Bakery', Price: 1.75, Cost: 0.6, w: 4 },
  { ProductKey: 10, Product: 'Num Kong Donut', Category: 'Bakery', Price: 1.0, Cost: 0.3, w: 5 },
  { ProductKey: 11, Product: 'House Beans 250g', Category: 'Beans', Price: 9.0, Cost: 4.5, w: 2 },
  { ProductKey: 12, Product: 'Mondulkiri Beans 250g', Category: 'Beans', Price: 12.0, Cost: 5.5, w: 1 },
];

export const STORES = [
  { StoreKey: 1, Store: 'Riverside', City: 'Phnom Penh', RepEmail: 'dara@lotusbean.example', size: 1.4 },
  { StoreKey: 2, Store: 'BKK1', City: 'Phnom Penh', RepEmail: 'dara@lotusbean.example', size: 1.2 },
  { StoreKey: 3, Store: 'Pub Street', City: 'Siem Reap', RepEmail: 'sophea@lotusbean.example', size: 1.0 },
  { StoreKey: 4, Store: 'Old Market', City: 'Siem Reap', RepEmail: 'sophea@lotusbean.example', size: 0.8 },
  { StoreKey: 5, Store: 'Kampot River', City: 'Kampot', RepEmail: 'vanna@lotusbean.example', size: 0.6 },
  { StoreKey: 6, Store: 'Central Market', City: 'Battambang', RepEmail: 'vanna@lotusbean.example', size: 0.7 },
];

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

function build() {
  const r = rng(20260115);
  const weighted = [];
  PRODUCTS.forEach((p) => { for (let i = 0; i < p.w; i++) weighted.push(p); });
  const sales = [];
  let id = 10001;
  // Jan 2025 .. Jun 2026 (18 months); 2026 grows ~15%; Apr (Khmer New Year) dips, Dec peaks.
  const season = [1, 0.95, 1.05, 0.8, 1, 0.95, 0.9, 0.95, 1, 1.05, 1.1, 1.25];
  for (let m = 0; m < 18; m++) {
    const year = 2025 + Math.floor(m / 12);
    const month = (m % 12) + 1;
    const growth = year === 2026 ? 1.15 : 1;
    for (const s of STORES) {
      const lines = Math.round(11 * s.size * season[month - 1] * growth + r() * 3);
      for (let i = 0; i < lines; i++) {
        const p = weighted[Math.floor(r() * weighted.length)];
        const day = 1 + Math.floor(r() * 28);
        const bulk = r() < 0.03 && p.Category !== 'Beans';
        const qty = bulk ? 50 + Math.floor(r() * 30) : 1 + Math.floor(r() * (p.Category === 'Beans' ? 2 : 6));
        sales.push({
          OrderID: id++,
          OrderDate: `${year}-${pad(month)}-${pad(day)}`,
          CustomerID: `C${String(1 + Math.floor(r() * 140)).padStart(3, '0')}`,
          ProductKey: p.ProductKey,
          StoreKey: s.StoreKey,
          Quantity: qty,
          'Unit Price': p.Price,
          'Unit Cost': p.Cost,
          Amount: Math.round(qty * p.Price * 100) / 100,
        });
      }
    }
  }
  sales.sort((a, b) => (a.OrderDate < b.OrderDate ? -1 : a.OrderDate > b.OrderDate ? 1 : a.OrderID - b.OrderID));

  const dates = [];
  for (let m = 0; m < 18; m++) {
    const year = 2025 + Math.floor(m / 12);
    const month = (m % 12) + 1;
    const days = new Date(year, month, 0).getDate();
    for (let d = 1; d <= days; d++) {
      dates.push({
        Date: `${year}-${pad(month)}-${pad(d)}`,
        Year: year,
        'Month Number': month,
        Month: MONTH_NAMES[month - 1],
        'Year Month': `${MONTH_NAMES[month - 1]} ${year}`,
        Quarter: `Q${Math.ceil(month / 3)}`,
      });
    }
  }

  const customers = [];
  const first = ['Sokha', 'Dara', 'Bopha', 'Vanna', 'Sophea', 'Rithy', 'Chenda', 'Kosal', 'Malis', 'Piseth', 'Sreyneang', 'Visal'];
  const seg = ['Walk-in', 'Student', 'Office', 'Tourist'];
  for (let i = 1; i <= 140; i++) {
    customers.push({
      CustomerID: `C${String(i).padStart(3, '0')}`,
      Name: `${first[i % first.length]} ${String.fromCharCode(65 + (i % 26))}.`,
      City: STORES[i % STORES.length].City,
      Segment: seg[i % seg.length],
    });
  }

  return {
    Sales: sales,
    Products: PRODUCTS.map(({ w, ...p }) => p),
    Stores: STORES.map(({ size, ...s }) => s),
    Date: dates,
    Customers: customers,
  };
}

export const TABLES = build();

// Star schema: every dimension filters Sales (one-to-many).
export const RELATIONSHIPS = [
  { from: 'Sales', fromCol: 'ProductKey', to: 'Products', toCol: 'ProductKey' },
  { from: 'Sales', fromCol: 'StoreKey', to: 'Stores', toCol: 'StoreKey' },
  { from: 'Sales', fromCol: 'OrderDate', to: 'Date', toCol: 'Date' },
  { from: 'Sales', fromCol: 'CustomerID', to: 'Customers', toCol: 'CustomerID' },
];

// Lookups from a Sales row to its dimension rows.
const index = (rows, key) => Object.fromEntries(rows.map((x) => [x[key], x]));
export const LOOKUP = {
  Products: index(TABLES.Products, 'ProductKey'),
  Stores: index(TABLES.Stores, 'StoreKey'),
  Date: index(TABLES.Date, 'Date'),
  Customers: index(TABLES.Customers, 'CustomerID'),
};
export const FK = { Products: 'ProductKey', Stores: 'StoreKey', Date: 'OrderDate', Customers: 'CustomerID' };
export const KEY = { Sales: 'OrderID', Products: 'ProductKey', Stores: 'StoreKey', Date: 'Date', Customers: 'CustomerID' };

export const COLUMN_TYPES = {
  Sales: { OrderID: 'int', OrderDate: 'date', CustomerID: 'text', ProductKey: 'int', StoreKey: 'int', Quantity: 'int', 'Unit Price': 'num', 'Unit Cost': 'num', Amount: 'num' },
  Products: { ProductKey: 'int', Product: 'text', Category: 'text', Price: 'num', Cost: 'num' },
  Stores: { StoreKey: 'int', Store: 'text', City: 'text', RepEmail: 'text' },
  Date: { Date: 'date', Year: 'int', 'Month Number': 'int', Month: 'text', 'Year Month': 'text', Quarter: 'text' },
  Customers: { CustomerID: 'text', Name: 'text', City: 'text', Segment: 'text' },
};
