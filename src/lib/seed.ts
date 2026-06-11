import bcrypt from 'bcrypt';
import prisma from './prisma.js';
import { Role } from '@prisma/client';

const MENU_ITEMS = [
  // ── STARTERS ──────────────────────────────────────────────────────────────
  { name: 'Bone Marrow Royale', description: 'Roasted bone marrow with toasted brioche, herb salsa verde and sea salt flakes.', price: 12.50, category: 'STARTER', imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80' },
  { name: 'Seared Scallops', description: 'Hand-dived scallops, cauliflower purée, crispy pancetta and micro herbs.', price: 15.00, category: 'STARTER', imageUrl: 'https://images.unsplash.com/photo-1532639193859-bbf21adc57cf?auto=format&fit=crop&w=600&q=80' },
  { name: 'Beef Carpaccio', description: 'Thinly sliced wagyu beef, shaved parmesan, capers and truffle oil.', price: 14.00, category: 'STARTER', imageUrl: 'https://images.unsplash.com/photo-1623595110708-76b2afad3d76?auto=format&fit=crop&w=600&q=80' },
  { name: 'Crispy Calamari', description: 'Lightly dusted calamari rings with house-made aioli and lemon wedge.', price: 9.50, category: 'STARTER', imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=600&q=80' },
  { name: 'French Onion Soup', description: 'Classic slow-cooked onion broth, Gruyère crouton and fresh thyme.', price: 8.50, category: 'STARTER', imageUrl: 'https://images.unsplash.com/photo-1583032015879-e50d22792c90?auto=format&fit=crop&w=600&q=80' },

  // ── MAINS – STEAKS ────────────────────────────────────────────────────────
  { name: 'Signature Dry-Aged Tomahawk', description: '45-day dry-aged prime rib tomahawk, smoked bone marrow butter and chimichurri. Serves 2.', price: 85.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
  { name: 'Wagyu Ribeye (300g)', description: 'A4 Wagyu ribeye, truffle compound butter, Maldon sea salt.', price: 65.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1546241072-48010ad28cfe?auto=format&fit=crop&w=600&q=80' },
  { name: 'Wood-Fired Ribeye (400g)', description: 'Center-cut ribeye cooked over live coals with roasted heritage garlic and rosemary.', price: 34.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=600&q=80' },
  { name: 'Fillet Medallion (250g)', description: 'Tender center-cut beef fillet, cognac peppercorn sauce, served on buttered spätzle.', price: 32.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80' },
  { name: 'T-Bone (600g)', description: 'Grain-fed T-bone, café de Paris butter and crispy onion rings.', price: 38.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1621251912644-3bc106f36611?auto=format&fit=crop&w=600&q=80' },
  { name: 'New York Striploin (350g)', description: 'USDA choice striploin with house steak sauce and roasted garlic.', price: 28.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=600&q=80' },
  { name: 'Sirloin (500g)', description: 'Prime sirloin, herb butter, aged balsamic reduction.', price: 26.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?auto=format&fit=crop&w=600&q=80' },
  { name: 'Picanha (300g)', description: 'Brazilian-style picanha with chimichurri, roasted peppers and farofa.', price: 24.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1611712142469-e3e02029671d?auto=format&fit=crop&w=600&q=80' },
  { name: 'Lamb Rack', description: 'Herb-crusted lamb rack, minted pea purée, port jus.', price: 30.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1602847170230-29df44a396d2?auto=format&fit=crop&w=600&q=80' },
  { name: 'Surf & Turf', description: '200g fillet medallion and tiger prawns, lemon beurre blanc.', price: 42.00, category: 'MAIN', imageUrl: 'https://images.unsplash.com/photo-1514516369414-781446b21100?auto=format&fit=crop&w=600&q=80' },

  // ── SIDES ─────────────────────────────────────────────────────────────────
  { name: 'Truffle Parmesan Fries', description: 'Hand-cut fries, shaved parmesan, black truffle oil and fresh chives.', price: 7.50, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80' },
  { name: 'Creamy Mashed Potato', description: 'Smooth Parisian-style potato mash with cultured butter and sea salt.', price: 6.50, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&w=600&q=80' },
  { name: 'Garlic Butter Mushrooms', description: 'Mixed wild mushrooms sautéed in garlic, thyme and brown butter.', price: 7.00, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1544434274-a02d847990be?auto=format&fit=crop&w=600&q=80' },
  { name: 'Charred Broccolini', description: 'Tenderstem broccolini, chilli, lemon zest and toasted almonds.', price: 6.50, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80' },
  { name: 'Mac & Cheese Croquettes', description: 'Crispy cheese-filled croquettes with smoked paprika aioli.', price: 8.50, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80' },
  { name: 'House Side Salad', description: 'Mixed greens, cherry tomatoes, cucumber and house vinaigrette.', price: 5.50, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80' },
  { name: 'Creamed Spinach', description: 'Wilted baby spinach in béchamel with nutmeg and gruyère.', price: 6.50, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1618414465717-30230691f1a5?auto=format&fit=crop&w=600&q=80' },
  { name: 'Onion Rings', description: 'Beer-battered onion rings with smoky chipotle dip.', price: 6.00, category: 'SIDE', imageUrl: 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=600&q=80' },

  // ── SAUCES ────────────────────────────────────────────────────────────────
  { name: 'Peppercorn Sauce', description: 'Classic brandy peppercorn cream sauce.', price: 3.50, category: 'SAUCE', imageUrl: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?auto=format&fit=crop&w=600&q=80' },
  { name: 'Béarnaise Sauce', description: 'Traditional tarragon béarnaise.', price: 3.50, category: 'SAUCE', imageUrl: 'https://images.unsplash.com/photo-1622322062534-118c86927375?auto=format&fit=crop&w=600&q=80' },
  { name: 'Red Wine Jus', description: 'Slow-reduced Merlot and bone marrow jus.', price: 3.50, category: 'SAUCE', imageUrl: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?auto=format&fit=crop&w=600&q=80' },
  { name: 'Chimichurri', description: 'Fresh parsley, garlic, red wine vinegar and chilli.', price: 3.00, category: 'SAUCE', imageUrl: 'https://images.unsplash.com/photo-1559113513-d5e09c78b9dd?auto=format&fit=crop&w=600&q=80' },

  // ── DESSERTS ──────────────────────────────────────────────────────────────
  { name: 'Chocolate Fondant', description: 'Warm dark chocolate lava cake, vanilla bean ice cream, gold leaf.', price: 9.50, category: 'DESSERT', imageUrl: 'https://images.unsplash.com/photo-1617343253967-1856b7116bc6?auto=format&fit=crop&w=600&q=80' },
  { name: 'New York Cheesecake', description: 'Baked cheesecake on a graham cracker base, berry compote.', price: 8.50, category: 'DESSERT', imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80' },
  { name: 'Crème Brûlée', description: 'Classic vanilla custard with caramelised sugar crust.', price: 8.00, category: 'DESSERT', imageUrl: 'https://images.unsplash.com/photo-1528416010300-94632f790409?auto=format&fit=crop&w=600&q=80' },
  { name: 'Sticky Toffee Pudding', description: 'Warm date pudding, butterscotch sauce and clotted cream.', price: 8.50, category: 'DESSERT', imageUrl: 'https://images.unsplash.com/photo-1514517604298-cf80e0fb7f1e?auto=format&fit=crop&w=600&q=80' },
  { name: 'Cheese Board', description: 'Selection of artisanal cheeses, qince paste, honeycomb and crackers.', price: 14.50, category: 'DESSERT', imageUrl: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=600&q=80' },

  // ── DRINKS ────────────────────────────────────────────────────────────────
  { name: 'House Red Wine (Glass)', description: 'Premium Merlot — deep ruby, plum and dark cherry notes.', price: 8.50, category: 'DRINK', imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80' },
  { name: 'House White Wine (Glass)', description: 'Crisp Chardonnay — citrus, vanilla and light oak.', price: 8.00, category: 'DRINK', imageUrl: 'https://images.unsplash.com/photo-1559261950-bb721df7e24b?auto=format&fit=crop&w=600&q=80' },
  { name: 'Craft IPA', description: 'British craft India Pale Ale — hoppy and refreshing.', price: 6.50, category: 'DRINK', imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=600&q=80' },
  { name: 'Sparkling Water (750ml)', description: 'San Pellegrino naturally sparkling mineral water.', price: 4.50, category: 'DRINK', imageUrl: 'https://images.unsplash.com/photo-1559839914-17aae19cea9e?auto=format&fit=crop&w=600&q=80' },
  { name: 'Aged Whisky Neat', description: 'Single malt Scotch — smoky, peated, served neat or on the rocks.', price: 12.00, category: 'DRINK', imageUrl: 'https://images.unsplash.com/photo-1527281473222-79389e1ce6ee?auto=format&fit=crop&w=600&q=80' },
  { name: 'Espresso Martini', description: 'Vodka, Kahlúa, fresh espresso, vanilla syrup.', price: 11.50, category: 'DRINK', imageUrl: 'https://images.unsplash.com/photo-1545438102-799c3991ffb2?auto=format&fit=crop&w=600&q=80' },
];

export async function seedAdmin(): Promise<void> {
  console.log('[Seeder] Initializing STEAKZ MIS Core Corporate Entities...');

  // ── 1. Seed Branches ──────────────────────────────────────────────────────
  const defaultBranches = [
    { name: 'London HQ',  location: 'Canary Wharf Corporate Centre', city: 'London',      address: '1 Canada Square, Canary Wharf' },
    { name: 'Mayfair',    location: 'Mount Street',                  city: 'London',      address: '11 Mount Street' },
    { name: 'Manchester', location: 'Spinningfields',               city: 'Manchester',   address: '1 Hardman Square' },
    { name: 'Edinburgh',  location: 'Princes Street',                city: 'Edinburgh',    address: '52 Princes Street' },
    { name: 'Birmingham', location: 'Bullring',                     city: 'Birmingham',   address: 'Bullring Shopping Centre' },
    { name: 'Glasgow',    location: 'Merchant City',                 city: 'Glasgow',      address: '250 St Vincent Street' },
  ];

  console.log('[Seeder] Synchronizing enterprise branch registries...');
  for (const b of defaultBranches) {
    await prisma.branch.upsert({
      where: { name: b.name },
      update: { location: b.location, city: b.city, address: b.address },
      create: b,
    });
  }

  const branches = await prisma.branch.findMany();
  const hqBranch = branches.find((b) => b.name === 'London HQ');
  if (!hqBranch) throw new Error('[Seeder] Critical Error: Headquarters branch instantiation failed.');

  // ── 2. Seed Users ─────────────────────────────────────────────────────────
  const salt = 10;
  const adminEmail = process.env['ADMIN_EMAIL'] || 'admin@steakz.com';
  const hashedDefault = await bcrypt.hash('password123', salt);

  await prisma.user.upsert({
    where:  { email: adminEmail },
    update: { role: Role.ADMIN, is_active: true },
    create: { name: 'Global System Admin', email: adminEmail, password: hashedDefault, role: Role.ADMIN, branchId: null, is_active: true },
  });
  console.log(`[Seeder] ✓ Admin: ${adminEmail}`);

  await prisma.user.upsert({
    where:  { email: 'hqmanager@steakz.com' },
    update: { role: Role.HQ_MANAGER, is_active: true },
    create: { name: 'London Executive', email: 'hqmanager@steakz.com', password: hashedDefault, role: Role.HQ_MANAGER, branchId: hqBranch.id, is_active: true },
  });
  console.log('[Seeder] ✓ HQ Manager: hqmanager@steakz.com');

  // Seed staff per-branch: BRANCH_MANAGER, WAITER, HOST
  console.log('[Seeder] Synchronizing staff per branch...');

  // Keep one global customer
  const coreStaff = [
    { name: 'Avery Guest',    email: 'customer@steakz.com',       role: Role.CUSTOMER,   branch: null },
  ];

  // Create core staff (global customer)
  for (const s of coreStaff) {
    const branch = s.branch ? branches.find((b) => b.name === s.branch) : null;
    await prisma.user.upsert({
      where:  { email: s.email },
      update: { role: s.role, is_active: true },
      create: { name: s.name, email: s.email, password: hashedDefault, role: s.role, branchId: branch?.id ?? null, is_active: true },
    });
  }

  // For each branch, ensure Branch Manager, Waiter, Host, Cashier, Chef, and Delivery Guy exist
  const branchEmailCodes: Record<string, string> = {
    'London HQ': 'ldn',
    'Mayfair':    'may',
    'Manchester': 'man',
    'Edinburgh':  'edi',
    'Birmingham': 'bhm',
    'Glasgow':    'glas',
  };

  for (const branch of branches) {
    const branchShort = branchEmailCodes[branch.name] ?? branch.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

    const perBranch = [
      { name: `${branch.name} Manager`, email: `manager.${branchShort}@steakz.com`, role: Role.BRANCH_MANAGER },
      { name: `${branch.name} Waiter`,  email: `waiter.${branchShort}@steakz.com`,  role: Role.WAITER },
      { name: `${branch.name} Host`,    email: `host.${branchShort}@steakz.com`,    role: Role.HOST },
      { name: `${branch.name} Cashier`, email: `cashier.${branchShort}@steakz.com`, role: Role.CASHIER },
      { name: `${branch.name} Chef`,    email: `chef.${branchShort}@steakz.com`,    role: Role.CHEF },
      { name: `${branch.name} Delivery`, email: `delivery.${branchShort}@steakz.com`, role: Role.DELIVERY_GUY },
    ];

    for (const s of perBranch) {
      await prisma.user.upsert({
        where:  { email: s.email },
        update: { role: s.role, is_active: true },
        create: { name: s.name, email: s.email, password: hashedDefault, role: s.role, branchId: branch.id, is_active: true },
      });
    }
  }

  console.log('[Seeder] ✓ Staff accounts synchronized (branch managers, waiters, hosts seeded; chefs at HQ; delivery & customer excluded from branch seeding)');

  // ── 3. Seed Menu Items (branchId: null = available across all branches) ───
  console.log('[Seeder] Synchronizing restaurant menu catalogue...');
  let menuCreated = 0;
  for (const item of MENU_ITEMS) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.menuItem.create({
        data: { name: item.name, description: item.description, price: item.price, category: item.category, isAvailable: true, branchId: null },
      });
      menuCreated++;
    }
  }
  console.log(`[Seeder] ✓ ${menuCreated} new menu items added (${MENU_ITEMS.length} total in catalogue)`);

  // ── 4. Seed Inventory (one set per branch) ────────────────────────────────
  const inventoryTemplate = [
    { itemName: 'Beef Cuts',      unit: 'kg',    quantity: 45, lowStockAlertAt: 10 },
    { itemName: 'Chicken',        unit: 'kg',    quantity: 8,  lowStockAlertAt: 10 },
    { itemName: 'Lamb',           unit: 'kg',    quantity: 20, lowStockAlertAt: 8  },
    { itemName: 'Cheese',         unit: 'kg',    quantity: 4,  lowStockAlertAt: 5  },
    { itemName: 'Tomatoes',       unit: 'kg',    quantity: 12, lowStockAlertAt: 8  },
    { itemName: 'Cooking Oil',    unit: 'litres', quantity: 15, lowStockAlertAt: 5 },
    { itemName: 'Salt & Spices',  unit: 'kg',    quantity: 6,  lowStockAlertAt: 2  },
    { itemName: 'Bread Rolls',    unit: 'units', quantity: 60, lowStockAlertAt: 20 },
    { itemName: 'Red Wine',       unit: 'bottles', quantity: 24, lowStockAlertAt: 6 },
    { itemName: 'Cream',          unit: 'litres', quantity: 3,  lowStockAlertAt: 4 },
  ];

  console.log('[Seeder] Synchronizing branch inventory...');
  for (const branch of branches) {
    for (const item of inventoryTemplate) {
      await prisma.inventory.upsert({
        where: { branchId_itemName: { branchId: branch.id, itemName: item.itemName } },
        update: {},
        create: { branchId: branch.id, ...item },
      });
    }
  }
  console.log(`[Seeder] ✓ Inventory seeded for ${branches.length} branches`);

  // ── 5. Seed Test Reservations ─────────────────────────────────────────────
  const customer = await prisma.user.findUnique({ where: { email: 'customer@steakz.com' } });
  if (customer && hqBranch) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const testReservations = [
      { reservationTime: new Date(today.setHours(12, 30, 0, 0)), guestsCount: 2, tableNumber: 3,  status: 'CONFIRMED' },
      { reservationTime: new Date(today.setHours(14, 0, 0, 0)),  guestsCount: 4, tableNumber: 7,  status: 'PENDING'   },
      { reservationTime: new Date(today.setHours(18, 0, 0, 0)),  guestsCount: 6, tableNumber: 12, status: 'PENDING'   },
      { reservationTime: new Date(tomorrow.setHours(19, 30, 0, 0)), guestsCount: 2, tableNumber: 5, status: 'PENDING' },
    ];

    let resCreated = 0;
    for (const r of testReservations) {
      const existing = await prisma.reservation.findFirst({
        where: { branchId: hqBranch.id, customerId: customer.id, reservationTime: r.reservationTime }
      });
      if (!existing) {
        await prisma.reservation.create({
          data: { branchId: hqBranch.id, customerId: customer.id, ...r }
        });
        resCreated++;
      }
    }
    if (resCreated > 0) console.log(`[Seeder] ✓ ${resCreated} test reservations created`);
  }

  console.log('[Seeder] Enterprise ledger synchronization complete.');
}
