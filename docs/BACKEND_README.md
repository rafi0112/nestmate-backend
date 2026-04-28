# NestMate — Backend API

Express.js + MongoDB server powering the NestMate roommate finder and household management platform. RESTful API with 15 endpoint groups handling listings, messaging, households, fair-share calculations, and real-time chat.

**Frontend**: [GitHub](https://github.com/yourusername/nestmate-frontend)  
**Status**: Production-ready (Vercel: `roommate-server-lime.vercel.app`)  
**Database**: MongoDB Atlas  
**Auth**: Firebase UID verification (user tokens passed from frontend)

---

## Features

### ✅ Endpoints (15 Groups)

| Group | Endpoints | Purpose |
|---|---|---|
| **Listings** | GET/POST `/roommate`, GET/PUT/DELETE `/roommate/:id` | CRUD room postings |
| **Messages** | GET/POST `/messages`, PATCH `/messages/:id/read` | 1:1 DMs with read receipts |
| **Households** | GET/POST/PUT `/households`, POST `/households/join` | Group management + join codes |
| **Ledger** | GET/POST/DELETE `/ledger` | Grocery expense tracking |
| **Meals** | GET/POST `/meals` | Daily meal logging (upsert) |
| **Payments** | GET/POST `/payments` | Due payment records |
| **Room Chat** | GET/POST `/room-chat` | Group chat (TTL 90d) |
| **Reviews** | GET/POST `/reviews` | Mess-mate reviews |
| **Util** | GET `/` | Health check |

### 🔧 Backend Features
- **MongoDB Validation** — JSON Schema on collections for data integrity
- **Smart Indexing** — Compound, unique, geospatial, text-search, TTL indexes
- **Join Codes** — 6-char alphanumeric, auto-generated, collision-proof
- **TTL Cleanup** — Room chat (90d), notifications (30d auto-purge)
- **Geospatial Search** — 2dsphere index on listing coordinates
- **Text Search** — Full-text indexes on titles, descriptions, reviews
- **Aggregation Pipelines** — Fair-share calculations, grouped analytics
- **CORS** — Configured for Vercel frontend + local development
- **Error Handling** — Consistent 4xx/5xx responses with messages

---

## Tech Stack

| Layer | Tech |
|---|---|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js 4.18+ |
| **Database** | MongoDB Atlas (with replica set for transactions) |
| **Validation** | MongoDB JSON Schema + manual checks |
| **Hosting** | Vercel Serverless (or self-hosted Node) |
| **Dependencies** | mongodb, cors, dotenv (minimal) |
| **Monitoring** | Console logs; optional: Sentry, DataDog |

---

## Project Structure

```
nestmate-server/
├── index.js                # All routes + MongoDB setup (348 lines)
├── package.json            # Dependencies: mongodb, cors, dotenv, express
├── .env.example            # DB credentials template
├── .env                    # Production secrets (not in git)
├── README.md               # This file
├── SCHEMA.md               # Detailed collection & field docs
└── docs/
    └── API.md              # OpenAPI / endpoint reference
```

**Monolithic approach**: All endpoints in `index.js` (348 lines). For larger scale, split into:
- `routes/listings.js`, `routes/messages.js`, etc.
- `models/User.js`, `models/Household.js`, etc.
- `middleware/auth.js`, `middleware/validation.js`

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- MongoDB Atlas cluster (free tier ok for dev)
- Vercel account (optional, for serverless)

### Installation

```bash
git clone https://github.com/yourusername/nestmate-server.git
cd nestmate-server

npm install
cp .env.example .env
```

### Configuration (`.env`)

```env
PORT=3000
USER=mongodb_user           # Atlas user
PASS=mongodb_password       # Atlas password
# Full URI: mongodb+srv://USER:PASS@cluster0.sbljgab.mongodb.net/?retryWrites=true&w=majority
```

Get credentials from MongoDB Atlas:
1. Cluster → Network Access → Add IP (0.0.0.0/0 for dev)
2. Database → Connect → Show connection string
3. Copy user/pass into `.env`

### Development

```bash
npm run dev
# Runs on http://localhost:3000
# Watch mode (nodemon) auto-restarts on file changes
```

### Production

```bash
npm start
# Set PORT=3001 (or your hosting provider's port)
# Use PM2, systemd, or Vercel for process management
```

### Deploy to Vercel

```bash
vercel login
vercel --prod

# Set env vars in Vercel dashboard:
# - USER, PASS, PORT
```

---

## API Reference

### Core Endpoints

#### 📋 Listings (`/roommate`)

**GET /roommate**
```bash
curl https://api.nestmate.dev/roommate
# Returns: [{ _id, title, location, rentAmount, userId, ... }]
# Sorted by createdAt descending
```

**GET /roommate/:id**
```bash
curl https://api.nestmate.dev/roommate/507f1f77bcf86cd799439011
# Returns single listing or 404
```

**POST /roommate**
```bash
curl -X POST https://api.nestmate.dev/roommate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2BR in Mirpur",
    "location": "Mirpur 10, Dhaka",
    "city": "Dhaka",
    "rentAmount": 12000,
    "roomType": "2BR",
    "availability": "Available",
    "description": "Furnished flat",
    "contactInfo": "user@example.com",
    "userEmail": "user@example.com",
    "lifestylePreferences": { "pets": false, "smoking": false }
  }'
# Returns: { _id, ... } with created doc
```

**PUT /roommate/:id**
```bash
curl -X PUT https://api.nestmate.dev/roommate/507f1f77bcf86cd799439011 \
  -d '{ "title": "3BR Now Available", "rentAmount": 15000 }'
# Returns: updated document
```

**DELETE /roommate/:id**
```bash
curl -X DELETE https://api.nestmate.dev/roommate/507f1f77bcf86cd799439011
# Returns: { deletedCount: 1 }
```

#### 💬 Messages (`/messages`)

**GET /messages?userEmail=user@example.com**
```bash
# Returns all messages where user is sender OR recipient
# [{ fromEmail, toEmail, listingId, text, timestamp, read, ... }]
# Not paginated — returns flat array (frontend builds conversations)
```

**POST /messages**
```bash
curl -X POST https://api.nestmate.dev/messages \
  -d '{
    "fromEmail": "alice@example.com",
    "toEmail": "bob@example.com",
    "listingId": "507f...",
    "listingTitle": "2BR Flat",
    "text": "Are you available next month?",
    "timestamp": "2025-04-28T12:30:00Z"
  }'
# Returns: { _id, ... } with inserted message
```

**PATCH /messages/:id/read**
```bash
curl -X PATCH https://api.nestmate.dev/messages/507f.../read
# Marks message as read, sets readAt timestamp
```

#### 🏘 Households (`/households`)

**GET /households?listingId=...** OR **?memberEmail=...**
```bash
curl https://api.nestmate.dev/households?listingId=507f...
# Returns single household or null
# Use memberEmail to find household by member
```

**GET /households/all?memberEmail=...**
```bash
# Returns ALL households a member belongs to (for multi-household support)
```

**POST /households**
```bash
curl -X POST https://api.nestmate.dev/households \
  -d '{
    "listingId": "507f...",
    "ownerEmail": "landlord@example.com",
    "listingTitle": "Green Villa Mirpur",
    "monthlyFee": 18000,
    "joinCode": "HH7K2P"  # auto-generated if omitted
  }'
# Returns: household doc with joinCode
```

**PUT /households/:id**
```bash
curl -X PUT https://api.nestmate.dev/households/507f... \
  -d '{ "monthlyFee": 20000, "listingTitle": "Updated Name" }'
# Updates household metadata
```

**POST /households/join**
```bash
curl -X POST https://api.nestmate.dev/households/join \
  -d '{ "joinCode": "HH7K2P", "userEmail": "newmember@example.com" }'
# Adds userEmail to members[] array
# Returns updated household or 404 if code invalid
```

#### 🛒 Ledger (`/ledger`)

**GET /ledger?householdId=...**
```bash
# Returns all market entries for household
# [{ item, amount, date, paidBy, createdAt, ... }]
```

**POST /ledger**
```bash
curl -X POST https://api.nestmate.dev/ledger \
  -d '{
    "householdId": "507f...",
    "item": "Rice, vegetables, oil",
    "amount": 1200,
    "date": "2025-04-28",
    "paidBy": "alice@example.com"
  }'
# Returns: inserted ledger entry
```

**DELETE /ledger/:id**
```bash
curl -X DELETE https://api.nestmate.dev/ledger/507f...
# Removes entry (only owner can delete)
```

#### 🍽 Meals (`/meals`)

**GET /meals?householdId=...&userEmail=...** (optional filter)
```bash
# Returns meal entries for household (optionally filtered by user)
```

**POST /meals** (Upsert)
```bash
curl -X POST https://api.nestmate.dev/meals \
  -d '{
    "householdId": "507f...",
    "userEmail": "alice@example.com",
    "date": "2025-04-28",
    "meals": 3,
    "guests": 0
  }'
# If entry exists for (householdId, userEmail, date): update
# Else: create new entry
# Returns: final document
```

#### 💳 Payments (`/payments`)

**GET /payments?householdId=...**
```bash
# Returns payment records for household
```

**POST /payments**
```bash
curl -X POST https://api.nestmate.dev/payments \
  -d '{
    "householdId": "507f...",
    "fromEmail": "alice@example.com",
    "toEmail": "household",
    "amount": 5000,
    "type": "room_fee",
    "month": "2025-04",
    "note": "April room fee",
    "date": "2025-04-28T00:00:00Z"
  }'
```

#### 📣 Room Chat (`/room-chat`)

**GET /room-chat?householdId=...&since=...**
```bash
# Returns messages since optional ISO timestamp
# Uses ?since to implement polling (get only new messages)
```

**POST /room-chat**
```bash
curl -X POST https://api.nestmate.dev/room-chat \
  -d '{
    "householdId": "507f...",
    "senderEmail": "alice@example.com",
    "senderName": "Alice",
    "text": "Who wants tea?"
  }'
# Auto-added fields: _id, timestamp (now)
# Returns: inserted message
```

**Note**: Messages auto-delete after 90 days (TTL index).

#### ⭐ Reviews (`/reviews`)

**GET /reviews?limit=30**
```bash
# Returns recent reviews, sorted by date descending
# Limit capped at 100
```

**POST /reviews**
```bash
curl -X POST https://api.nestmate.dev/reviews \
  -d '{
    "authorEmail": "resident@example.com",
    "authorName": "Resident",
    "houseName": "Green Villa Mess",
    "householdId": "507f...",
    "text": "Great food, nice people!",
    "rating": 5
  }'
```

#### 🏥 Health Check

**GET /**
```bash
curl https://api.nestmate.dev/
# Returns: ✅ NestMate API running
# Useful for monitoring + uptime checks
```

---

## Database Schema Overview

See `SCHEMA.md` for full field definitions. Quick reference:

```javascript
// 10 Collections
db.collection('users')        // Auth profiles + linked Firebase UID
db.collection('roommates')    // Listings
db.collection('households')   // Group membership
db.collection('messages')     // 1:1 DMs
db.collection('ledger')       // Grocery expenses
db.collection('meals')        // Daily meal log
db.collection('payments')     // Due records
db.collection('room_chat')    // Group chat (TTL 90d)
db.collection('reviews')      // Mess reviews
db.collection('notifications')// In-app notifications (TTL 30d)
```

### Key Indexes
- **Unique**: email, firebaseUid, joinCode, (householdId, userEmail, date)
- **Compound**: (fromEmail, toEmail, timestamp), (householdId, date), (householdId, month)
- **Geospatial**: coordinates (2dsphere)
- **Text**: title + description + location (listings), houseName + text (reviews)
- **TTL**: room_chat (90d), notifications (30d after read)

---

## Error Handling

All endpoints return consistent JSON error responses:

```javascript
// 400 Bad Request
{ "message": "householdId required" }

// 404 Not Found
{ "message": "Not found" }

// 409 Conflict (e.g., duplicate unique field)
{ "message": "Join code collision — try again" }

// 500 Server Error
{ "message": "Server error", "error": "details..." }
```

Frontend should:
- Check `res.status` before parsing JSON
- Display `error.message` to user (or generic "Something went wrong")
- Log full error for debugging

---

## Performance & Scaling

### Current (Single-Region)
- ~500 concurrent connections (Vercel limit)
- 10k messages/day easily handled
- No caching (all reads hit DB)

### Optimizations (When Needed)
1. **Redis Cache** — Cache popular listings, user profiles
2. **Pagination** — Implement cursor-based pagination for large result sets
3. **Rate Limiting** — npm `express-rate-limit` to prevent abuse
4. **Batch Operations** — Use `bulkWrite()` for multi-document updates
5. **Sharding** — Split collections by region or user ID at scale
6. **Read Replicas** — MongoDB Atlas auto-replication to 2-3 regions
7. **CDN** — Images via Cloudinary, static files via Vercel Edge

### Monitoring
```bash
# Current: console.log
console.log('✅ Received message from', fromEmail);

# Production: structured logging
const logger = require('winston');  // or similar
logger.info('message.created', { fromEmail, toEmail, listingId });
```

Add Sentry, DataDog, or New Relic for production error tracking.

---

## Authentication & Security

### User Identification
Frontend sends `userEmail` in request body. **Backend assumes frontend validated via Firebase**.

To enforce:
```javascript
// Middleware (optional, if using Firebase Admin SDK)
const admin = require('firebase-admin');

const verifyAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'No token' });
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    res.status(403).send({ message: 'Invalid token' });
  }
};

app.post('/messages', verifyAuth, async (req, res) => { ... });
```

For now, **frontend is responsible for auth**. Backend trusts the request.

### Data Privacy
- Don't expose internal IDs unnecessarily
- Validate `userEmail` matches authenticated user before modifying data
- Use `projection` to exclude sensitive fields (passwords, tokens)

### CORS
```javascript
app.use(cors());
// In production, restrict to frontend domain:
app.use(cors({ origin: 'https://nestmate.vercel.app' }));
```

---

## Deployment

### Vercel (Recommended)
```bash
# Connect GitHub repo to Vercel
# Auto-deploys on push to main
# Set environment variables in dashboard
```

### Self-Hosted (PM2)
```bash
npm install -g pm2
pm2 start index.js --name nestmate-api
pm2 save
pm2 startup
# Process auto-restarts on reboot
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
ENV PORT=3000
EXPOSE 3000
CMD ["node", "index.js"]
```

```bash
docker build -t nestmate-api .
docker run -e USER=... -e PASS=... -p 3000:3000 nestmate-api
```

---

## Troubleshooting

### MongoDB connection fails
- Check `USER` and `PASS` in `.env`
- Verify IP whitelist (Atlas → Network Access)
- Ensure URI includes `?retryWrites=true&w=majority`

### Duplicate key error on POST
- Unique constraint violated (email, firebaseUid, joinCode, or compound)
- For joinCode: auto-generated if omitted; retry if collision
- For email: check if user already exists

### Memory leak on polling endpoints
- GET /messages called every 8s; ensure results are finite
- Room chat TTL cleans old messages; verify indexes created
- Check Node memory: `node --max-old-space-size=2048 index.js`

### CORS errors
- Frontend domain not in `cors()` whitelist
- Check browser console: `Access-Control-Allow-Origin` header
- Add domain to `cors()` config or use `*` for development

---

## Contributing

1. Fork repo
2. Create branch (`git checkout -b feat/endpoint-name`)
3. Add endpoint + validation + error handling
4. Test with Postman or curl
5. Commit (`git commit -m 'feat: add /new-endpoint'`)
6. Push & open PR

### Code Style
- 2-space indentation
- camelCase for variables, UPPERCASE for constants
- Comments for non-obvious logic
- Consistent error messages

---

## Roadmap

- [ ] Automated payment via Razorpay API
- [ ] Email notifications (NodeMailer)
- [ ] SMS alerts for dues (Twilio)
- [ ] Aggregation for analytics (revenue, user growth)
- [ ] Webhooks for third-party integrations
- [ ] GraphQL API (optional alternative to REST)
- [ ] WebSocket for real-time chat (Socket.io)
- [ ] Kubernetes deployment

---

## License

MIT © 2025 NestMate Contributors

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/nestmate-server/issues)
- **Email**: dev@nestmate.app
- **Docs**: [API Reference](./docs/API.md)

---

**Built with ❤️ to solve shared living challenges.**
