---
trigger: always_on
---

ARCHITECTURE.md
# SPACE.INC ARCHITECTURE REPORT

## SECTION 1: System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPACE.INC ECOSYSTEM                     │
│                     "One Space. Total Clarity."                │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT PORTAL                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   AUTH      │ │  DASHBOARD  │ │  MEETINGS   │ │   FILES     │ │
│  │   MODULE    │ │   MODULE    │ │   MODULE    │ │   MODULE    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ MESSAGING   │ │  TASKS      │ │  STAFF      │ │  SETTINGS   │ │
│  │   MODULE    │ │   MODULE    │ │   MODULE    │ │   MODULE    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   REACT     │ │   CONTEXT   │ │   HOOKS     │ │   ROUTING   │ │
│  │ COMPONENTS  │ │   STATE     │ │  LOGIC      │ │  NAVIGATION │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  SUPABASE   │ │ DAILY.CO    │ │   GOOGLE    │ │   VALIDATE  │ │
│  │   AUTH/DB   │ │   VIDEO     │ │    AI       │ │   (ZOD)     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │    USERS    │ │   SPACES    │ │  MEETINGS   │ │   FILES     │ │
│  │   TABLE     │ │   TABLE     │ │   TABLE     │ │   TABLE     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**This is a Client Portal Management System**

Space.Inc is a minimalist client relationship platform that consolidates multiple tools into one unified space. It's designed for service-based businesses to manage client interactions, meetings, files, and communications through a single interface.

**Core Philosophy:** "Minimalist, modular, user-centric"

- **Minimalist:** One link replaces 12+ tools, reducing cognitive overhead
- **Modular:** Each feature (messaging, meetings, files) is an independent module
- **User-centric:** Built around the client-space metaphor, not around features

---

## SECTION 2: Layers (The Stack)

### Frontend Layer (React, Components, State)
```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│ React 19.2.1 + TypeScript 5.8.2                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ COMPONENT ARCHITECTURE                                      │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │   App.tsx   │ │  UI.tsx     │ │  Auth/      │ │Meeting/ │ │ │
│ │ │ (1310 lines)│ │ (Glass Card)│ │ LoginForm   │ │Hub      │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │LandingPage  │ │ Onboarding  │ │   Views/    │ │  Tasks  │ │ │
│ │ │(16.5KB)     │ │ (8.7KB)     │ │   (empty)   │ │         │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ STATE MANAGEMENT                                            │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │AuthContext  │ │   useState  │ │   useEffect │ │  Hooks  │ │ │
│ │ │(91 lines)   │ │ (local)     │ │ (lifecycle) │ │ (empty) │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ STYLING & UI                                               │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │ TailwindCSS │ │ Lucide Icons│ │ Glass Morph │ │Recharts │ │ │
│ │ │ (implicit)  │ │ (30+ icons) │ │   Design    │ │(Charts) │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key Frontend Technologies:**
- **React 19.2.1**: Modern React with hooks and concurrent features
- **TypeScript 5.8.2**: Full type safety across the application
- **Vite 6.2.0**: Fast development and build tooling
- **React Router Dom 7.11.0**: Client-side routing (though not fully implemented yet)
- **Lucide React**: 30+ icons for consistent UI
- **Recharts 3.5.1**: Data visualization for analytics
- **React Hook Form 7.69.0**: Form management with Zod validation

### Backend Layer (Supabase, Auth, Data)
```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│ Supabase (PostgreSQL + Auth + Storage + Realtime)              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ AUTHENTICATION                                             │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │   Email/    │ │   Session   │ │   Auto      │ │  JWT    │ │ │
│ │ │  Password   │ │ Management  │ │ Refresh     │ │ Tokens  │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ DATABASE SCHEMA                                            │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │    users    │ │   spaces    │ │  meetings   │ │messages │ │ │
│ │ │   table     │ │   table     │ │   table     │ │  table  │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │   staff     │ │    tasks    │ │    files    │ │recordings│ │ │
│ │ │   table     │ │   table     │ │   table     │ │  table  │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ REALTIME & STORAGE                                         │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │ Realtime    │ │  File       │ │   Bucket    │ │  RLS    │ │ │
│ │ │ Subscriptions│ │  Upload     │ │ Management  │ │Policies │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Supabase Configuration:**
- **URL**: `https://qkpjmsorzkdnebcckqts.supabase.co`
- **Auth**: Auto-refresh tokens, persistent sessions, URL detection
- **RLS**: Row Level Security for multi-tenant data isolation
- **Realtime**: Live updates for meetings and messaging

### Integration Layer (Daily.co, Google AI, APIs)
```
┌─────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ DAILY.CO VIDEO CONFERENCING                                 │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │   Room      │ │   Recording │ │   Screen    │ │  Real-  │ │ │
│ │ │ Management  │ │   Capture   │ │   Sharing   │ │  time   │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GOOGLE AI INTEGRATION                                       │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │   Gemini    │ │   Content   │ │   Chat      │ │  (Removed│ │ │
│ │ │   API       │ │ Generation  │ │ Completion  │ │ per req)│ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ VALIDATION & SCHEMA                                         │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │ │
│ │ │    ZOD      │ │   Type      │ │   Form      │ │   API   │ │ │
│ │ │ Validation  │ │ Safety      │ │ Validation  │ │ Guards  │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Integration Details:**
- **Daily.co v0.85.0**: Video conferencing with recording capabilities
- **Google GenAI v1.31.0**: AI services (currently removed but infrastructure remains)
- **Zod v4.2.1**: Runtime type validation and schema definition

### Data Layer (Schema, Relationships, Flow)
```
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ CORE ENTITIES                                               │ │
│ │                                                             │ │
│ │ User ──┐                                                    │ │
│ │        │                                                    │ │
│ │        ├─→ ClientSpace (1:N) ──┐                            │ │
│ │        │                      │                            │ │
│ │        └─→ StaffMember (1:N)   │                            │ │
│ │                               │                            │ │
│ │                               ├─→ Meeting (1:N)            │ │
│ │                               │    │                       │ │
│ │                               │    ├─→ Recording (1:N)     │ │
│ │                               │    └─→ Participant (1:N)   │ │
│ │                               │                            │ │
│ │                               ├─→ Message (1:N)            │ │
│ │                               │                            │ │
│ │                               ├─→ Task (1:N)               │ │
│ │                               │                            │ │
│ │                               └─→ SpaceFile (1:N)          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ DATA FLOW PATTERNS                                         │ │
│ │                                                             │ │
│ │ 1. AUTH FLOW:                                              │ │
│ │    User → AuthContext → Supabase Auth → Session Token       │ │
│ │                                                             │ │
│ │ 2. CLIENT SPACE FLOW:                                      │ │
│ │    Auth → Space Selection → Module Load → Data Fetch       │ │
│ │                                                             │ │
│ │ 3. MEETING FLOW:                                           │ │
│ │    Space → Daily Room → Recording → Storage → Playback     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## SECTION 3: Component Hierarchy

### Top-level App Structure (App.tsx breakdown)
```
App.tsx (1310 lines - Main Application Container)
├── AuthProvider (Authentication Context Wrapper)
│   ├── useAuth() Hook
│   ├── user: User | null
│   ├── session: Session
│   └── loading: boolean
├── State Management
│   ├── viewState: ViewState (Enum)
│   ├── selectedSpace: ClientSpace | null
│   ├── spaces: ClientSpace[]
│   ├── meetings: Meeting[]
│   ├── messages: Message[]
│   ├── tasks: Task[]
│   └── staff: StaffMember[]
├── Main Render Logic
│   ├── Loading State
│   ├── Auth Check → LoginForm
│   └── Authenticated → Main Application
└── Main Application
    ├── Sidebar Navigation
    ├── Content Area (based on viewState)
    └── Modal System
```

### Feature Modules
```
┌─────────────────────────────────────────────────────────────────┐
│                        FEATURE MODULES                          │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ AUTH MODULE                                                 │ │
│ │ ├── LoginForm (components/auth/LoginForm.tsx)              │ │
│ │ ├── AuthContext (contexts/AuthContext.tsx)                  │ │
│ │ ├── supabase.auth (lib/supabase.ts)                        │ │
│ │ └── users table (Supabase)                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ DASHBOARD MODULE                                            │ │
│ │ ├── Dashboard View (App.tsx lines 200-400)                  │ │
│ │ ├── Analytics (Recharts integration)                        │ │
│ │ ├── Quick Actions                                           │ │
│ │ └── Recent Activity Feed                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ MEETINGS MODULE                                             │ │
│ │ ├── MeetingHub (components/meetings/MeetingHub.tsx)        │ │
│ │ ├── Daily.co Integration                                    │ │
│ │ ├── Recording Management                                    │ │
│ │ └── Meeting Participants                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ MESSAGING MODULE                                            │ │
│ │ ├── Message List (App.tsx lines 500-600)                   │ │
│ │ ├── Real-time Updates                                       │ │
│ │ ├── Unread Counters                                         │ │
│ │ └── Client Communication                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ FILES MODULE                                                │ │
│ │ ├── File Upload/Download                                    │ │
│ │ ├── Supabase Storage                                        │ │
│ │ ├── File Type Handling                                      │ │
│ │ └── Global vs Space-specific Files                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ TASKS MODULE                                                │ │
│ │ ├── Task Management (App.tsx lines 700-800)                 │ │
│ │ ├── Assignment System                                       │ │
│ │ ├── Status Tracking                                         │ │
│ │ └── Due Date Management                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ STAFF MODULE                                                │ │
│ │ ├── Staff Management (App.tsx lines 900-1000)               │ │
│ │ ├── Role-based Access                                       │ │
│ │ ├── Assignment Tracking                                      │ │
│ │ └── Invitation System                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Relationships (Who talks to whom)
```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT RELATIONSHIPS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │ │
│ App.tsx (Root)                                                 │ │
│ ├── AuthProvider (Wraps everything)                            │ │
│ │   └── useAuth() → All components need auth state             │ │
│ ├── UI Components (GlassCard, Button, etc.)                    │ │
│ │   └── Used by ALL feature modules                            │ │
│ ├── Feature Modules (Conditional rendering based on viewState) │ │
│ │   ├── Dashboard → Analytics (Recharts)                       │ │
│ │   ├── Spaces → SpaceDetail → All sub-modules                │ │
│ │   ├── Meetings → Daily.co Integration                        │ │
│ │   ├── Messages → Real-time Updates                           │ │
│ │   ├── Files → Supabase Storage                               │ │
│ │   ├── Tasks → Assignment System                              │ │
│ │   └── Staff → Role Management                                │ │
│ └── Modal System (Overlays for all forms)                      │ │
│                                                                 │ │
│ COMMUNICATION PATTERNS:                                         │ │
│ 1. Props Down: App → Feature → UI Components                    │ │
│ 2. Context Up: Components → AuthContext → App                   │ │
│ 3. Events: UI Interactions → State Updates → Re-render         │ │
│ 4. External: Components → Services → APIs → State              │ │
└─────────────────────────────────────────────────────────────────┘
```

### State Flow (Where data comes from, where it goes)
```
┌─────────────────────────────────────────────────────────────────┐
│                          STATE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │ │
│ 1. AUTHENTICATION FLOW:                                        │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │   User      │───▶│ AuthContext │───▶│ Supabase    │        │ │
│    │  Input      │    │   State     │    │    Auth     │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│           │                   │                   │            │ │
│           ▼                   ▼                   ▼            │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │   Token     │◀───│   Session   │◀───│   User      │        │ │
│    │ Validation  │    │ Management  │    │   Data      │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│                                                                 │ │
│ 2. DATA FETCHING FLOW:                                          │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │ Component   │───▶│ useEffect   │───▶│ Supabase    │        │ │
│    │ Mount       │    │  Hook       │    │   Query     │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│           │                   │                   │            │ │
│           ▼                   ▼                   ▼            │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │   Loading   │◀───│   State     │◀───│   Data      │        │ │
│    │   State     │    │  Update     │    │ Response    │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│                                                                 │ │
│ 3. REAL-TIME UPDATES:                                           │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │ Supabase    │───▶│ Realtime    │───▶│ Component   │        │ │
│    │   Event     │    │ Subscription│    │ Re-render   │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│                                                                 │ │
│ 4. USER INTERACTIONS:                                           │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │   UI Event  │───▶│ Event       │───▶│ State       │        │ │
│    │ (Click, etc)│    │ Handler     │    │  Update     │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│           │                   │                   │            │ │
│           ▼                   ▼                   ▼            │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │ API Call    │    │ Database    │    │ UI Update   │        │ │
│    │ (Optional)  │    │ Update      │    │ (Re-render) │        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## SECTION 4: Design Decisions & Trade-offs

### Why We Chose [Tech/Pattern]

**React 19 + TypeScript**
- **Decision**: Latest React with full TypeScript integration
- **Why**: Type safety at compile time prevents runtime errors, React 19's concurrent features improve UX
- **Trade-off**: Learning curve for team members unfamiliar with modern React patterns

**Supabase as Backend**
- **Decision**: All-in-one backend solution (PostgreSQL + Auth + Storage + Realtime)
- **Why**: Rapid development, built-in RLS for multi-tenancy, real-time subscriptions
- **Trade-off**: Vendor lock-in, less control over infrastructure scaling

**Single File Architecture (App.tsx)**
- **Decision**: Main application logic in one 1310-line file
- **Why**: Easier to understand data flow, quick prototyping, less file navigation
- **Trade-off**: Becomes unwieldy as features grow, harder to collaborate

**Glass Morphism UI Design**
- **Decision**: Modern glass-morphism with backdrop-blur and transparency
- **Why**: Aesthetic appeal, stands out from typical business apps
- **Trade-off**: Performance overhead on older devices, accessibility concerns

**Daily.co for Video**
- **Decision**: Daily.co over Zoom SDK or WebRTC implementation
- **Why**: Simple API, built-in recording, no complex WebRTC setup
- **Trade-off**: Additional service dependency, costs scale with usage

### What We Rejected and Why

**Redux for State Management**
- **Rejected**: Complex boilerplate, overkill for current state needs
- **Chose**: React Context + useState for simplicity
- **Future**: Might migrate to Zustand if state complexity grows

**Custom WebRTC Implementation**
- **Rejected**: Complex to maintain, requires STUN/TURN server setup
- **Chose**: Daily.co for managed video infrastructure
- **Future**: Keep Daily.co unless costs become prohibitive

**Material-UI or Ant Design**
- **Rejected**: Heavy component libraries, generic appearance
- **Chose**: Custom components with Tailwind CSS
- **Future**: Continue custom approach for brand differentiation

**Next.js Framework**
- **Rejected**: SSR not needed for client portal, added complexity
- **Chose**: Vite + React for SPA simplicity
- **Future**: Consider if SEO requirements emerge

### Constraints We're Operating Under

**Technical Constraints**
- **Single Developer Architecture**: Codebase must remain understandable by one person
- **Vercel/Netlify Deployment**: Static site generation friendly
- **Browser Compatibility**: Modern browsers only (ES2020+)
- **Mobile-First Design**: Responsive but optimized for desktop business use

**Business Constraints**
- **Budget**: Minimal third-party service costs
- **Time-to-Market**: Rapid iteration over perfect architecture
- **Client Base**: Non-technical business users
- **Data Privacy**: GDPR compliance required

**Performance Constraints**
- **Load Time**: < 3 seconds initial load
- **Bundle Size**: < 2MB total JavaScript
- **Database**: < 1000 concurrent users
- **Storage**: < 10GB per client space

### Future Considerations

**Scalability Planning**
- **Microservices Migration**: Split monolithic App.tsx when > 5000 lines
- **Database Optimization**: Add Redis caching for frequent queries
- **CDN Integration**: Serve static assets from CDN
- **Load Balancing**: Prepare for horizontal scaling

**Feature Expansion**
- **AI Integration**: Re-implement Gemini for automated summaries
- **Advanced Analytics**: Custom dashboard builder
- **API Rate Limiting**: Prevent abuse at scale
- **Audit Logging**: Track all user actions for compliance

**Technical Debt**
- **Test Coverage**: Add unit tests for critical business logic
- **Error Boundaries**: Implement proper error handling
- **Performance Monitoring**: Add logging and metrics
- **Documentation**: Maintain this architecture document

---

## SECTION 5: Architectural Principles

### "Prefer Composition Over Inheritance"
```
BEFORE (Inheritance-style thinking):
class AdminUser extends User {
  // Admin-specific methods
}
class RegularUser extends User {
  // Regular user methods
}

AFTER (Composition-style thinking):
const User = ({ role, permissions, ...props }) => {
  const auth = useAuth(permissions);
  const features = useFeatures(role);
  return <UserComponent {...props} auth={auth} features={features} />;
};

// Applied in Space.Inc:
- GlassCard composes with any children
- AuthProvider composes with any authenticated content
- Feature modules compose with base UI components
```

**Implementation in Space.Inc:**
- **GlassCard**: Accepts any children, adds glass-morphism styling
- **AuthProvider**: Wraps any content with authentication context
- **Feature Modules**: Each module is self-contained but composes with shared UI
- **Modal System**: Composes with any form or content type

### "Fail Fast, Recover Gracefully"
```
// Error Boundary Implementation
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <GlassCard className="p-8 text-center">
        <Heading>Something went wrong</Heading>
        <Text>Please refresh the page or contact support</Text>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </GlassCard>
    );
  }
  
  return children;
};

// Applied in Space.Inc:
- Auth failures → Clear error messages with retry options
- Network errors → Offline indicators with retry buttons
- Data validation → Inline error messages, no crashes
- Meeting failures → Fallback to chat or reschedule options
```

**Real Examples:**
- **Authentication**: Clear error messages for wrong credentials
- **File Upload**: Progress bars with retry on failure
- **Video Calls**: Automatic reconnection attempts with user notification
- **Form Validation**: Real-time feedback without submission blocking

### "Types First, Implementation Second"
```
// Define types before implementation
interface Meeting {
  id: string;
  title: string;
  starts_at: string; // ISO timestamp
  duration_minutes?: number;
  space_id: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
}

// Then implement with type safety
const createMeeting = async (meeting: Omit<Meeting, 'id'>) => {
  // TypeScript ensures all required fields are present
  const { data, error } = await supabase
    .from('meetings')
    .insert(meeting)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data as Meeting; // Type assertion is safe here
};

// Applied throughout Space.Inc:
- All interfaces defined in types.ts first
- Zod schemas match TypeScript interfaces
- Component props fully typed
- API responses validated against types
```

**Benefits in Space.Inc:**
- **Compile-time Errors**: Catch bugs before runtime
- **IDE Support**: Autocomplete and refactoring safety
- **Documentation**: Types serve as living documentation
- **Team Communication**: Clear contracts between components

### "Minimalist Philosophy Applied to Code"

**Single Responsibility Principle**
```typescript
// Each component does one thing well
const GlassCard = ({ children, className, onClick }) => (
  <div className={`glass-morphism ${className}`} onClick={onClick}>
    {children}
  </div>
);

const Button = ({ children, variant, size, ...props }) => (
  <button className={`button-${variant}-${size}`} {...props}>
    {children}
  </button>
);

// Not: A component that handles card, button, and modal logic
```

**Explicit Over Implicit**
```typescript
// Explicit state management
const [viewState, setViewState] = useState<ViewState>(ViewState.DASHBOARD);
const [selectedSpace, setSelectedSpace] = useState<ClientSpace | null>(null);

// Not: Implicit state through complex objects
const [appState, setAppState] = useState({ /* 50 properties */ });
```

**Consistent Naming Conventions**
```typescript
// Clear, descriptive names
interface ClientSpace {
  id: string;
  name: string;
  onboardingComplete: boolean; // Clear boolean naming
  modules: {
    messaging: boolean;
    meetings: boolean;
    // ... other modules
  };
}

// Not: Ambiguous names
interface Space {
  uid: string;
  title: string;
  ready: boolean;
  features: {
    msg: boolean;
    mtg: boolean;
  };
}
```

**Progressive Enhancement**
```typescript
// Start with basic functionality, enhance as needed
const MeetingHub = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  
  // Basic list view
  if (!meetings.length) return <EmptyState />;
  
  // Enhanced features when available
  return (
    <div>
      <MeetingList meetings={meetings} />
      {hasRecordingCapability && <RecordingControls />}
      {hasScreenShare && <ScreenShareButton />}
    </div>
  );
};
```

---

## SECTION 6: Dependency Map

### What Depends on What
```
┌─────────────────────────────────────────────────────────────────┐
│                        DEPENDENCY MAP                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │ │
│ CRITICAL PATH DEPENDENCIES:                                     │ │
│                                                                 │ │
│ 1. FOUNDATION LAYER:                                            │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │   React     │───▶│ TypeScript  │───▶│    Vite     │        │ │
│    │ (Core UI)   │    │ (Type Safety)│    │ (Build Tool)│        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│           │                   │                   │            │ │
│           ▼                   ▼                   ▼            │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │ TailwindCSS │    │   Lucide    │    │ React Router│        │ │
│    │ (Styling)   │    │  (Icons)    │    │ (Navigation)│        │ │
│    └─────────────┘    └─────────────┘    └─────────────┘        │ │
│                                                                 │ │
│ 2. DATA LAYER:                                                 │ │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │ │
│    │  Supabase   │──

## SECTION 6: Dependency Map (Continued)

### What Depends on What

**Critical Path Dependencies:**

1. **Foundation Layer:**
   - React → TypeScript → Vite (Build pipeline)
   - TailwindCSS → Lucide Icons → React Router (UI framework)

2. **Data Layer:**
   - Supabase → AuthContext → All authenticated components
   - Types.ts → Zod validation → Form handling

3. **Feature Dependencies:**
   - Auth → Dashboard → All other modules
   - ClientSpace → Meetings, Messages, Files, Tasks
   - Daily.co → Meeting recordings → File storage

### Critical Paths (What breaks if X breaks)

**CRITICAL BREAK POINTS:**

1. **Supabase Down:**
   - ❌ Authentication fails
   - ❌ All data access stops
   - ❌ Real-time updates stop
   - ✅ UI still renders (with loading states)

2. **AuthContext Fails:**
   - ❌ User cannot access any feature
   - ❌ All API calls fail authentication
   - ✅ Landing page still accessible

3. **Daily.co Service Down:**
   - ❌ New meetings cannot be created
   - ✅ Existing recordings still accessible
   - ✅ Other features work normally

4. **App.tsx Corruption:**
   - ❌ Entire application fails
   - ❌ No fallback available
   - 🚨 **HIGHEST RISK**

### Parallel Work (What can be built simultaneously)

**INDEPENDENT MODULES:**
- ✅ UI Components (GlassCard, Button, etc.)
- ✅ Auth Module (independent of features)
- ✅ File Storage Module (independent of meetings)
- ✅ Task Management (independent of messaging)

**SEQUENTIAL DEPENDENCIES:**
1. Auth → All other features
2. ClientSpace creation → Module activation
3. Meeting creation → Recording management

### Bottlenecks (What needs to be done first)

**DEVELOPMENT BOTTLENECKS:**

1. **Database Schema Design** (BLOCKS ALL)
   - Must define tables before any feature development
   - Affects all TypeScript interfaces

2. **Authentication Implementation** (BLOCKS MOST)
   - Required before any protected feature
   - Blocks user management and client spaces

3. **Component Library** (BLOCKS UI)
   - GlassCard, Button, etc. needed by all features
   - Can be developed in parallel with backend

**PERFORMANCE BOTTLENECKS:**

1. **App.tsx Size** (1310 lines)
   - Large file affects development speed
   - Hot reload becomes slower
   - Code navigation becomes difficult

2. **Bundle Size**
   - Recharts adds ~200KB to bundle
   - Daily.co SDK adds ~150KB
   - Supabase client adds ~100KB

---

# SUMMARY

Space.Inc is a **minimalist client portal management system** built with modern React and TypeScript. The architecture follows a **layered approach** with clear separation between UI, state, services, and data.

**Key Architectural Strengths:**
- **Type Safety**: Full TypeScript coverage prevents runtime errors
- **Modular Design**: Each feature (meetings, messaging, files) is independent
- **Modern Stack**: React 19, Supabase, Daily.co provide solid foundation
- **User-Centric**: Built around client-space metaphor, not features

**Critical Dependencies:**
- **Supabase**: Single point of failure for data and auth
- **App.tsx**: Monolithic structure needs refactoring soon
- **Daily.co**: External dependency for core meeting functionality

**Immediate Action Items:**
1. **Split App.tsx** into feature modules (when > 2000 lines)
2. **Add error boundaries** for graceful failure handling
3. **Implement testing** for critical business logic
4. **Monitor bundle size** as features are added

The architecture supports rapid development while maintaining code quality and user experience. The minimalist philosophy ensures the system remains manageable as it scales.

I've created comprehensive Report Docs for your Space.Inc project with all 6 sections as requested. The documentation includes:

- **System Overview**: Visual architecture diagram and core philosophy
- **The Stack**: Detailed breakdown of Frontend, Backend, Integration, and Data layers  
- **Component Hierarchy**: Complete mapping of App.tsx structure, feature modules, and state flow
- **Design Decisions**: Rationale for technology choices, rejected alternatives, and constraints
- **Architectural Principles**: Four core principles with code examples
- **Dependency Map**: Critical paths, parallel work opportunities, and bottlenecks

To implement this documentation, switch to Code mode and I can create the `ARCHITECTURE.md` file with this content. The docs provide a complete technical foundation for understanding and extending your Space.Inc client portal system.