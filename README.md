# CartLy — Full-Stack MERN eCommerce Platform (Microservices)

A production-grade, enterprise-level eCommerce platform built with the MERN stack (MongoDB, Express.js, React, Node.js). The backend has been fully migrated from a monolithic architecture to **10 independent microservices**, each with its own database connection, routes, and deployment lifecycle.

---

## Architecture Overview

```
                        ┌─────────────┐
                        │   Frontend  │  React 18 + TypeScript (port 5173)
                        └──────┬──────┘
                               │ HTTP / REST
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
       ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
       │ auth-service│  │user-service  │  │product-service│
       │   :3001     │  │    :3002     │  │    :3003      │
       └─────────────┘  └──────────────┘  └──────────────┘
       ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
       │order-service│  │ cart-service │  │review-service│
       │   :3004     │  │    :3005     │  │    :3006     │
       └─────────────┘  └──────────────┘  └──────────────┘
       ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
       │warehouse-svc │ │ admin-service│  │notification  │
       │   :3007      │ │    :3008     │  │    :3009     │
       └──────────────┘ └──────────────┘  └──────────────┘
                        ┌──────────────┐
                        │upload-service│
                        │    :3010     │
                        └──────────────┘
```

Each service is a standalone Express.js application with its own `package.json`, `Dockerfile`, `.env`, and internal route/controller/model structure.

---

## Microservices

| Service | Port | Responsibility |
|---|---|---|
| `auth-service` | 3001 | Login, register, OAuth, JWT, password reset, email verify |
| `user-service` | 3002 | Profiles, addresses, seller upgrade, wishlist |
| `product-service` | 3003 | Product CRUD, search, categories, wishlist toggle |
| `order-service` | 3004 | Order lifecycle, Stripe payments, returns |
| `cart-service` | 3005 | Cart operations, coupon application |
| `review-service` | 3006 | Product reviews, ratings, helpful votes |
| `warehouse-service` | 3007 | Parcel scanning, check-in, carrier management |
| `admin-service` | 3008 | Dashboard, user/product management, audit logs, coupons |
| `notification-service` | 3009 | Email delivery, templates (internal — no public routes) |
| `upload-service` | 3010 | Image upload, Sharp processing, Cloudinary storage |

---

## Tech Stack

### Backend (per service)
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js 4.x |
| Database | MongoDB 7 + Mongoose 8 |
| Cache / Sessions | Redis 7 |
| Auth | JWT (access + refresh tokens) + Passport.js |
| OAuth | Google OAuth 2.0 |
| Payments | Stripe (PaymentIntents + Webhooks) |
| File Storage | Multer + Sharp + Cloudinary |
| Email | Nodemailer (SMTP) |
| Validation | Joi + Celebrate + express-validator |
| Logging | Winston + Morgan |
| Caching | apicache + Redis |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build Tool | Vite 5 |
| State | Redux Toolkit + React Query (TanStack v5) |
| Routing | React Router v6 |
| Styling | Tailwind CSS 3 |
| Forms | React Hook Form + Zod |
| Animation | Framer Motion |
| Charts | Recharts |
| HTTP | Axios (with interceptors, token refresh, per-route 401 handling) |
| Payments | Stripe.js + @stripe/react-stripe-js |
| Icons | Lucide React |
| Carousel | Swiper |
| Notifications | React Hot Toast |

### Infrastructure
| Layer | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx (rate-limiting, compression, static files) |
| Monorepo Runner | concurrently (root `package.json`) |
| Process | Graceful shutdown, cluster-ready |

---

## Security Features

### Authentication & Authorization
- JWT access tokens (15min) + refresh tokens (7d) with rotation
- Token blacklisting via Redis on logout
- OAuth 2.0 — Google sign-in
- Role-Based Access Control — `user` / `seller` / `admin` / `superadmin` / `warehouse`
- Brute-force protection — account lockout after 5 failed attempts
- Password reset with time-limited cryptographic tokens
- Email verification flow
- Seller approval workflow (admin must approve)

### Security Middleware
- **Helmet** — 15 secure HTTP headers
- **CORS** — whitelist-based origin control
- **Rate Limiting** — global (100/15min), auth (10/5min with auto-reset on successful login), uploads (30/hr) — backed by Redis
- **MongoDB Sanitization** — prevents NoSQL injection (`express-mongo-sanitize`)
- **XSS Clean** — strips malicious HTML/JS from inputs
- **HPP** — HTTP Parameter Pollution prevention
- **CSRF** — SameSite cookie policy + token validation

### Data & Performance
- Response caching via Redis (`apicache`) with automatic invalidation
- Compression — gzip responses (threshold: 1KB)
- ETag — conditional requests for client-side caching
- Image optimization — Sharp resizes & converts to WebP before Cloudinary upload
- Cloud image storage — Cloudinary (CDN-served, UUID-namespaced public IDs prevent cross-user collisions)
- Old image cleanup — previous avatar/logo/banner/product images deleted from Cloudinary on replace
- Full-text search — MongoDB text indexes
- Audit Logs — every admin action tracked in DB (90-day TTL)
- Performance timing — slow request detection (>1000ms)
- Request IDs — traceable across request lifecycle

---

## Features

### For Buyers / Users
- Browse products with advanced filtering (price, rating, category, tags, stock)
- Full-text search with fuzzy matching and autocomplete
- Product detail with image gallery, variants, ratings
- Shopping cart (persistent, synced to backend)
- Coupon / discount code application
- Stripe checkout with real-time payment
- Order tracking with status history
- Wishlist management
- Address book (multiple shipping addresses)
- Email notifications (order confirmations, shipping)
- Profile & preference management
- Become Seller upgrade flow

### For Sellers
- Upgrade from buyer to seller (admin approval flow)
- Seller dashboard with revenue charts, top products (Recharts)
- Full product management (add/edit/delete with image upload)
- Inventory tracking & low-stock alerts
- Order management & status updates
- Store profile with custom slug
- Product analytics (views, sales, revenue)
- Variant support (sizes, colors, etc.)
- SEO fields (meta title, description)

### For Admins
- Real-time dashboard with charts (Recharts)
- User management — view, activate, ban, role assignment
- Seller approval workflow with email notification
- Product oversight — all sellers' products
- Order management across all sellers
- Category management (CRUD)
- Coupon management (create, deactivate, delete)
- Carrier / shipping management
- Warehouse management — create, edit, activate/deactivate, delete warehouse accounts
- User feedback management
- Audit log viewer (superadmin only)
- Revenue analytics & growth tracking

### For Warehouse Staff
- Dedicated warehouse portal with role-gated access
- Parcel scanner — look up orders by order number (e.g. `CUR-xxx`) or MongoDB ID
- Check-in actions per order status: Mark as Processing, Shipped, Out for Delivery, Delivered, or Location Update only
- Tracking number capture when marking an order as Shipped
- Location and note fields attached to each check-in event
- Full status history timeline showing which warehouse handled each update
- Auto-redirect to warehouse portal on login

---

## Project Structure

<details>
  <summary>📂 Project Structure</summary>

```text
myCartlyV2/
├── services/
│   ├── auth-service/         # :3001 — login, register, OAuth, JWT, password reset
│   │   ├── config/           # db.js, redis.js, passport.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/           # User
│   │   ├── routes/
│   │   ├── utils/            # ApiError, ApiResponse, email, jwt, logger
│   │   ├── server.js
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── user-service/         # :3002 — profiles, addresses, wishlist, become-seller
│   ├── product-service/      # :3003 — product CRUD, search, categories
│   ├── order-service/        # :3004 — orders, Stripe, returns
│   ├── cart-service/         # :3005 — cart operations, coupons
│   ├── review-service/       # :3006 — reviews, ratings, helpful votes
│   ├── warehouse-service/    # :3007 — parcel scanner, check-in, carriers
│   ├── admin-service/        # :3008 — dashboard, users, audit logs, coupons
│   ├── notification-service/ # :3009 — email delivery (internal, no public routes)
│   └── upload-service/       # :3010 — image upload, Sharp, Cloudinary
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.ts            # Axios instance + interceptors + token refresh
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── cart/
│   │   │   │   └── CartSidebar.tsx
│   │   │   ├── feedback/
│   │   │   │   └── FeedbackModal.tsx
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── SellerLayout.tsx
│   │   │   │   └── WarehouseLayout.tsx
│   │   │   └── products/
│   │   │       └── ProductCard.tsx
│   │   ├── hooks/
│   │   │   └── useOrderStatusUpdate.ts
│   │   ├── pages/
│   │   │   ├── BecomeSeller.tsx
│   │   │   ├── Cart.tsx
│   │   │   ├── Checkout.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── OAuthCallback.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── ResetPassword.tsx
│   │   │   ├── Store.tsx
│   │   │   ├── VerifyEmail.tsx
│   │   │   ├── Wishlist.tsx
│   │   │   ├── admin/
│   │   │   │   ├── AuditLogs.tsx
│   │   │   │   ├── Carriers.tsx
│   │   │   │   ├── Categories.tsx
│   │   │   │   ├── Coupons.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Feedback.tsx
│   │   │   │   ├── Orders.tsx
│   │   │   │   ├── Products.tsx
│   │   │   │   ├── Users.tsx
│   │   │   │   └── Warehouses.tsx
│   │   │   ├── seller/
│   │   │   │   ├── AddProduct.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── EditProduct.tsx
│   │   │   │   ├── Orders.tsx
│   │   │   │   ├── Products.tsx
│   │   │   │   └── Profile.tsx
│   │   │   └── warehouse/
│   │   │       └── Scan.tsx
│   │   ├── store/
│   │   │   ├── slices/
│   │   │   │   ├── authSlice.ts
│   │   │   │   ├── cartSlice.ts
│   │   │   │   ├── productSlice.ts
│   │   │   │   └── uiSlice.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── fuzzy.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx-spa.conf
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Legacy monolith (reference only — not used in dev/prod scripts)
├── docker-compose.yml
├── mongo-init.js             # MongoDB initialization script
├── nginx.conf
└── package.json              # Monorepo root — runs all services via concurrently
```
</details>

---

## API Routes Reference

### Auth Service — `http://localhost:3001/api/auth`
| Method | Route | Access |
|---|---|---|
| POST | `/register` | Public |
| POST | `/login` | Public |
| POST | `/logout` | Private |
| POST | `/refresh` | Public |
| GET | `/me` | Private |
| POST | `/forgot-password` | Public |
| PUT | `/reset-password/:token` | Public |
| GET | `/verify-email/:token` | Public |
| PUT | `/change-password` | Private |
| GET | `/google` | OAuth |
| GET | `/google/callback` | OAuth |

### Product Service — `http://localhost:3003/api/products`
| Method | Route | Access |
|---|---|---|
| GET | `/` | Public |
| GET | `/featured` | Public |
| GET | `/my-products` | Seller |
| GET | `/seller-stats` | Seller |
| GET | `/:slug` | Public |
| GET | `/:id/related` | Public |
| POST | `/` | Seller |
| PUT | `/:id` | Seller (own) |
| DELETE | `/:id` | Seller (own) |
| POST | `/:id/wishlist` | Private |

### Order Service — `http://localhost:3004/api/orders`
| Method | Route | Access |
|---|---|---|
| POST | `/` | Private |
| GET | `/my-orders` | Private |
| GET | `/seller-orders` | Seller |
| GET | `/:id` | Private (own/admin) |
| PUT | `/:id/status` | Seller/Admin |
| POST | `/:id/return` | Private |
| POST | `/webhook` | Stripe |

### Cart Service — `http://localhost:3005/api/cart`
| Method | Route | Access |
|---|---|---|
| GET | `/` | Private |
| POST | `/` | Private |
| PUT | `/:itemId` | Private |
| DELETE | `/:itemId` | Private |
| DELETE | `/` | Private |

### Review Service — `http://localhost:3006/api/reviews`
| Method | Route | Access |
|---|---|---|
| POST | `/:productId` | Private |
| PUT | `/:id` | Private (own) |
| DELETE | `/:id` | Private (own) |

### Warehouse Service — `http://localhost:3007/api/warehouse`
| Method | Route | Access |
|---|---|---|
| GET | `/scan?q=` | Warehouse |
| PUT | `/orders/:id/check-in` | Warehouse |
| GET/POST/PUT/DELETE | `/carriers` | Admin/Warehouse |

### Admin Service — `http://localhost:3008/api/admin`
| Method | Route | Access |
|---|---|---|
| GET | `/dashboard` | Admin |
| GET | `/users` | Admin |
| PUT | `/users/:id` | Admin |
| DELETE | `/users/:id` | Admin |
| POST | `/users/:id/approve-seller` | Admin |
| GET | `/products` | Admin |
| GET | `/orders` | Admin |
| GET/POST/DELETE | `/coupons` | Admin |
| GET/POST/PUT/DELETE | `/categories` | Admin |
| GET/DELETE | `/feedback` | Admin |
| GET | `/audit-logs` | Superadmin |
| GET/POST/PUT/DELETE | `/warehouses` | Admin |

### User Service — `http://localhost:3002/api/users`
| Method | Route | Access |
|---|---|---|
| PUT | `/profile` | Private |
| GET/POST/PUT/DELETE | `/addresses` | Private |
| POST | `/become-seller` | Private |
| GET | `/wishlist` | Private |

### Upload Service — `http://localhost:3010/api/upload`
| Method | Route | Access |
|---|---|---|
| POST | `/image` | Private |

### Feedback — (via Admin or User Service)
| Method | Route | Access |
|---|---|---|
| POST | `/feedback` | Private |
| GET | `/feedback` | Admin |
| DELETE | `/feedback/:id` | Admin |

---

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB 7+
- Redis 7+
- Cloudinary account (free tier)
- (Optional) Docker + Docker Compose

### Option A — Manual Setup (Monorepo)

**1. Install all dependencies**
```bash
npm run install:all
```

**2. Configure environment for each service**
```bash
# Copy .env.example to .env in each service and fill in your values
cp services/auth-service/.env.example services/auth-service/.env
cp services/user-service/.env.example services/user-service/.env
cp services/product-service/.env.example services/product-service/.env
cp services/order-service/.env.example services/order-service/.env
cp services/cart-service/.env.example services/cart-service/.env
cp services/review-service/.env.example services/review-service/.env
cp services/warehouse-service/.env.example services/warehouse-service/.env
cp services/admin-service/.env.example services/admin-service/.env
cp services/notification-service/.env.example services/notification-service/.env
cp services/upload-service/.env.example services/upload-service/.env
```

**3. Start all services + frontend**
```bash
npm run dev
```

This uses `concurrently` to launch all 10 backend services plus the Vite dev server simultaneously with color-coded prefixed output.

Open: `http://localhost:5173`

---

### Option B — Docker Compose

```bash
# Copy and edit env files first (see above)

# Start everything
docker-compose up --build
```

Open: `http://localhost`

Docker services:
- **MongoDB** (mongo:7.0) — port 27017
- **Redis** (redis:7.2-alpine) — port 6379
- **All 10 backend services** — ports 3001–3010
- **Frontend** (React/Vite) — port 80
- **Nginx** — ports 80 / 443 (reverse proxy)

---

## Default Test Accounts

| Role | Email | Password |
|---|---|---|
| Superadmin | superadmin@CartLy.com | Admin@123456 |
| Admin | admin@CartLy.com | Admin@123456 |
| Seller | seller@CartLy.com | Seller@123456 |
| Seller 2 | seller2@CartLy.com | Seller@123456 |
| User | user@CartLy.com | User@123456 |

---

## Environment Variables

Each service has its own `.env.example`. Key variables shared across services:

```env
# Server
NODE_ENV=development
PORT=300x               # 3001–3010 per service
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/CartLy_ecommerce

# Redis
REDIS_URL=redis://localhost:6379

# JWT (auth-service)
JWT_SECRET=your-32-char-minimum-secret
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRE=7d
JWT_COOKIE_EXPIRE=7

# OAuth — Google (auth-service)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Session (auth-service)
SESSION_SECRET=your-session-secret

# Email (notification-service)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_NAME=CartLy
FROM_EMAIL=noreply@CartLy.com

# Stripe (order-service)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary (upload-service, product-service, user-service)
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
# or individual vars:
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10

# Crypto
CRYPTO_SECRET=your-crypto-secret-32-chars-minimum
```

---

## Design System

The UI follows an **editorial/luxury** aesthetic:

- **Typography**: Manrope (headlines) + Plus Jakarta Sans (body) + JetBrains Mono (code)
- **Color**: Deep navy `#1A237E` primary, neutral surfaces, precise accent system
- **Spacing**: 8px grid system
- **Border Radius**: Sharp (2px–8px), intentionally not rounded
- **Motion**: Framer Motion — staggered reveals, slide-in drawers, scale animations
- **Shadows**: Editorial shadow system (light, directional)

---

## Nginx Configuration

`nginx.conf` (root, for Docker) configures:
- Worker connections: 1024
- Client max body size: 20MB
- Rate limit zones: API (30 req/min), Auth (10 req/min)
- Gzip compression (level 6)
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
- Reverse proxy to backend services and frontend

`frontend/nginx-spa.conf` handles SPA fallback (`try_files $uri /index.html`).

---

## Production Deployment

1. Set `NODE_ENV=production` in all service `.env` files
2. Use strong, unique secrets for all JWT/session keys
3. Configure HTTPS in Nginx (add SSL certificates)
4. Set up MongoDB Atlas or a managed MongoDB cluster
5. Use managed Redis (Redis Cloud / Upstash)
6. Configure Stripe webhooks pointing to `http://<your-domain>/api/orders/webhook` (routed to order-service)
7. Set `CLOUDINARY_URL` in upload/product/user services
8. Configure a production SMTP service (SendGrid, Resend, Postmark, etc.)

---

## Changelog

### v2 — Microservices Migration
- **Architecture rewrite** — Monolithic `backend/` fully decomposed into **10 independent Express microservices** (`services/`), each running on its own port (3001–3010) with its own DB connection, Dockerfile, and `.env`.
- **Monorepo setup** — Root `package.json` uses `concurrently` to start all services and the frontend in parallel with color-coded terminal output (`npm run dev`).
- **`mongo-init.js`** — Added MongoDB initialization script for Docker-based bootstrapping.
- **Service isolation** — `notification-service` has no public routes (internal email delivery); `upload-service` has no DB connection (stateless image processor).

### Warehouse System
- **Warehouse role** — Added a fifth user role (`warehouse`) alongside user / seller / admin / superadmin.
- **Warehouse model** — New `Warehouse` Mongoose model with name, code, address, linked manager, active status, and `locationLabel` virtual.
- **Admin warehouse management** — Admins can create, edit, activate/deactivate, and delete warehouse accounts. Creating a warehouse auto-creates a linked User account and emails temporary credentials.
- **Warehouse portal** — Staff land at `/warehouse/scan` after login. Parcel scanner accepts order number or MongoDB ID.
- **Parcel check-in** — Status-appropriate actions with tracking number capture; each check-in records `warehouseName` in `statusHistory`.
- **Admin action menu fix** — Removed `overflow-hidden` + added outside-click handler so the dropdown no longer clips or causes page scroll.

### Auth & Security
- **Google OAuth fixed** — Callback now sets auth cookies and redirects to `/oauth/callback?token=...`; new `OAuthCallback` page hydrates Redux then navigates home.
- **Facebook OAuth removed** — Strategy, routes, and login button removed. Google is the only OAuth provider.
- **Auth error messages** — Login failures now surface the correct API message instead of Axios's generic 401 string. Auth endpoints excluded from the refresh retry interceptor.
- **Auth rate limiter** — Window reduced from 15min to 5min; IP counter cleared automatically after a successful login.

### Images & Storage
- **Cloudinary migration** — All images (avatars, logos, banners, product photos) uploaded to Cloudinary and served via CDN. Fixes persistence on ephemeral platforms like Render.
- **UUID public IDs** — Every upload gets a `cartly/<folder>/<uuid>` public ID preventing cross-user file collisions.
- **Old image cleanup** — Previous Cloudinary assets deleted automatically when replaced; `public_id` stored in MongoDB alongside the URL.

---

## License

MIT — Built with love for CartLy Platform
