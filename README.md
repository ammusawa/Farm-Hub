# 🌱 AgriConsult Hub - MVP

A farming content platform with multi-language support, professional verification, and PWA capabilities.

> 📖 **New to the project?** Check out [SETUP.md](SETUP.md) for a quick start guide.

## Features

- ✅ Multi-language interface (English, Hausa, Igbo, Yoruba) with automatic NLLB-200 translations
- ✅ Synchronized language selection across global switcher, video player, and transcript display
- ✅ Video transcript and subtitle translation with automatic cache validation
- ✅ Professional-only upload route with verification
- ✅ Search and filters optimized for poor networks
- ✅ Ratings, comments, and threaded follow-up questions
- ✅ PWA with offline support
- ✅ Role-based access control (Users, Professionals, Admins)
- ✅ Optimized translation performance (GPU support, quantization, model compilation)

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Database**: MySQL 8.0+ with connection pooling
- **Authentication**: JWT with HTTP-only cookies
- **Styling**: Tailwind CSS
- **PWA**: next-pwa
- **Translation**: Facebook NLLB-200-distilled-600M model (local Python service)
- **Video Processing**: FFmpeg for video/audio processing

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

1. **Create a MySQL database** (if it doesn't exist):
   ```sql
   CREATE DATABASE agriconsult_hub;
   ```

2. **Set up database schema** using npm script:
   ```bash
   npm run db
   ```
   
   This will automatically:
   - Create all necessary tables
   - Add missing columns if schema has evolved
   - Set up indexes and constraints
   - Handle schema migrations safely

   Alternatively, you can manually import the schema:
   ```bash
   mysql -u root -p agriconsult_hub < lib/db-schema.sql
   ```

3. **Seed the database** (optional, for initial data):
```bash
   npm run seed
```

   This populates the database with sample content, users, and translations.

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=agriconsult_hub

JWT_SECRET=your_jwt_secret_key_change_this_in_production

# Translation Service (optional, defaults to http://localhost:5000)
TRANSLATOR_SERVICE_URL=http://localhost:5000
```

### 3a. Translation Service Setup

The system uses a local Python translation service with Facebook NLLB-200 model for fast, seamless multi-language support:

1. **Install Python Dependencies**:
   ```bash
   pip install -r requirements-translator.txt
   ```

2. **For GPU Support (Recommended - 2-4x faster)**:
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```
   Note: Only install if you have a CUDA-compatible GPU

3. **For CPU Quantization (Optional - 2-4x faster CPU inference)**:
   ```bash
   pip install bitsandbytes
   ```
   Note: This is optional but significantly speeds up CPU translation

4. **Start Translation Service**:
   ```bash
   python translator_service.py
   ```
   
   Or use the provided scripts:
   - Windows: `start-translator.bat`
   - Linux/Mac: `./start-translator.sh`

5. **Verify Service is Running**:
   - Visit `http://localhost:5000/health` in your browser
   - Should return: `{"status":"ok","service":"translation","model":"nllb-200"}`

**Performance Optimizations**:
- ✅ **8-bit quantization** for 2-4x faster inference (CPU and GPU)
- ✅ **GPU support** with automatic fallback to CPU
- ✅ **Model compilation** (PyTorch 2.0+) for additional 20-30% speedup
- ✅ **Greedy decoding** for maximum speed (2-3x faster than beam search)
- ✅ **Model pre-loading** on startup for instant first translation
- ✅ **Thread-safe** model access for concurrent requests

**Note**: The model pre-loads on startup, so the first translation is fast. With GPU: translations are 2-4x faster. With CPU quantization: translations are 2-4x faster than standard CPU. The service uses greedy decoding by default for maximum speed while maintaining good translation quality.

### 4. Create Admin User

After setting up the database, you can create an admin user in two ways:

**Option 1: Using the registration endpoint (Recommended)**
1. Register a new user through the web interface at `/login`
2. Update the user role to admin in the database:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

**Option 2: Direct SQL insert**
```sql
-- First, generate a password hash using: npm run hash-password
-- Then insert:
INSERT INTO users (name, email, password, role) 
VALUES ('Admin', 'admin@example.com', '$2a$10$hashed_password_here', 'admin');
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── content/      # Content CRUD
│   │   ├── search/       # Search functionality
│   │   ├── ratings/      # Rating system
│   │   ├── comments/     # Comments system
│   │   ├── professional/ # Professional applications
│   │   └── admin/        # Admin endpoints
│   ├── components/       # React components
│   ├── admin/            # Admin pages
│   ├── content/          # Content view pages
│   ├── login/            # Authentication pages
│   ├── upload/           # Professional upload page
│   └── apply-professional/ # Professional application page
├── lib/
│   ├── db.ts             # Database connection
│   ├── db-schema.sql     # Database schema
│   ├── auth.ts           # Authentication utilities
│   └── translations.ts   # Translation system
├── middleware.ts         # Route protection
└── public/
    └── manifest.json     # PWA manifest
```

## Key Features Implementation

### Multi-Language Support
- Language switcher in navbar
- UI labels stored in database `translations` table
- Content language field for filtering
- Video transcript and subtitle translation using Facebook NLLB-200 model
- Synchronized language selection across all components
- Automatic cache validation to ensure translation quality
- Optimized performance with GPU support and quantization

### Professional Verification
- `/apply-professional` route for submitting credentials
- Admin approval system at `/admin/applications`
- Middleware protects `/upload` route

### Search & Filters
- Lightweight search API with FULLTEXT indexing
- Filters by crop, language, and content type
- Fallback to LIKE search if FULLTEXT unavailable

### Ratings & Comments
- 5-star rating system
- Threaded comments (2 levels deep)
- Follow-up questions support

### PWA Features
- Service worker for offline caching
- Manifest.json for installability
- Offline banner indicator
- Cached pages for offline access

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Content
- `GET /api/content` - List content (with filters)
- `POST /api/content` - Create content (professional only)
- `GET /api/content/[id]` - Get single content
- `PUT /api/content/[id]` - Update content (author only)

### Search
- `GET /api/search?q=query` - Search content

### Ratings
- `POST /api/ratings` - Submit rating
- `GET /api/ratings?contentId=X` - Get ratings

### Comments
- `GET /api/comments?contentId=X` - Get comments
- `POST /api/comments` - Create comment/reply

### Professional
- `POST /api/professional/apply` - Submit professional application

### Admin
- `GET /api/admin/applications` - List applications
- `POST /api/admin/applications` - Approve/reject application

## Available NPM Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db` - Set up database schema (creates tables, adds missing columns)
- `npm run seed` - Seed database with initial data
- `npm run lint` - Run ESLint
- `npm run hash-password` - Generate bcrypt password hash
- `npm run find-ffmpeg` - Locate FFmpeg installation

## Development Notes

- **PWA**: Service worker is disabled in development mode for hot-reload
- **Database**: Use `npm run db` to set up schema, `npm run seed` for initial data
- **Search**: Uses FULLTEXT indexing with fallback to LIKE search
- **Offline**: Caching works for homepage and recently visited content
- **Translation**: 
  - Service must be running (`python translator_service.py`) for multi-language features
  - Cache is automatically validated - invalid translations are detected and retranslated
  - Language changes from any selector (global, video player, transcript) update both transcript and subtitles
  - Optimized with quantization, GPU support, and greedy decoding for maximum speed
- **File Upload**: Credentials upload uses URL input - implement proper file upload in production

## Production Checklist

- [ ] Set secure JWT_SECRET
- [ ] Configure proper file upload for credentials
- [ ] Set up SSL/HTTPS
- [ ] Configure database connection pooling
- [ ] Add rate limiting
- [ ] Implement proper error logging
- [ ] Add input validation and sanitization
- [ ] Set up monitoring and analytics
- [ ] Configure CDN for static assets
- [ ] Test PWA on various devices
- [ ] Set up translation service as a system service/daemon
- [ ] Configure GPU support for translation service (if available)
- [ ] Set up automated database backups
- [ ] Configure cloud storage for video files (AWS S3, Google Cloud Storage)

## License

MIT

