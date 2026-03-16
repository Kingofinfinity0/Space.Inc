const fs = require('fs');
const content = fs.readFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/App.tsx', 'utf8');

const imports = `import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiService } from '../../services/apiService';
import {
    LayoutDashboard, Users, MessageSquare, Calendar, FileText, Settings, Plus, Search,
    Briefcase, ChevronRight, LogOut, Video, Download, Upload, Clock, UserPlus, ArrowRight,
    Link as LinkIcon, Copy, ListTodo, MoreVertical, Flag, Trash2, User, ArrowLeft,
    GripVertical, Activity, Shield, Lock, FileUp, Key, FilePlus as FilePlus2,
    File as DocIcon, Rocket, LayoutGrid, Inbox, UserCheck, CheckSquare, FolderClosed,
    Bell, Eye, Play, X, FileVideo, ChevronLeft
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    GlassCard, Button, Heading, Text, Input, Modal, Checkbox, Toggle,
    SkeletonLoader, SkeletonCard, SkeletonText, SkeletonImage
} from '../UI/index';
import { FileViewerModal } from '../FileViewerModal';
import { FileUploadModal } from '../FileUploadModal';
import { ClientSpace, ViewState, Meeting, Message, StaffMember, Task, SpaceFile, ChartData, ClientLifecycle } from '../../types';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useRealtimeFiles } from '../../hooks/useRealtimeFiles';
`;

const extractSection = (startMarker, endMarker) => {
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker, startIndex);
    if (startIndex === -1 || endIndex === -1) {
        console.log(`Could not find markers: ${startMarker} to ${endMarker}`);
        return null;
    }
    return content.substring(startIndex, endIndex);
};

if (!fs.existsSync('c:/Users/PC/Downloads/Space.inc/space.inc/components/views')) {
    fs.mkdirSync('c:/Users/PC/Downloads/Space.inc/space.inc/components/views', { recursive: true });
}

const extras = [
    ['// 1. Staff Dashboard View', '// 2. Spaces / Pipeline View', 'StaffDashboardView.tsx'],
    ['// 2. Spaces / Pipeline View', '// Clients / CRM View', 'SpacesView.tsx'],
    ['// Clients / CRM View', '// Staff / Team View', 'ClientsCRMView.tsx'],
    ['// Staff / Team View', '// SpaceChatPanel - Inline chat component for Space Detail view', 'StaffView.tsx'],
    ['// SpaceChatPanel - Inline chat component for Space Detail view', '// 3. Space Detail View', 'SpaceChatPanel.tsx'],
    ['// 3. Space Detail View', '// 4. Meeting Hub', 'SpaceDetailView.tsx'],
    ['// 4. Meeting Hub', '// 5. Task View', 'GlobalMeetingsView.tsx'],
    ['// 5. Task View', '// 6. Files View', 'TaskView.tsx'],
    ['// 6. Files View', '// 8. Settings View', 'GlobalFilesView.tsx'],
    ['// 8. Settings View', '// 9. Inbox View - Realtime Chat', 'SettingsView.tsx'],
    ['// 9. Inbox View - Realtime Chat', '// 11. Accountability Ledger (History) View', 'InboxView.tsx'],
    ['// 11. Accountability Ledger (History) View', '// 10. Client Portal View', 'HistoryView.tsx'],
    ['// 10. Client Portal View', '// --- Client Onboarding View ---', 'ClientPortalView.tsx'],
];

for (const [start, end, file] of extras) {
    const section = extractSection(start, end);
    if (section) {
        // Need to add export default at the end
        // Let's find the component name from the first const declaration
        let match = section.match(/const ([A-Za-z0-9_]+) =/);
        let exportStatement = '';
        if (match) {
            exportStatement = `\nexport default ${match[1]};\n`;
        }
        fs.writeFileSync(`c:/Users/PC/Downloads/Space.inc/space.inc/components/views/${file}`, imports + '\n\n' + section.trim() + exportStatement);
        console.log(`Wrote ${file}`);
    }
}
