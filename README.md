# News Recommendation Backend

Backend API for **Context-Aware Personalized News Recommendation System Using Deep Learning**.

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs (password hashing)

## Project Structure

```
news-backend/
├── config/           # Database connection
├── controllers/      # Business logic (MVC)
├── middleware/       # Auth & error handling
├── models/           # Mongoose schemas
├── routes/           # API endpoints
├── utils/            # JWT, async handler, Python bridge
├── server.js         # Entry point
└── .env              # Environment variables (create from .env.example)
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and update values:

   ```bash
   copy .env.example .env
   ```

3. **Start MongoDB** (local or Atlas URI in `MONGO_URI`)

4. **Run the server**

   ```bash
   npm run dev
   ```

   Server runs at `http://localhost:5000`

## API Endpoints

### Auth (Public)

| Method | Endpoint           | Description        |
|--------|--------------------|--------------------|
| POST   | `/api/auth/signup` | Register new user  |
| POST   | `/api/auth/login`  | Login, get JWT     |

### User (Protected – Bearer token required)

| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| GET    | `/api/user/profile`   | Get user profile         |
| POST   | `/api/user/bookmark`  | Bookmark an article      |
| GET    | `/api/user/bookmarks` | List bookmarks           |
| POST   | `/api/user/history`   | Add reading history      |
| GET    | `/api/user/history`   | Get reading history      |

### Recommendations (Placeholder for DeepCARSKit)

| Method | Endpoint                         | Description                    |
|--------|----------------------------------|--------------------------------|
| GET    | `/api/recommendations`           | Personalized recommendations   |
| GET    | `/api/recommendations/context`   | User context for ML engine     |
| GET    | `/api/recommendations/health`    | Python service health check    |

## Authentication

Send JWT in the header for protected routes:

```
Authorization: Bearer <your_token>
```

## Example Requests

### Signup

```json
POST /api/auth/signup
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "preferredCategories": ["technology", "science"]
}
```

### Login

```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Add Bookmark (Protected)

```json
POST /api/user/bookmark
{
  "articleId": "article-001",
  "title": "AI in Healthcare",
  "category": "technology"
}
```

### Add Reading History (Protected)

```json
POST /api/user/history
{
  "articleId": "article-002",
  "title": "Climate Update",
  "category": "environment",
  "dwellTimeSeconds": 45
}
```

## DeepCARSKit Integration (Future)

The `utils/pythonBridge.js` module is prepared to send user context (bookmarks, history, categories) to your Python recommendation service. Update `PYTHON_RECOMMENDER_URL` in `.env` when the DeepCARSKit API is ready.

## React Frontend

CORS is configured for `http://localhost:3000`. Set `CLIENT_URL` in `.env` for production.
