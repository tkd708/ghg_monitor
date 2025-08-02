# GHG Monitor

A web application for monitoring greenhouse gas (GHG) emissions from multiple field trial sites.

## Features

- **Multi-site Support**: Monitor multiple GHG measurement locations
- **Real-time Visualization**: Interactive charts for CO2, N2O, and H2O data
- **Quality Control**: Automatic data filtering based on R² values
- **Responsive Design**: Works on desktop and mobile devices
- **Photo Documentation**: Upload and manage field visit photos
- **Data Export**: Export processed data for further analysis

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, Recharts
- **Backend**: Node.js, Express, TypeScript
- **Data Processing**: Python (pandas, numpy)
- **State Management**: Context API + React Query

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