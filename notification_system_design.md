# Campus Notifications Microservice

# Stage 1: REST API Endpoints
- `GET /notifications`: List all (supports `page` & `category` filters).
- `PATCH /notifications/:id/read`: Mark one as read.
- `GET /notifications/summary`: Get unread counts by category.

### Real-time Strategy
- Use **WebSockets** to push `new_notification` events to clients instantly upon creation.

### Logging
- Use `Log()` middleware for all requests.
- `info` for successes; `error` for failures.
- Packages: `controller`, `service`, `handler`.

# Stage 2: Database Design

### DB Choice: PostgreSQL
**Why**: Reliable, ACID compliant, and great for relational data. Efficient filtering and indexing.

### Schema
- **users**: `id` (PK), `email` (Unique), `name`.
- **notifications**: `id` (PK), `user_id` (FK), `category` (Enum), `title`, `message`, `is_read` (Boolean, Default: False), `created_at` (Timestamp).

### Scalability
- **Problems**: Slow reads at scale; write spikes during mass alerts.
- **Solutions**:
  - **Indexes**: On `user_id`, `is_read`, and `created_at`.
  - **Partitioning**: Monthly tables for archiving.
  - **Caching**: Redis for unread counts.

### Core Queries
1. **Fetch**: `SELECT * FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 20;`
2. **Read**: `UPDATE notifications SET is_read = TRUE WHERE id = :id;`
3. **Summary**: `SELECT category, COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = FALSE GROUP BY category;`

# Stage 3: Optimization

### Query Analysis
- **Accuracy**: The query is accurate but inefficient for 5M+ rows.
- **Slowness**: Without proper indexing, the DB performs a **full table scan** (O(N)), checking every row for matches.
- **Optimization**: Add a **composite index** on `(studentID, isRead, createdAt DESC)`. This reduces lookup time to O(log N).

### Indexing Strategy
- **Advice Evaluation**: Indexing every column is **ineffective**. It slows down `INSERT` and `UPDATE` operations (index maintenance overhead) and consumes unnecessary disk space.
- **Best Practice**: Only index columns used in `WHERE`, `JOIN`, or `ORDER BY` clauses.

### Placement Query (Last 7 Days)
```sql
SELECT DISTINCT studentID 
FROM notifications 
WHERE notificationType = 'Placement' 
AND createdAt >= NOW() - INTERVAL '7 days';
```

# Stage 4: Performance & Scaling

### Solution 1: Server-Side Caching (Redis)
- **Improvement**: Store recent notifications in-memory (Redis). API hits Redis first, bypassing the DB for repeated page loads.
- **Tradeoffs**: 
  - **Pros**: Sub-millisecond response times; massive reduction in DB load.
  - **Cons**: Increased architectural complexity; requires a cache invalidation strategy (e.g., TTL or manual purge on new notification).

### Solution 2: Shift from Pull to Push (WebSockets)
- **Improvement**: Instead of the client "pulling" data on every load, the server "pushes" new notifications over a WebSocket. The client maintains state in-memory.
- **Tradeoffs**:
  - **Pros**: Near-zero redundant DB queries; instant user feedback.
  - **Cons**: High server memory usage to maintain persistent connections; complex to scale WebSocket servers (requires Load Balancer sticky sessions or Pub/Sub).

### Solution 3: Client-Side Caching & Conditional GET
- **Improvement**: Store notifications in browser `localStorage`. Use `If-Modified-Since` or ETags so the server only sends data if new notifications exist.
- **Tradeoffs**:
  - **Pros**: Reduces bandwidth; minimizes data processing on the server.
  - **Cons**: Harder to sync across multiple devices (e.g., laptop vs phone).

# Stage 5: Reliability & Distributed Systems

### Shortcomings of Current Implementation
1. **Synchronous Execution**: Processing 50k students sequentially is extremely slow (O(N)). If one email takes 1s, the process takes ~14 hours.
2. **Lack of Resilience**: A single crash or network error midway leaves the system in an inconsistent state with no way to track where it stopped.
3. **Tight Coupling**: A slow `send_email` API blocks the `save_to_db` and `push_to_app` actions.

### Proposed Redesign
- **Decoupling**: The process of saving to the DB and sending emails **should not happen together**. DB insertion is fast and critical (source of truth); Email/Push are slow and unreliable.
- **Message Queues (RabbitMQ/BullMQ)**: Use a producer-consumer model. The API should just push 50k "jobs" into a queue and return immediately.
- **Retries & Idempotency**: Workers should handle retries with exponential backoff for failed `send_email` calls without affecting other students.

### Revised Pseudocode
```javascript

function notify_all(student_ids, message) {

    save_bulk_to_db(student_ids, message);
    
    for (const id of student_ids) {
        notificationQueue.add({ id, message });
    }
    return { status: "Processing started" };
}


worker.process(async (job) => {
    await Promise.allSettled([
        send_email_with_retry(job.id, job.message),
        push_to_app(job.id, job.message)
    ]);
});
```

# Stage 6: Priority Inbox

### Approach
To display the top `n` most important notifications, I implemented a scoring system that combines **Category Weight** and **Recency**:
- **Weights**: `Placement` (3), `Result` (2), `Event` (1).
- **Formula**: `Score = (Weight * 10^13) + Timestamp(ms)`
  - This ensures that a "Placement" notification always outranks a "Result", regardless of when it was sent, while within the same category, newer notifications rank higher.

### Efficient Maintenance
To maintain the top 10 efficiently as new notifications stream in:
1. Use a **Min-Heap** data structure of size 10.
2. For every new notification, calculate its score.
3. If `new_score > heap.min_score`, remove the minimum and insert the new notification (O(log 10) complexity).
4. This keeps the inbox updated in constant time relative to the total number of notifications.

### Implementation
The logic is implemented in `priority_inbox/index.js`, which fetches live data from the Notification API and applies the scoring algorithm to find the top 10.
