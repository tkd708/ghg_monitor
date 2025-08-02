# API Documentation

Complete API reference for the GHG Monitor backend services.

## 🔐 Authentication

All API endpoints require authentication via JWT tokens, except for the login endpoint.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "password": "ghgmonitor"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "User Name"
  }
}
```

## 🏢 Site Management

### List All Sites
```http
GET /api/sites
```

**Response:**
```json
[
  {
    "id": "site_001",
    "name": "Test Site 1",
    "description": "Agricultural research site",
    "location": "Research Farm A",
    "chambers": 16,
    "chamberSpecs": {
      "length_cm": 20,
      "width_cm": 40,
      "height_cm": 15,
      "measurements_per_day": 6
    },
    "qualityThresholds": {
      "co2_r2_min": 0.6,
      "n2o_r2_min": 0.6,
      "n2o_flux_min": -5
    }
  }
]
```

### Get Site Details
```http
GET /api/sites/:siteId
```

**Response:**
```json
{
  "id": "site_001",
  "name": "Test Site 1",
  "description": "Agricultural research site",
  "location": "Research Farm A",
  "dataPath": "data/site_001",
  "chambers": 16,
  "chamberConfigs": [
    {
      "chamber": 1,
      "treatment": "N0",
      "replicate": 1
    }
  ],
  "chamberSpecs": {
    "length_cm": 20,
    "width_cm": 40,
    "height_cm": 15,
    "measurements_per_day": 6
  },
  "qualityThresholds": {
    "co2_r2_min": 0.6,
    "n2o_r2_min": 0.6,
    "n2o_flux_min": -5
  }
}
```

### Update Chamber Configuration
```http
PUT /api/sites/:siteId/chamber-config
```

**Request Body:**
```json
{
  "chambers": 16,
  "configs": [
    {
      "chamber": 1,
      "treatment": "N0",
      "replicate": 1
    },
    {
      "chamber": 2,
      "treatment": "N200",
      "replicate": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chamber configuration updated successfully"
}
```

### Update Chamber Specifications
```http
PUT /api/sites/:siteId/chamber-specs
```

**Request Body:**
```json
{
  "length_cm": 20,
  "width_cm": 40,
  "height_cm": 15,
  "measurements_per_day": 6
}
```

## 📊 Data Endpoints

### Get Raw Data
```http
GET /api/sites/:siteId/data
```

**Query Parameters:**
- `startDate` (optional): Filter by start date (YYYY-MM-DD)
- `endDate` (optional): Filter by end date (YYYY-MM-DD)
- `chamber` (optional): Filter by specific chamber ID

**Response:**
```json
{
  "data": [
    {
      "datetime": "2024-12-25T14:30:25.000Z",
      "chamber": 1,
      "chamber_label": "C01",
      "co2_ppm": 412.5,
      "n2o_ppb": 325.8,
      "n2o_ppm": 0.3258,
      "h2o_ppm": 18500,
      "status": "0",
      "pair_kpa": 101.3,
      "temp_c": 25.0,
      "run_id": "run_001",
      "site_id": "site_001",
      "filename": "data_20241225.csv"
    }
  ],
  "totalRecords": 1500,
  "site": "Test Site 1",
  "mostRecentFile": {
    "filename": "data_20241225.csv",
    "datetime": "2024-12-25T16:45:30.000Z",
    "recordCount": 240,
    "avgTemperature": 25.2,
    "avgPressure": 101.2,
    "statusCounts": {
      "0": 235,
      "1": 5
    }
  }
}
```

### Get Available Data Files
```http
GET /api/sites/:siteId/data-files
```

**Response:**
```json
[
  {
    "filename": "data_20241225.csv",
    "date": "25/12/2024",
    "time": "14:30",
    "runId": "run_001",
    "chambers": [1, 2, 3, 4, 5, 6, 7, 8],
    "recordCount": 240
  }
]
```

### Get Individual File Data
```http
GET /api/sites/:siteId/raw-data
```

**Query Parameters:**
- `file` (required): Filename to read

**Response:**
```json
[
  {
    "datetime": "2024-12-25T14:30:25.000Z",
    "chamber": 1,
    "co2_ppm": 412.5,
    "n2o_ppb": 325.8,
    "h2o_ppm": 18500,
    "status": "0"
  }
]
```

## 🔬 Analysis Endpoints

### Get Flux Analysis
```http
GET /api/sites/:siteId/flux-analysis
```

**Query Parameters:**
- `startDate` (required): Start date for analysis
- `endDate` (required): End date for analysis
- `co2_r2_min` (optional): Minimum R² for CO₂ (default: 0.6)
- `n2o_r2_min` (optional): Minimum R² for N₂O (default: 0.6)
- `n2o_flux_min` (optional): Minimum N₂O flux (default: -5)
- `time_head` (optional): Analysis window start (default: 200)
- `time_tail` (optional): Analysis window end (default: 300)

**Response:**
```json
[
  {
    "datetime": "2024-12-25T14:30:25.000Z",
    "run_id": "run_001",
    "chamber": 1,
    "treatment": "N0",
    "replicate": 1,
    "co2_flux": 5.23,
    "n2o_flux": 2.45,
    "h2o_avg": 18500,
    "co2_r2": 0.85,
    "n2o_r2": 0.72,
    "co2_slope": 0.0045,
    "n2o_slope": 0.0023,
    "measurement_start_time": "14:30",
    "duration_seconds": 180,
    "quality_flag": "good",
    "points_used": 15,
    "points_total": 18
  }
]
```

### Get Linear Regression Analysis
```http
GET /api/sites/:siteId/linear-regression
```

**Query Parameters:**
- `file` (required): Data file to analyze
- `chamber` (required): Chamber number
- `gas` (required): Gas type (co2, n2o, h2o)
- `timeHead` (optional): Analysis window start (default: 200)
- `timeTail` (optional): Analysis window end (default: 300)

**Response:**
```json
{
  "chamber": 1,
  "gas": "co2",
  "regression": {
    "slope": 0.0045,
    "intercept": 412.3,
    "r_squared": 0.85,
    "points_used": 15,
    "data_points": [
      {
        "time_elapsed": 200,
        "concentration": 412.5,
        "included": true
      }
    ]
  },
  "flux_rate": 5.23,
  "flux_units": "kg C/ha/d",
  "measurement_window": {
    "start_time": 200,
    "end_time": 300,
    "points_used": 15,
    "total_points": 18
  }
}
```

### Get Filtered Flux Data
```http
GET /api/sites/:siteId/filtered-flux
```

**Query Parameters:**
- `startDate` (required): Start date
- `endDate` (required): End date
- `co2_r2_min` (optional): Minimum CO₂ R²
- `n2o_r2_min` (optional): Minimum N₂O R²
- `n2o_flux_min` (optional): Minimum N₂O flux
- `time_head` (optional): Analysis window start
- `time_tail` (optional): Analysis window end

**Response:**
```json
[
  {
    "datetime": "2024-12-25T14:30:25.000Z",
    "run_id": "run_001",
    "measurement_start_time": "14:30",
    "chamber": 1,
    "treatment": "N0",
    "co2_flux": 5.23,
    "n2o_flux": 2.45,
    "h2o_avg": 18500,
    "co2_r2": 0.85,
    "n2o_r2": 0.72,
    "passed_qc": true
  }
]
```

### Get Daily/Cumulative Flux
```http
GET /api/sites/:siteId/daily-cumulative-flux
```

**Query Parameters:**
- `startDate` (required): Start date
- `endDate` (required): End date
- `co2_r2_min` (optional): Minimum CO₂ R²
- `n2o_r2_min` (optional): Minimum N₂O R²
- `n2o_flux_min` (optional): Minimum N₂O flux
- `time_head` (optional): Analysis window start
- `time_tail` (optional): Analysis window end

**Response:**
```json
{
  "daily": [
    {
      "date": "2024-12-25",
      "treatment": "N0",
      "co2_flux_mean": 5.23,
      "co2_flux_se": 0.45,
      "n2o_flux_mean": 2.45,
      "n2o_flux_se": 0.32,
      "chamber_count": 4
    }
  ],
  "cumulative": [
    {
      "date": "2024-12-25",
      "treatment": "N0",
      "co2_flux_cumulative_mean": 5.23,
      "co2_flux_cumulative_se": 0.45,
      "n2o_flux_cumulative_mean": 2.45,
      "n2o_flux_cumulative_se": 0.32,
      "chamber_count": 4
    }
  ],
  "metadata": {
    "total_interpolated_points": 1200,
    "daily_chamber_points": 300,
    "measurements_per_day": 6,
    "date_range": {
      "startDate": "2024-12-25",
      "endDate": "2024-12-25"
    }
  }
}
```

## 📷 Photo Management

### Upload Photo
```http
POST /api/photos/:siteId/photos
```

**Request:** `multipart/form-data` with photo file

**Response:**
```json
{
  "success": true,
  "filename": "photo_20241225_143025.jpg",
  "url": "/uploads/site_001/photos/photo_20241225_143025.jpg"
}
```

### List Photos
```http
GET /api/photos/:siteId/photos
```

**Response:**
```json
[
  {
    "filename": "photo_20241225_143025.jpg",
    "url": "/uploads/site_001/photos/photo_20241225_143025.jpg",
    "uploadDate": "2024-12-25T14:30:25.000Z",
    "size": 2048576
  }
]
```

## ❌ Error Responses

### Authentication Error (401)
```json
{
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

### Authorization Error (403)
```json
{
  "error": "Access denied",
  "code": "ACCESS_DENIED"
}
```

### Not Found (404)
```json
{
  "error": "Site not found",
  "code": "SITE_NOT_FOUND"
}
```

### Validation Error (400)
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "chamber",
      "message": "Chamber ID must be a positive integer"
    }
  ]
}
```

### Server Error (500)
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred"
}
```

## 📊 Data Models

### Site Model
```typescript
interface Site {
  id: string
  name: string
  description: string
  location: string
  dataPath: string
  chambers: number
  chamberConfigs: ChamberConfig[]
  chamberSpecs: ChamberSpecs
  qualityThresholds: QualityThresholds
}
```

### Chamber Configuration
```typescript
interface ChamberConfig {
  chamber: number
  treatment: string
  replicate: number
}
```

### Chamber Specifications
```typescript
interface ChamberSpecs {
  length_cm: number
  width_cm: number
  height_cm: number
  measurements_per_day: number
}
```

### Quality Thresholds
```typescript
interface QualityThresholds {
  co2_r2_min: number
  n2o_r2_min: number
  n2o_flux_min: number
}
```

### Flux Result
```typescript
interface FluxResult {
  datetime: string
  run_id: string
  chamber: number
  treatment: string
  replicate: number
  co2_flux: number    // kg C/ha/d
  n2o_flux: number    // g N/ha/d
  h2o_avg: number     // ppm
  co2_r2: number
  n2o_r2: number
  co2_slope: number   // ppm/s
  n2o_slope: number   // ppb/s
  measurement_start_time: string
  duration_seconds: number
  quality_flag: 'good' | 'poor' | 'failed'
  points_used: number
  points_total: number
}
```

## 🔄 Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication**: 5 requests per minute
- **Data endpoints**: 60 requests per minute
- **File upload**: 10 requests per minute
- **General endpoints**: 100 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## 🧪 Testing the API

### Using curl
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "ghgmonitor"}'

# Get sites (with token)
curl -X GET http://localhost:3001/api/sites \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get flux analysis
curl -X GET "http://localhost:3001/api/sites/site_001/flux-analysis?startDate=2024-12-20&endDate=2024-12-25" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using JavaScript/Fetch
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'ghgmonitor' })
})
const { token } = await response.json()

// Get sites
const sitesResponse = await fetch('/api/sites', {
  headers: { 'Authorization': `Bearer ${token}` }
})
const sites = await sitesResponse.json()
```

## 📝 API Versioning

Current API version: `v1`

All endpoints are prefixed with `/api/` for the current version. Future versions will use `/api/v2/`, etc.

## 🔧 Configuration

### Environment Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3001)
- `JWT_SECRET`: Secret key for JWT tokens
- `DATA_PATH`: Path to data directory
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `CORS_ORIGIN`: Allowed CORS origins