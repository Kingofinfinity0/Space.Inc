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
    if(startIndex === -1 || endIndex === -1) {
        console.log(`Could not find markers: "${startMarker}" to "${endMarker}"`);
        return null;
    }
    return content.substring(startIndex, endIndex);
};

// StaffDashboardView
const staffDash = extractSection('// 1. Staff Dashboard', '// 2. Spaces View');
if (staffDash) {
    fs.writeFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/components/views/StaffDashboardView.tsx', imports + '\n\n' + staffDash.trim() + '\n\nexport default StaffDashboardView;\n');
    console.log('Wrote StaffDashboardView.tsx');
}

// SpacesView
const spacesView = extractSection('// 2. Spaces View', '// --- Phase 16: CRM & Compliance Views ---');
if (spacesView) {
    fs.writeFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/components/views/SpacesView.tsx', imports + '\n\n' + spacesView.trim() + '\n\nexport default SpacesView;\n');
    console.log('Wrote SpacesView.tsx');
}

// ClientsCRMView (includes CRMProgressBar)
const crmView = extractSection('// --- Phase 16: CRM & Compliance Views ---', 'const StaffView');
if (crmView) {
    fs.writeFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/components/views/ClientsCRMView.tsx', imports + '\n\n' + crmView.trim() + '\n\nexport default ClientsCRMView;\n');
    console.log('Wrote ClientsCRMView.tsx');
}

// StaffView
const staffView = extractSection('const StaffView', '// SpaceChatPanel');
if (staffView) {
    fs.writeFileSync('c:/Users/PC/Downloads/Space.inc/space.inc/components/views/StaffView.tsx', imports + '\n\n' + staffView.trim() + '\n\nexport default StaffView;\n');
    console.log('Wrote StaffView.tsx');
}
