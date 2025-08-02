# GHG Monitor System Documentation

## Overview
The GHG Monitor is a web-based application for monitoring and analyzing greenhouse gas (GHG) emissions from field trials. It processes flux data from automated chamber systems, providing real-time visualization and analysis capabilities.

## Data Structure

### CSV Data Files
Each CSV file represents a complete measurement cycle containing sequential measurements from all chambers.

#### File Naming Convention
Format: `{site-id}_{date}_{time}_data.csv`
- Example: `qut-cotton1_20072025_0000_data.csv`
- Date format: DDMMYYYY
- Time format: HHMM (24-hour)

#### CSV Structure
```csv
site id,run id,chamber id,date,time,co2[ppm],h2o avg[ppm],n2o avg [ppb],status,pair[kpa]
```

**Fields:**
- `site id`: Site identifier (e.g., "qut-cotton1")
- `run id`: Unique run identifier combining date and time
- `chamber id`: Chamber number (1-16 typically, can be empty during transitions)
- `date`: Measurement date (DD/MM/YYYY)
- `time`: Measurement time (HH:MM:SS)
- `co2[ppm]`: CO2 concentration in parts per million
- `h2o avg[ppm]`: H2O concentration in parts per million
- `n2o avg [ppb]`: N2O concentration in parts per billion
- `status`: Measurement status flag
- `pair[kpa]`: Atmospheric pressure in kilopascals

#### Measurement Cycle Structure
- Each file contains a complete cycle measuring all chambers sequentially
- Typical measurement: ~300 seconds (5 minutes) per chamber
- Chamber transitions have empty chamber_id values
- Total file duration: ~80-90 minutes for 16 chambers

### Site Registry Structure
Location: `data/site_registry.json`

```json
{
  "sites": [{
    "id": "test1",
    "name": "Test Site 1 - QUT Cotton Trial 1",
    "dataPath": "data/test1",
    "chambers": 16,
    "treatments": [...],
    "chamberConfigs": [...],
    "qualityThresholds": {
      "co2_r2_min": 0.6,
      "n2o_r2_min": 0.6,
      "n2o_flux_min": -5
    }
  }]
}
```

### Chamber Configuration (df_plot equivalent)
Matches R script's df_plot structure:
```json
{
  "chamber": 1,
  "plot": 1,
  "treatment": "N0",
  "replicate": 1,
  "nrate": 0,
  "description": "Control plot 1"
}
```

## Application Architecture

### Frontend (React + TypeScript)
```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx              # Main navigation layout
│   │   ├── ProtectedRoute.tsx      # Auth protection
│   │   ├── IndividualFluxViewer.tsx # (a) Individual flux visualization
│   │   └── FluxSummaryViewer.tsx    # (b) Calculated flux summary
│   ├── pages/
│   │   ├── Login.tsx               # Authentication
│   │   ├── SiteSelector.tsx        # Multi-site selection
│   │   ├── Dashboard.tsx           # Site overview
│   │   ├── Analysis.tsx            # Data analysis hub
│   │   ├── Photos.tsx              # Photo documentation
│   │   └── ChamberConfig.tsx       # Chamber configuration
│   ├── context/
│   │   ├── AuthContext.tsx         # Authentication state
│   │   └── SiteContext.tsx         # Current site context
│   └── types/
│       └── index.ts                # TypeScript interfaces
```

### Backend (Express + TypeScript)
```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts                 # Authentication endpoints
│   │   ├── sites.ts                # Site management
│   │   ├── data.ts                 # Data processing endpoints
│   │   └── photos.ts               # Photo upload/retrieval
│   ├── middleware/
│   │   └── auth.ts                 # JWT authentication
│   └── utils/
│       └── logger.ts               # Logging utilities
```

## Key Features Implementation Status

### ✅ Completed Features

#### 1. Authentication System
- Simple password-based authentication
- JWT token management
- Protected routes

#### 2. Multi-Site Support
- Site registry with configuration
- Site selector interface
- Per-site data isolation

#### 3. Chamber Configuration Management
- Chamber-treatment-replicate mapping
- Plot and N-rate configuration
- Export to CSV/JSON (df_plot format)

#### 4. Individual Flux Data Visualization (Section a)
- **(i) Whole Measurement Cycle**
  - Complete time series for entire file
  - All chambers shown sequentially
  - Gas selection (CO2, N2O, H2O)
  
- **(ii) Per-Chamber Analysis**
  - Data split by chamber
  - Chamber-specific time_elapsed
  - Individual concentration plots
  
- **(iii) Linear Regression Analysis**
  - Configurable time windows (head/tail)
  - Regression equation and R² calculation
  - Visual regression line with data points
  - Included/excluded point distinction

#### 5. Calculated Flux Summary (Section b)
- Quality control criteria interface
- Date range selection
- Treatment filtering
- Mock data visualization (pending calculation implementation)

#### 6. Data API Endpoints
- `/api/sites/:siteId/data-files` - List available CSV files
- `/api/sites/:siteId/raw-data` - Get raw data from specific file
- `/api/sites/:siteId/flux-summary` - Calculated flux with QC

### 🚧 Pending Implementation

#### 1. Actual Flux Calculation
- Linear regression per chamber measurement
- Quality control filtering (R² thresholds)
- Flux rate calculation from concentration slopes
- Unit conversions (ppm/s to g/ha/d)

#### 2. Data Processing Pipeline
- Python script for flux calculations
- Integration with R script logic
- Batch processing capabilities

#### 3. Real-time Updates
- WebSocket for live data updates
- Auto-refresh when new files arrive
- Progress indicators for processing

#### 4. Advanced Analytics
- Statistical summaries by treatment
- Temporal patterns analysis
- Export to statistical software formats

## Data Flow

### 1. Raw Data Import
```
CSV File → Backend Parser → Database/Memory → API Response
```

### 2. Chamber Detection
```
Raw Data → Group by Chamber ID → Time Window Extraction → Chamber Data Arrays
```

### 3. Flux Calculation (To Be Implemented)
```
Chamber Data → Time Window Selection → Linear Regression → R² Check → Flux Rate
```

### 4. Quality Control
```
Flux Results → R² Threshold Check → Flag Assignment (good/poor/failed)
```

## API Documentation

### Authentication
```
POST /api/auth/login
Body: { "password": "string" }
Response: { "token": "JWT_TOKEN", "user": {...} }
```

### Sites
```
GET /api/sites
Response: [{ "id": "test1", "name": "...", ... }]

GET /api/sites/:siteId
Response: { "id": "test1", "chambers": 16, ... }
```

### Data
```
GET /api/sites/:siteId/data-files
Response: [{
  "filename": "qut-cotton1_20072025_0000_data.csv",
  "date": "2025-07-20",
  "time": "00:00",
  "chambers": [1,2,3,...16],
  "recordCount": 4800
}]

GET /api/sites/:siteId/raw-data?file=filename.csv
Response: [{
  "datetime": "2025-07-20T00:00:15Z",
  "chamber": 1,
  "co2_ppm": 453.101,
  "n2o_ppb": 344.451,
  "h2o_ppm": 7485.77
}]
```

## Configuration Files

### Environment Variables (.env)
```
PORT=3001
JWT_SECRET=your-secret-key
PASSWORD_HASH=$2a$10$...
NODE_ENV=development
```

### Site Registry
- Location: `data/site_registry.json`
- Contains all site configurations
- Chamber-treatment mappings
- Quality thresholds

## Development Guidelines

### Adding New Features
1. Update TypeScript interfaces in `types/index.ts`
2. Create React components with proper typing
3. Add corresponding API endpoints
4. Update documentation

### Data Processing
1. Maintain R script compatibility
2. Preserve df_plot structure
3. Follow quality control standards
4. Document calculation methods

### Testing
1. Test with multiple chamber counts
2. Verify time window calculations
3. Check edge cases (missing data, transitions)
4. Validate regression accuracy

## Deployment

### Frontend Build
```bash
cd frontend
npm run build
```

### Backend Build
```bash
cd backend
npm run build
npm start
```

### Docker Support (Future)
- Containerized deployment
- Environment-based configuration
- Volume mounting for data persistence