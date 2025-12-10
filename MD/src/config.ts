import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

export const config = {
  // API Base URL
  baseUrl: 'https://healthcarequality.mhcc.maryland.gov/MHCCV2_API_PROD',

  // API Endpoints
  endpoints: {
    search: '/api/AssistedLiving/Search',
    profile: (id: number) => `/api/AssistedLiving/Profile/${id}`,
    overview: (id: number) => `/api/AssistedLiving/Profile/${id}/Overview`,
    staffFluVacc: (id: number) => `/api/AssistedLiving/Profile/${id}/StaffFluVacc`,
    inspect: (id: number) => `/api/AssistedLiving/Profile/${id}/Inspect`,
    patientChar: (id: number) => `/api/AssistedLiving/Profile/${id}/PatientChar`,
    availableServices: (id: number) => `/api/AssistedLiving/Profile/${id}/AvailableServices`,
  },

  // Search parameters
  searchParams: {
    includeLessThan10Beds: 'true',
    maxDistance: '',
    fromZip: '',
    countyCode: '',
    name: '',
  },

  // Concurrency settings
  concurrency: {
    facilities: parseInt(process.env.MD_FACILITY_CONCURRENCY || '10', 10),
  },

  // Request settings
  request: {
    userAgent:
      process.env.MD_USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 30000,
    retryLimit: 3,
    retryDelay: 1000,
  },

  // Paths
  paths: {
    root: ROOT_DIR,
    data: join(ROOT_DIR, 'data'),
    output: join(ROOT_DIR, 'output'),
    progress: {
      inProgress: join(ROOT_DIR, 'data', 'url-in-progress.csv'),
      finished: join(ROOT_DIR, 'data', 'url-finished.csv'),
    },
  },
};
