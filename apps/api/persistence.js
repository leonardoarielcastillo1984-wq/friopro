// Simple persistence system for SGI 360
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DRILLS_FILE = path.join(DATA_DIR, 'drills.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const CLAUSE_MAPPINGS_FILE = path.join(DATA_DIR, 'clause-mappings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('📁 Data directory created:', DATA_DIR);
}

// Load data from files
function loadFromFile(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(`⚠️ Error loading ${filePath}, using default:`, error.message);
  }
  return defaultValue;
}

// Save data to files
function saveToFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Data saved to ${path.basename(filePath)} (${data.length} items)`);
  } catch (error) {
    console.error(`❌ Error saving to ${filePath}:`, error);
  }
}

// Export functions for use in main server
module.exports = {
  loadFromFile,
  saveToFile,
  DATA_DIR,
  DRILLS_FILE,
  DOCUMENTS_FILE,
  CLAUSE_MAPPINGS_FILE
};
