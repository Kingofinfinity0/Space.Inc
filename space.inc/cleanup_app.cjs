const fs = require('fs');
const content = fs.readFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/App.tsx', 'utf8');

const importsToAdd = `
import StaffDashboardView from './components/views/StaffDashboardView';
import SpacesView from './components/views/SpacesView';
import ClientsCRMView from './components/views/ClientsCRMView';
import StaffView from './components/views/StaffView';
import SpaceChatPanel from './components/views/SpaceChatPanel';
import SpaceDetailView from './components/views/SpaceDetailView';
import GlobalMeetingsView from './components/views/GlobalMeetingsView';
import TaskView from './components/views/TaskView';
import GlobalFilesView from './components/views/GlobalFilesView';
import SettingsView from './components/views/SettingsView';
import InboxView from './components/views/InboxView';
import HistoryView from './components/views/HistoryView';
import ClientPortalView from './components/views/ClientPortalView';
import ClientOnboardingView from './components/views/ClientPortalView'; // Assuming it's in the same or similar file
`;

// Boundary for deletion: everything from line 114 to line 2203
const lines = content.split('\n');
const startLineIdx = 113; // line 114 (0-indexed)
const endLineIdx = 2202;   // line 2203 (0-indexed)

// Insert imports at the top (after existing imports)
let newContent = content.substring(0, content.indexOf('// --- Sub-Components ---'));
newContent += importsToAdd;
newContent += '\n// --- Sub-Components ---\n';
newContent += lines.slice(90, 113).join('\n') + '\n'; // Keep NavItem
newContent += lines.slice(2203).join('\n'); // Keep App component and everything after

fs.writeFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/App.tsx', newContent);
console.log('App.tsx cleaned up');
