# GHG Monitor - Greenhouse Gas Monitoring System

A comprehensive web application for monitoring, analyzing, and visualizing greenhouse gas emissions from agricultural systems using chamber-based measurement techniques.

## 🌱 Overview

GHG Monitor is a full-stack application designed for researchers and agricultural professionals to track CO₂, N₂O, and H₂O emissions from soil chambers. The system provides real-time data visualization, statistical analysis, and quality control assessment for greenhouse gas flux measurements.

## ✨ Features

### 📊 Dashboard
- **Real-time Overview**: Summary statistics with active chambers, total records, and site status
- **Recent Data Preview**: Latest 10 measurements with all sensor readings
- **Most Recent File Info**: Automatic detection of latest data files with metadata
- **Smart Data Validation**: Filters out invalid chamber IDs and malformed data

### 🔬 Analysis Tools

#### (a) Individual Cycle Data
- **Whole Measurement Cycle**: Complete time-series visualization for all chambers
- **Per-Chamber Analysis**: Multi-chamber comparison with color-coded traces  
- **Linear Regression**: Backend-calculated slope, R², intercept, and flux rates
- **Time Window Control**: Adjustable analysis windows for precise calculations

#### (b) Flux Quality Check
- **R² vs Time**: Diurnal patterns of regression quality
- **R² vs Flux Correlation**: Quality-flux relationship analysis
- **Custom Range Controls**: User-defined flux ranges for focused analysis
- **Quality Statistics**: Automated pass/fail assessment based on configurable thresholds

#### (c) Subdaily Flux Dynamics
- **Time-Series Analysis**: Complete date-time range visualization
- **Treatment Statistics**: Mean ± standard error across replicates
- **Quality Filtering**: Real-time application of R² and flux thresholds
- **Error Bar Visualization**: Statistical uncertainty display

#### (d) Daily/Cumulative Flux
- **Advanced Processing Pipeline**: 4-step interpolation and aggregation
- **Linear Interpolation**: Per-chamber between measurement cycles
- **Daily Aggregation**: Treatment-level statistics with SE calculation
- **Cumulative Analysis**: Running totals with baseline correction
- **Quality Inheritance**: Automatic use of criteria from subdaily analysis

### ⚙️ Configuration Management
- **Site Management**: Multi-site support with individual configurations
- **Chamber Specifications**: Customizable dimensions and measurement frequency
- **Quality Thresholds**: Configurable R² minimums and flux criteria
- **User Authentication**: Secure access with JWT tokens

### 📈 Data Processing
- **Automated Flux Calculations**: CO₂ (kg C/ha/d) and N₂O (g N/ha/d)
- **Temperature/Pressure Corrections**: Molar volume adjustments
- **Statistical Processing**: Mean, standard error, and replicate counting
- **Data Quality Assurance**: Comprehensive validation and filtering

## 🏗️ Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, Recharts
- **Backend**: Node.js, Express, TypeScript
- **State Management**: Context API + React Query
- **Charts**: Recharts with custom error bars and statistical overlays
- **Authentication**: JWT tokens with secure session management

## Project Structure

```
ghg-monitor/
├── frontend/          # React SPA application
├── backend/           # Node.js API server
├── data-processing/   # Python data processing scripts
├── data/             # Data storage directory
├── scripts/          # Original R analysis scripts
└── docs/             # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Git

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd ghg-monitor
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../backend
npm install
```

4. Install Python dependencies:
```bash
cd ../data-processing
pip install -r requirements.txt
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Access the application at `http://localhost:5173`

### Login Credentials

- **Password:** `ghgmonitor`

The application uses simple password authentication. Enter `ghgmonitor` when prompted to log in.

## Data Structure

The application expects GHG flux data in CSV format with the following columns:
- site id, run id, chamber id, date, time
- CO2 (ppm), H2O (ppm), N2O (ppb)
- Status and pressure readings

Data files should be organized by site in the `data/` directory.

## Configuration

Site configurations are managed in `data/site_registry.json`. Each site can have:
- Unique identifier
- Location information
- Chamber configurations
- Processing parameters
- Access controls

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.