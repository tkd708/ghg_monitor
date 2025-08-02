# GHG Monitor Application Design Document

## 1. System Overview

The GHG Monitor is a web-based application designed to process, visualize, and analyze greenhouse gas (GHG) flux data from automated chamber measurement systems. The system handles variable-length measurement cycles and supports multiple field trial sites.

## 2. Core Design Principles

### 2.1 Flexibility
- **Variable Chamber Counts**: Support sites with different numbers of chambers (8, 12, 16, 24, etc.)
- **Variable Measurement Duration**: Chamber measurement periods can vary (3-10 minutes typical)
- **Dynamic Cycle Length**: Total measurement cycle adapts to chamber count and duration

### 2.2 Multi-Site Architecture
- Independent site configurations
- Site-specific data paths
- Isolated chamber configurations per site

### 2.3 Data Integrity
- Preserve raw measurement data
- Maintain traceability to source files
- Quality control at multiple stages

## 3. Data Model

### 3.1 Measurement Cycle
```
Complete Cycle = Sequential chamber measurements + transition periods

Example Timeline:
00:00:00 - 00:00:14: Transition/Initialization
00:00:15 - 00:05:14: Chamber 1 (300 seconds)
00:05:15 - 00:10:14: Chamber 2 (300 seconds)
...
01:15:15 - 01:20:14: Chamber 16 (300 seconds)
```

**Key Characteristics:**
- Each CSV file = one complete measurement cycle
- All chambers measured sequentially
- Measurement duration per chamber can vary
- Transition periods between chambers (empty chamber_id)

### 3.2 Data Structure Hierarchy
```
Site
├── Configuration
│   ├── Chamber Count
│   ├── Treatments
│   └── Quality Thresholds
├── Data Files
│   ├── Measurement Cycles (CSV files)
│   └── Photos
└── Chamber Configurations
    ├── Chamber-Plot Mapping
    ├── Treatment Assignment
    └── Replicate Information
```

### 3.3 Flux Calculation Model
```
Raw Concentration Data
    ↓
Time Window Selection (head/tail exclusion)
    ↓
Linear Regression (concentration vs time)
    ↓
Quality Check (R² threshold)
    ↓
Flux Rate Calculation
    ↓
Unit Conversion (ppm/s → g/ha/d)
```

## 4. System Architecture

### 4.1 Frontend Architecture
```
React SPA
├── Authentication Layer
├── Routing
│   ├── Public Routes (Login)
│   └── Protected Routes (App)
├── Context Providers
│   ├── AuthContext (User session)
│   └── SiteContext (Active site)
├── Feature Modules
│   ├── Site Management
│   ├── Data Analysis
│   │   ├── Individual Flux Viewer
│   │   └── Flux Summary Viewer
│   ├── Chamber Configuration
│   └── Photo Documentation
└── Shared Components
    ├── Charts (Recharts)
    ├── Forms
    └── Layout
```

### 4.2 Backend Architecture
```
Express API Server
├── Authentication Middleware (JWT)
├── API Routes
│   ├── /auth (Login/Logout)
│   ├── /sites (Site management)
│   ├── /data (Flux data processing)
│   └── /photos (Image storage)
├── Data Processing
│   ├── CSV Parser
│   ├── Chamber Detection
│   └── Flux Calculation (TODO)
└── File System
    ├── Site Registry
    ├── Data Files
    └── Photo Storage
```

### 4.3 Data Processing Pipeline
```
1. File Discovery
   - Scan site data directory
   - Parse filenames for metadata
   - Detect available cycles

2. Data Parsing
   - Read CSV with headers
   - Handle missing values
   - Detect chamber transitions

3. Chamber Segmentation
   - Group by chamber_id
   - Assign time_elapsed per chamber
   - Handle variable durations

4. Flux Calculation (Planned)
   - Apply time windows
   - Linear regression
   - Quality filtering
   - Unit conversion
```

## 5. Key Components

### 5.1 Individual Flux Viewer (Section a)
**Purpose**: Visualize raw concentration data from measurement files

**Features**:
1. **Whole Cycle View**: 
   - Shows entire measurement sequence
   - Time elapsed on X-axis
   - Concentration on Y-axis
   - Chamber transitions visible

2. **Per-Chamber View**:
   - Isolates each chamber's data
   - Resets time_elapsed for each chamber
   - Grid layout for comparison
   - Handles variable chamber counts

3. **Regression Analysis**:
   - Chamber-specific analysis
   - Configurable time windows
   - Real-time calculation
   - Visual regression line

### 5.2 Flux Summary Viewer (Section b)
**Purpose**: Display calculated flux rates with quality control

**Features**:
- Date range filtering
- Quality criteria configuration
- Treatment-based filtering
- Statistical summaries
- Export capabilities

### 5.3 Chamber Configuration Manager
**Purpose**: Define experimental design matching R script's df_plot

**Features**:
- Chamber-treatment mapping
- Plot assignment
- Replicate tracking
- N-rate specification
- CSV/JSON export

## 6. API Design

### 6.1 RESTful Endpoints
```
Authentication:
POST   /api/auth/login

Sites:
GET    /api/sites
GET    /api/sites/:id
PUT    /api/sites/:id
POST   /api/sites/:id/chambers

Data:
GET    /api/sites/:id/data-files
GET    /api/sites/:id/raw-data?file=xxx.csv
GET    /api/sites/:id/flux-summary?start=&end=&qc=
POST   /api/sites/:id/calculate-flux

Photos:
GET    /api/sites/:id/photos
POST   /api/sites/:id/photos
DELETE /api/sites/:id/photos/:photoId
```

### 6.2 Data Formats
**File List Response**:
```json
{
  "filename": "qut-cotton1_20072025_0000_data.csv",
  "date": "2025-07-20",
  "time": "00:00",
  "runId": "20072025_0000",
  "chambers": [1, 2, 3, ..., 16],
  "recordCount": 4800
}
```

**Raw Data Response**:
```json
{
  "datetime": "2025-07-20T00:00:15Z",
  "chamber": 1,
  "co2_ppm": 453.101,
  "n2o_ppb": 344.451,
  "h2o_ppm": 7485.77,
  "status": "0",
  "time_elapsed": 1
}
```

## 7. Quality Control Implementation

### 7.1 Data Quality Flags
- **Good**: R² ≥ threshold for both CO2 and N2O
- **Poor**: Only CO2 meets threshold
- **Failed**: Neither gas meets threshold

### 7.2 Time Window Application
- **Head Exclusion**: Skip initial stabilization period
- **Tail Exclusion**: Remove end effects
- **Dynamic Windows**: Configurable per site/chamber

## 8. Future Enhancements

### 8.1 Phase 2 Features
- Real-time data streaming
- Automated flux calculations
- Database integration
- Advanced statistical analysis
- Multi-user support

### 8.2 Phase 3 Features
- Machine learning for anomaly detection
- Predictive modeling
- Integration with weather data
- Mobile application
- API for external systems

## 9. Performance Considerations

### 9.1 Data Loading
- Lazy loading for large files
- Pagination for file lists
- Client-side caching

### 9.2 Calculations
- Web Workers for regression
- Debounced parameter updates
- Memoized calculations

### 9.3 Scalability
- File-based storage (Phase 1)
- Database migration path
- Horizontal scaling ready

## 10. Security

### 10.1 Authentication
- JWT tokens
- Secure password hashing (bcrypt)
- Token expiration

### 10.2 Data Protection
- Path traversal prevention
- Input validation
- CORS configuration

### 10.3 Future Considerations
- Role-based access control
- Audit logging
- Data encryption