// MongoDB initialisation script
// Runs once when the container is first created (docker-entrypoint-initdb.d)

db = db.getSiblingDB('CartLy_ecommerce');

// Create an app-level user scoped to this database
db.createUser({
  user: 'cartly_app',
  pwd: 'cartly_app_pass',
  roles: [{ role: 'readWrite', db: 'CartLy_ecommerce' }],
});

// Seed initial categories
db.categories.insertMany([
  { name: 'Electronics',    slug: 'electronics',    isActive: true, sortOrder: 1 },
  { name: 'Clothing',       slug: 'clothing',       isActive: true, sortOrder: 2 },
  { name: 'Home & Garden',  slug: 'home-garden',    isActive: true, sortOrder: 3 },
  { name: 'Sports',         slug: 'sports',         isActive: true, sortOrder: 4 },
  { name: 'Books',          slug: 'books',          isActive: true, sortOrder: 5 },
  { name: 'Toys & Games',   slug: 'toys-games',     isActive: true, sortOrder: 6 },
  { name: 'Beauty',         slug: 'beauty',         isActive: true, sortOrder: 7 },
  { name: 'Automotive',     slug: 'automotive',     isActive: true, sortOrder: 8 },
]);

print('CartLy_ecommerce initialised with categories and app user.');
