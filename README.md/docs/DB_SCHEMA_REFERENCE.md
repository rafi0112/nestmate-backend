# NestMate Database Schema Reference

Complete MongoDB schema with all 10 collections, field definitions, indexes, and relationships.

**Last Updated**: April 2025  
**Database**: MongoDB Atlas (replica set)  
**Validation**: JSON Schema + application-level checks  
**Backup**: Daily snapshots (Atlas Backup)

---

## Collections Overview

| Collection | Purpose | Documents | Growth | Key Index |
|---|---|---|---|---|
| `users` | Auth profiles + preferences | ~5K | Medium | firebaseUid, email |
| `roommates` | Room listings | ~10K | Medium | city, location, rentAmount |
| `households` | Group memberships | ~2K | Low | joinCode, members |
| `messages` | 1:1 DMs | ~100K | High | (fromEmail, toEmail, timestamp) |
| `ledger` | Grocery expenses | ~50K | High | (householdId, date) |
| `meals` | Daily meal log | ~100K | High | (householdId, userEmail, date) |
| `payments` | Due settlements | ~20K | Medium | (householdId, month) |
| `room_chat` | Group chat (TTL 90d) | ~30K avg | High (auto-purge) | (householdId, timestamp) |
| `reviews` | Mess reviews | ~5K | Low | householdId, rating |
| `notifications` | In-app feed (TTL 30d) | ~20K avg | Medium (auto-purge) | (userId, read, createdAt) |

---

## Collection Definitions

### `users`
User accounts linked to Firebase authentication.

**Fields:**
```javascript
{
  _id:                ObjectId,      // PK
  firebaseUid:        String,        // Unique, from Firebase
  email:              String,        // Unique, required
  displayName:        String,        // Required
  photoURL:           String,        // Optional, Firebase URL
  phone:              String,        // Optional
  bio:                String,        // Profile bio
  preferredCity:      String,        // For search suggestions
  lifestylePrefs: {                  // From compatibility quiz
    pets:             Boolean,
    smoking:          Boolean,
    nightOwl:         Boolean,
    earlyRiser:       Boolean,
    student:          Boolean,
    professional:     Boolean
  },
  quizProfile: {                     // Aggregated quiz result
    compatibility:    Number,        // 0-100 score
    lastQuizDate:     Date
  },
  savedListings:      [ObjectId],    // FK → roommates._id (like system)
  householdId:        ObjectId,      // FK → households._id (current household)
  isVerified:         Boolean,       // Email verified flag
  lastSeen:           Date,          // Timestamp of last activity
  createdAt:          Date,          // Account creation
  updatedAt:          Date           // Last profile update
}
```

**Indexes:**
- `{ email: 1 }` UNIQUE
- `{ firebaseUid: 1 }` UNIQUE
- `{ householdId: 1 }` (find users in household)
- `{ preferredCity: 1, isVerified: 1 }` (list verified users by city)
- `{ lastSeen: -1 }` (activity feeds)

**Constraints:**
- Email format validated by Firebase
- displayName min 2 chars
- firebaseUid always present (required by Auth)

---

### `roommates`
Room listing postings.

**Fields:**
```javascript
{
  _id:                    ObjectId,    // PK
  userEmail:              String,      // Poster email (denormalized for queries)
  userId:                 ObjectId,    // FK → users._id
  title:                  String,      // Room title (e.g. "2BR in Mirpur")
  description:            String,      // Full description (500+ chars)
  location:               String,      // Street address
  city:                   String,      // City name (indexed for search)
  coordinates: {                       // GeoJSON for 2dsphere search
    type:                 "Point",
    coordinates:          [lng, lat]   // [90.4125, 23.8103] for Dhaka
  },
  rentAmount:             Number,      // Monthly rent in ৳
  roomType:               String,      // "1BR", "2BR", "3BR", "Studio", "Bed+Bath"
  availability:           String,      // "Available", "Coming Soon", "Full"
  imageUrls:              [String],    // Cloudinary URLs
  lifestylePreferences: {              // Match user prefs
    pets:                 Boolean,
    smoking:              Boolean,
    nightOwl:             Boolean,
    earlyRiser:           Boolean
  },
  amenities:              [String],    // ["WiFi", "AC", "Kitchen", "Parking"]
  contactInfo:            String,      // Phone or email to contact
  likes:                  [String],    // User emails who liked this
  viewCount:              Number,      // Analytics
  isFeatured:             Boolean,     // Premium listing flag
  status:                 String,      // "active", "expired", "draft", "sold"
  expiresAt:              Date,        // Listing expires (active for 60 days)
  createdAt:              Date,        // Posted date
  updatedAt:              Date         // Last edit
}
```

**Indexes:**
- `{ userId: 1 }` (user's listings)
- `{ city: 1, availability: 1, roomType: 1 }` (browse filter)
- `{ location: 1, rentAmount: 1 }` (filter by area + price)
- `{ coordinates: "2dsphere" }` (geospatial: find nearby)
- `{ likes: 1 }` (for analytics)
- `{ status: 1, expiresAt: 1 }` (batch expiry checks)
- `{ createdAt: -1 }` (latest listings first)
- `{ title: "text", description: "text", location: "text" }` TEXT INDEX (full-text search)

**Constraints:**
- rentAmount > 0
- status enum: ["active", "expired", "draft", "sold"]
- At least one imageUrl required
- coordinates must be valid GeoJSON

---

### `households`
Shared living groups (messes, flats, apartments).

**Fields:**
```javascript
{
  _id:              ObjectId,        // PK
  listingId:        ObjectId,        // FK → roommates._id (1:1, optional)
  listingTitle:     String,          // Copy of listing title (denormalized)
  ownerEmail:       String,          // Household creator
  joinCode:         String,          // Unique 6-char code (A-Z, 0-9)
  members:          [String],        // User emails in household
  memberIds:        [ObjectId],      // FK → users._id (for joins)
  monthlyFee:       Number,          // Total rent, split equally
  name:             String,          // Household name (e.g. "Green Villa")
  address:          String,          // Full address
  rules:            String,          // House rules (free text)
  settings: {                        // Household-level config
    allowGuests:    Boolean,
    sharedBudget:   Number,          // Shared account limit
    mealTime:       String           // "breakfast", "lunch", "dinner"
  },
  isActive:         Boolean,         // Soft-delete flag
  createdAt:        Date,            // When household formed
  updatedAt:        Date
}
```

**Indexes:**
- `{ joinCode: 1 }` UNIQUE (for quick code lookup)
- `{ members: 1 }` (find households by member email)
- `{ ownerEmail: 1 }` (user's created households)
- `{ listingId: 1 }` (find household for a listing)
- `{ isActive: 1 }` (list active households only)

**Constraints:**
- joinCode unique, 6 chars alphanumeric
- monthlyFee > 0
- members array non-empty
- ownerEmail must be in members

---

### `messages`
1:1 direct messages between users.

**Fields:**
```javascript
{
  _id:              ObjectId,        // PK
  fromEmail:        String,          // Sender email
  toEmail:          String,          // Recipient email
  fromId:           ObjectId,        // FK → users._id
  toId:             ObjectId,        // FK → users._id
  listingId:        String,          // Listing being discussed (optional)
  listingTitle:     String,          // Listing title (denormalized)
  text:             String,          // Message body (required)
  mediaUrl:         String,          // Optional image/file link
  read:             Boolean,         // Read status
  readAt:           Date,            // When marked read
  deleted:          Boolean,         // Soft-delete flag
  timestamp:        Date             // Message sent time (required)
}
```

**Indexes:**
- `{ fromEmail: 1, toEmail: 1, timestamp: 1 }` (conversation thread)
- `{ toEmail: 1, read: 1 }` (unread count)
- `{ listingId: 1, timestamp: 1 }` (messages about a listing)
- `{ timestamp: -1 }` (for pagination, newest first)
- `{ fromId: 1, toId: 1, listingId: 1 }` (full thread lookup)

**Constraints:**
- fromEmail ≠ toEmail (no self-messages)
- text required, non-empty
- read: false by default

---

### `ledger`
Household grocery and market expenses.

**Fields:**
```javascript
{
  _id:         ObjectId,   // PK
  householdId: ObjectId,   // FK → households._id (required)
  item:        String,     // Item description (e.g. "Rice 10kg")
  amount:      Number,     // Cost in ৳ (required)
  currency:    String,     // "BDT" (default)
  date:        String,     // YYYY-MM-DD (required)
  paidBy:      String,     // Email of person who paid
  paidById:    ObjectId,   // FK → users._id
  category:    String,     // "groceries", "household", "utilities"
  receipt:     String,     // Image URL of receipt
  splitWith:   [String],   // Emails of people who owe (optional)
  createdAt:   Date        // When entry added
}
```

**Indexes:**
- `{ householdId: 1, date: -1 }` (ledger by household + date)
- `{ householdId: 1, paidBy: 1 }` (user's expenses)
- `{ householdId: 1, category: 1 }` (expense breakdown)

**Constraints:**
- amount > 0
- date format YYYY-MM-DD
- householdId required

**Fair-Share Calculation:**
```javascript
// Total per person = sum(amount) / members.length
// Each person owes: (amount / members.length)
```

---

### `meals`
Daily meal logging per household member.

**Fields:**
```javascript
{
  _id:         ObjectId,   // PK
  householdId: ObjectId,   // FK → households._id (required)
  userEmail:   String,     // User logging meals (required)
  userId:      ObjectId,   // FK → users._id
  date:        String,     // YYYY-MM-DD (required)
  meals:       Number,     // 0-3 meals eaten (0=skip, 3=full day)
  guests:      Number,     // 0-3 extra meal units (visitors)
  note:        String,     // Optional note ("Away", "Late dinner")
  updatedAt:   Date,       // When log updated
  createdAt:   Date        // When first logged
}
```

**Indexes:**
- `{ householdId: 1, date: 1 }` (household meals by day)
- `{ householdId: 1, userEmail: 1, date: 1 }` UNIQUE (prevent duplicates; enables upsert)
- `{ householdId: 1, userEmail: 1 }` (user's meal history in household)

**Constraints:**
- meals ∈ [0, 1, 2, 3]
- guests ∈ [0, 1, 2, 3]
- date format YYYY-MM-DD
- Unique constraint prevents double-logging same day

**Aggregation:**
```javascript
// Count meals last 30 days per user
db.meals.aggregate([
  { $match: { householdId: ObjectId("..."), 
    date: { $gte: "2025-03-29" } }},
  { $group: { _id: "$userEmail", 
    totalMeals: { $sum: "$meals" },
    totalGuests: { $sum: "$guests" } }}
]);
```

---

### `payments`
Payment records for room fees and market dues.

**Fields:**
```javascript
{
  _id:         ObjectId,   // PK
  householdId: ObjectId,   // FK → households._id (required)
  fromEmail:   String,     // Who paid (required)
  fromId:      ObjectId,   // FK → users._id
  toEmail:     String,     // Who received ("household" for fees)
  amount:      Number,     // Amount in ৳ (required)
  currency:    String,     // "BDT"
  type:        String,     // "room_fee", "market_share", "custom"
  month:       String,     // YYYY-MM (for aggregation)
  note:        String,     // "April rent", "Market due", etc.
  status:      String,     // "paid", "pending", "disputed"
  reference:   String,     // Payment gateway reference (Razorpay)
  date:        Date        // Payment date (required)
}
```

**Indexes:**
- `{ householdId: 1, month: 1 }` (monthly settlement)
- `{ householdId: 1, fromEmail: 1, month: 1 }` (user's payments)
- `{ householdId: 1, status: 1 }` (pending payments)
- `{ date: -1 }` (recent payments)

**Constraints:**
- amount > 0
- status enum: ["paid", "pending", "disputed"]
- month format YYYY-MM

---

### `room_chat`
Group chat messages (auto-purged after 90 days).

**Fields:**
```javascript
{
  _id:         ObjectId,   // PK
  householdId: ObjectId,   // FK → households._id (required)
  senderEmail: String,     // Who sent (required)
  senderId:    ObjectId,   // FK → users._id
  senderName:  String,     // Name at send time (denormalized)
  text:        String,     // Message body (required)
  mediaUrl:    String,     // Image/file link (optional)
  type:        String,     // "text", "image", "announcement"
  replyTo:     ObjectId,   // FK → room_chat._id (thread reply)
  reactions: {             // Emoji reactions
    "😂":       [String],   // Array of emails who reacted
    "❤️":       [String]
  },
  edited:      Boolean,    // True if edited
  deletedAt:   Date,       // Soft-delete timestamp
  timestamp:   Date        // Message sent (required)
}
```

**Indexes:**
- `{ householdId: 1, timestamp: 1 }` (chat history)
- `{ householdId: 1, senderEmail: 1 }` (user's messages)
- `{ timestamp: 1 }` TTL 7776000 seconds (90 days; auto-delete)

**Constraints:**
- text required, non-empty
- timestamp auto-set to now() if not provided

**TTL Behavior:**
- Documents deleted 90 days after `timestamp`
- Background task runs every 60 seconds
- No need for manual cleanup

---

### `reviews`
Public mess-mate reviews visible on home page.

**Fields:**
```javascript
{
  _id:         ObjectId,   // PK
  authorEmail: String,     // Reviewer email (required)
  authorId:    ObjectId,   // FK → users._id
  authorName:  String,     // Reviewer name (denormalized)
  houseName:   String,     // Mess name reviewed (required)
  householdId: ObjectId,   // FK → households._id (optional)
  text:        String,     // Review content (required)
  rating:      Number,     // 1-5 stars (required)
  helpful:     Number,     // "Helpful" vote count
  verified:    Boolean,    // Verified member of mess
  date:        Date        // Review posted (required)
}
```

**Indexes:**
- `{ householdId: 1, rating: -1 }` (top reviews for household)
- `{ authorEmail: 1 }` (user's reviews)
- `{ rating: -1, date: -1 }` (top-rated reviews)
- `{ houseName: "text", text: "text" }` TEXT INDEX (search reviews)
- `{ verified: 1, date: -1 }` (verified reviews first)

**Constraints:**
- rating ∈ [1, 2, 3, 4, 5]
- text min 50 chars
- houseName required

---

### `notifications`
In-app notification feed (auto-purged 30 days after read).

**Fields:**
```javascript
{
  _id:        ObjectId,   // PK
  userId:     ObjectId,   // FK → users._id (required)
  userEmail:  String,     // User email (denormalized)
  type:       String,     // "message", "payment_due", "review", "join_code"
  title:      String,     // Notification headline (required)
  body:       String,     // Description
  link:       String,     // Deep link (e.g. "/messages/123")
  metadata: {             // Type-specific data
    fromEmail: String,    // For "message"
    amount:    Number,    // For "payment_due"
    householdId: ObjectId // For "join_code"
  },
  read:       Boolean,    // Read flag
  readAt:     Date,       // When marked read
  createdAt:  Date        // Notification sent
}
```

**Indexes:**
- `{ userId: 1, read: 1, createdAt: -1 }` (user's unread notifications)
- `{ userEmail: 1, read: 1 }` (find by email)
- `{ type: 1, createdAt: -1 }` (by type)
- `{ readAt: 1 }` TTL 2592000 seconds (30 days; only for read=true)

**Constraints:**
- type enum: ["message", "payment_due", "review", "join_code", "listing_expired"]
- title required, non-empty

**TTL Behavior:**
- Only delete notifications where `read: true`
- Unread notifications persist indefinitely
- Set TTL via `partialFilterExpression: { read: true }`

---

## Relationships

### Entity-Relationship Diagram

```
users (1) ──→ (N) roommates
           ──→ (N) messages (fromId, toId)
           ──→ (N) households (via memberIds[])
           ──→ (N) ledger (paidById)
           ──→ (N) meals
           ──→ (N) payments (fromId)
           ──→ (N) room_chat (senderId)
           ──→ (N) reviews (authorId)
           ──→ (N) notifications (userId)

roommates (1) ──→ (N) households (listingId)
           ──→ (N) messages (listingId)

households (1) ──→ (N) ledger
            ──→ (N) meals
            ──→ (N) payments
            ──→ (N) room_chat
            ──→ (N) reviews

room_chat (1) ──→ (1) room_chat (replyTo — self-join)
```

---

## Data Aggregation Examples

### Fair-Share Calculation
```javascript
// What does Alice owe for this month?
const householdId = ObjectId("...");
const month = "2025-04";

// 1. Get room fee per person
const household = await households.findOne({ _id: householdId });
const perPersonFee = household.monthlyFee / household.members.length;

// 2. Get total market spend
const ledgerTotal = await ledger.aggregate([
  { $match: { householdId, date: { $regex: `^${month}` } } },
  { $group: { _id: null, total: { $sum: "$amount" } } }
]);
const marketTotal = ledgerTotal[0]?.total || 0;

// 3. Get Alice's meal units
const aliceMeals = await meals.aggregate([
  { $match: { householdId, userEmail: "alice@ex.com", date: { $regex: `^${month}` } } },
  { $group: { _id: null, units: { $sum: { $add: ["$meals", "$guests"] } } } }
]);
const aliceUnits = aliceMeals[0]?.units || 0;

// 4. Get total household units
const totalUnits = await meals.aggregate([
  { $match: { householdId, date: { $regex: `^${month}` } } },
  { $group: { _id: null, total: { $sum: { $add: ["$meals", "$guests"] } } } }
]);
const householdUnits = totalUnits[0]?.total || 1;

// 5. Calculate
const aliceMarketShare = (aliceUnits / householdUnits) * marketTotal;
const aliceTotalOwed = perPersonFee + aliceMarketShare;
```

### Payment Status
```javascript
// Who still owes for April?
db.payments.aggregate([
  { $match: { householdId: ObjectId("..."), month: "2025-04", status: "pending" } },
  { $group: { _id: "$fromEmail", totalOwed: { $sum: "$amount" } } },
  { $sort: { totalOwed: -1 } }
]);
```

### Listing Search
```javascript
// Find 3BR listings near Dhaka, price < 20K, newest first
db.roommates.find({
  city: "Dhaka",
  roomType: "3BR",
  rentAmount: { $lt: 20000 },
  status: "active",
  availability: "Available"
}).sort({ createdAt: -1 }).limit(20);

// Geospatial: Within 5km of coordinates
db.roommates.find({
  coordinates: {
    $near: {
      $geometry: { type: "Point", coordinates: [90.4125, 23.8103] },
      $maxDistance: 5000
    }
  }
}).limit(20);

// Full-text search
db.roommates.find({
  $text: { $search: "mirpur 2br furnished wifi" }
}, {
  score: { $meta: "textScore" }
}).sort({ score: { $meta: "textScore" } });
```

---

## Backup & Recovery

### Automated Backups (Atlas)
- Daily snapshots (7-day retention)
- Hourly continuous backups (35-day retention)
- Point-in-time restore (last 35 days)
- Restore to new cluster or same cluster

### Manual Backup (CLI)
```bash
mongodump --uri "mongodb+srv://user:pass@cluster.mongodb.net/roommatedb" \
  --out ./backup_$(date +%Y%m%d)

mongorestore --uri "mongodb+srv://user:pass@..." \
  ./backup_20250428
```

---

## Maintenance Tasks

### Weekly
- Check query performance (Atlas charts)
- Monitor index usage
- Review slow query logs

### Monthly
- Verify backup integrity
- Clean deleted/soft-deleted records
- Update statistics (run `db.stats()`)

### Quarterly
- Analyze index effectiveness
- Archive old notifications/room_chat (optional)
- Capacity planning (storage, throughput)

---

## Migration Scripts

See `nestmate-server` repo for:
- `db.createCollection()` with validation schemas
- `db.*.createIndex()` for all indexes
- `db.*.deleteMany({ deletedAt: { $exists: true } })` for cleanup

---

**Version**: 1.0  
**Last Updated**: April 2025  
**Maintainer**: NestMate Dev Team
