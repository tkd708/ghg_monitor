# GHG Monitor Development Progress

## Project Overview
A web application to monitor greenhouse gas (GHG) emission data with visualization capabilities for multiple field trial sites. The application is designed to be a responsive single-page application (SPA) that works well on both desktop and mobile devices.

## Development History

### Session 1: Initial Planning and Design (2025-08-02)

**User Request:**
- Develop a GHG monitoring web application
- Use TypeScript and React for frontend
- Process flux data from CSV files in `data/flux_data_test`
- Analyze existing R scripts in `scripts/`
- Plan for future connection to external data server for real-time visualization
- Keep records of prompts and progress
- Support multiple GHG monitoring systems at different locations
- Manage via Git/GitHub repository
- Create responsive, mobile-friendly SPA
- Add photo upload capability for field documentation

**Analysis Completed:**
1. **Data Structure Analysis:**
   - CSV files contain flux measurements for CO2, N2O, and H2O
   - Data includes site ID, run ID, chamber ID, date/time, and concentrations
   - Measurements taken at 1-second intervals
   - Multiple chambers (1-16) with different sampling runs

2. **R Script Analysis:**
   - `data_process_and_visualise.R`: Main processing and visualization script
   - Implements flux calculations using linear regression
   - Quality control based on R² values
   - Creates time series plots, diurnal patterns, and cumulative emissions
   - Filters data based on quality thresholds (R² ≥ 0.6 for CO2, ≥ 0.6 for N2O)

3. **Architecture Design:**
   - **Frontend:** React + TypeScript with Recharts/D3.js for visualization
   - **Backend:** Node.js API with Python data processing service
   - **Real-time:** File watchers and WebSocket for live updates
   - **Storage:** Database for processed data

4. **Key Features Identified:**
   - Real-time monitoring of GHG fluxes
   - Interactive time series visualization
   - Chamber comparison and filtering
   - Diurnal pattern analysis
   - Cumulative emission tracking
   - Data quality indicators
   - Export functionality

**Next Steps:**
- Set up project structure
- Implement backend data processing pipeline
- Create React frontend components
- Establish real-time data flow

### Final Design Decisions:

1. **State Management:** Context API + React Query for simplicity
2. **Data Updates:** Static files from repository (Phase 1), hourly external polling (Phase 2)
3. **Authentication:** Simple shared password to start
4. **Focus:** Individual site visualization (no cross-site comparisons initially)

### Completed Planning (All 15 items ✓):
- Multi-site architecture with site registry
- Responsive SPA design (desktop-first, mobile-friendly)
- Photo upload system for field documentation
- Git repository structure
- Data processing pipeline
- Quality control with R² filtering
- Time series and diurnal pattern visualizations
- Cumulative emission tracking
- Chamber-based data organization

**Ready for Implementation Phase**

## Final System Architecture

### Technology Stack
- **Frontend:** React 18 + TypeScript + TailwindCSS + Recharts
- **Backend:** Node.js + Express + Python data processing
- **State Management:** Context API + React Query
- **Data Storage:** Local file system (Phase 1), External DB (Phase 2)
- **Build Tools:** Vite + ESBuild
- **Testing:** Jest + React Testing Library

### Project Structure
```
ghg-monitor/
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/        # Route pages
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API services
│   │   ├── context/      # React context
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   ├── public/
│   └── package.json
├── backend/               # Node.js server
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utilities
│   │   └── types/        # TypeScript types
│   └── package.json
├── data-processing/       # Python scripts
│   ├── flux_calculator.py
│   ├── data_quality.py
│   └── requirements.txt
├── data/                  # Data storage
│   ├── site_registry.json
│   └── [site-folders]/
├── scripts/              # Original R scripts
├── docs/                 # Documentation
├── .gitignore
├── README.md
└── CLAUDE.md
```

### Core Features
1. **Site Management**
   - Multi-site support with site registry
   - Site-specific configurations
   - Hierarchical organization

2. **Data Visualization**
   - Time series plots (CO2, N2O, H2O)
   - Diurnal pattern analysis
   - Chamber-by-chamber comparison
   - Cumulative emissions tracking
   - Quality indicators (R² values)

3. **User Interface**
   - Responsive design (320px to 4K)
   - Desktop-first, mobile-friendly
   - Interactive charts with zoom/pan
   - Data filtering and export
   - Photo gallery for field docs

4. **Data Management**
   - CSV file processing
   - Quality control filtering
   - Hourly data updates (Phase 2)
   - Local storage (Phase 1)

### API Endpoints Design
```
GET  /api/sites              # List all sites
GET  /api/sites/:id          # Get site details
GET  /api/sites/:id/data     # Get flux data
GET  /api/sites/:id/photos   # Get site photos
POST /api/sites/:id/photos   # Upload photos
GET  /api/auth/verify        # Verify password
```

### Security
- Simple shared password authentication (Phase 1)
- Environment-based configuration
- CORS protection
- Input validation

### Deployment Strategy
- Docker containers for easy deployment
- Environment variables for configuration
- Git-based version control
- Manual deployment process (no CI/CD initially)