# FieldOps — User Flows Specification

---

## 1. Flow Overview

This document maps the primary end-to-end user flows for both the **FieldOps Mobile Application** (Field Workers) and the **FieldOps Web Console** (Dispatchers, Supervisors, Managers).

---

## 2. Mobile User Flows (Field Worker)

### Flow M-01: Authentication, Permissions & Onboarding

```mermaid
flowchart TD
    Launch[App Launch] --> CheckAuth{Has Valid Session Token?}
    CheckAuth -- Yes --> ValidateTenant{Validate Tenant Context}
    CheckAuth -- No --> LoginForm[Enter Email & Password]
    LoginForm --> SubmitLogin[POST /api/v1/auth/login]
    SubmitLogin --> CheckOrgCount{Belongs to Multiple Orgs?}
    CheckOrgCount -- Yes --> SelectOrg[Select Organization Screen]
    CheckOrgCount -- No --> SetActiveTenant[Set Active Tenant Context]
    SelectOrg --> SetActiveTenant
    ValidateTenant --> SetActiveTenant
    SetActiveTenant --> CheckPerms{Permissions Granted?}
    CheckPerms -- No --> PermScreen[Permissions Education Screen:\n- Precise Location (Check-ins)\n- Camera (Photo Proof)\n- Notifications (Dispatch)]
    PermScreen --> RequestOSPerms[Trigger OS Permission Dialogs]
    RequestOSPerms --> CheckPerms
    CheckPerms -- Yes --> DeltaSync[Execute Initial Delta Sync]
    DeltaSync --> LandHome[Land on Mobile Home Screen]
```

---

### Flow M-02: Shift Attendance Clock-In & Clock-Out

```mermaid
flowchart TD
    Home[Mobile Home Screen] --> InspectStatus{Current Duty Status}
    InspectStatus -- CLOCKED_OUT --> TapClockIn[Tap 'Clock In' Button]
    TapClockIn --> AcquireGPS[Acquire High-Accuracy GPS Coordinates]
    AcquireGPS --> GPSAccurate{Accuracy <= 50m?}
    GPSAccurate -- No --> RetryGPS[Show Satellite Acquisition Dialog & Retry up to 10s]
    RetryGPS --> AcquireGPS
    GPSAccurate -- Yes --> RecordClockIn[Record Local Clock-In Event:\n- Timestamp\n- Lat / Long / Accuracy\n- Status = CLOCKED_IN]
    RecordClockIn --> EnqueueSync[Enqueue Mutation for Background Sync]
    EnqueueSync --> UpdateUI[Update Home UI: Shift Timer Starts, Green Badge Active]

    InspectStatus -- CLOCKED_IN --> ShiftActive[Perform Field Duties]
    ShiftActive --> TapClockOut[Tap 'Clock Out' Button]
    TapClockOut --> ConfirmClockOut{Confirm End of Shift?}
    ConfirmClockOut -- No --> ShiftActive
    ConfirmClockOut -- Yes --> AcquireGPSOut[Acquire GPS Coordinates]
    AcquireGPSOut --> RecordClockOut[Record Local Clock-Out Event:\n- Timestamp\n- Lat / Long\n- Status = CLOCKED_OUT]
    RecordClockOut --> EnqueueSyncOut[Enqueue Mutation for Background Sync]
    EnqueueSyncOut --> UpdateUIOut[Update Home UI: Shift Closed, Summary Displayed]
```

---

### Flow M-03: Field Visit Execution with Geofence Verification

```mermaid
flowchart TD
    VisitsTab[Visits Tab] --> SelectVisit[Select Scheduled Visit from Timeline]
    SelectVisit --> ViewVisitDetail[View Visit Detail:\n- Address\n- Time Window\n- Customer Info\n- Associated Tasks]
    ViewVisitDetail --> TapNavigate[Tap 'Navigate' Button]
    TapNavigate --> LaunchMaps[Deep Link to Google Maps / Apple Maps / Waze]
    LaunchMaps --> ArriveSite[Worker Arrives at Physical Destination]
    ArriveSite --> TapCheckIn[Tap 'Check In' Button]
    TapCheckIn --> SampleGPS[Capture Current GPS Coordinates]
    SampleGPS --> CalculateDistance[Calculate Haversine Distance to Site Center]
    CalculateDistance --> CheckRadius{Distance <= Allowed Radius?}

    CheckRadius -- Yes --> MarkValid[Check-In Status = VALID]
    CheckRadius -- No --> FlagException[Check-In Status = LOCATION_EXCEPTION]
    FlagException --> ShowWarningModal[Display Warning Modal:\n'You are X meters from registered site']
    ShowWarningModal --> EnterReason[Prompt Optional Location Note]
    EnterReason --> MarkValid

    MarkValid --> RecordCheckIn[Save Local Check-In Record]
    RecordCheckIn --> OpenTaskWork[Open Associated Task Checklist]
    OpenTaskWork --> ExecuteTasks[Execute Work & Capture Proof]
    ExecuteTasks --> TapCheckOut[Tap 'Check Out' Button]
    TapCheckOut --> CaptureExitGPS[Capture Exit GPS Coordinates]
    CaptureExitGPS --> MarkVisitComplete[Visit Status = COMPLETED]
    MarkVisitComplete --> EnqueueSyncVisit[Enqueue Background Sync]
```

---

### Flow M-04: Task Execution & Proof of Work Capture

```mermaid
flowchart TD
    TaskList[Tasks Tab] --> SelectTask[Select Assigned Task]
    SelectTask --> TaskDetail[View Task Details & Checklist]
    TaskDetail --> TapStart[Tap 'Start Task']
    TapStart --> SetInProgress[Status -> IN_PROGRESS]
    SetInProgress --> PerformChecklist[Worker Checks Checklist Items]
    PerformChecklist --> AddProofMenu[Tap 'Add Proof of Work']
    
    AddProofMenu --> ChooseProof{Select Proof Type}
    ChooseProof -- Photo --> OpenCamera[Open Native Camera Interface]
    OpenCamera --> SnapPhoto[Capture Photo]
    SnapPhoto --> StampMeta[Embed Timestamp + GPS EXIF + Watermark]
    StampMeta --> SavePhotoLocal[Save Compressed Photo to Local Device Storage]
    SavePhotoLocal --> LinkProofTask[Link Proof Record to Task]

    ChooseProof -- Signature --> OpenSigPad[Open Touchscreen Signature Pad]
    OpenSigPad --> DrawSig[Customer / Site Contact Signs on Glass]
    DrawSig --> InputSignerInfo[Input Signer Name & Relationship]
    InputSignerInfo --> SaveSigLocal[Save Vector Signature SVG/PNG]
    SaveSigLocal --> LinkProofTask

    ChooseProof -- Notes --> InputNotes[Enter Text Notes / Serial Numbers]
    InputNotes --> LinkProofTask

    LinkProofTask --> CheckAllComplete{All Mandatory Checklist Items Checked?}
    CheckAllComplete -- No --> DisableComplete[Complete Button Disabled with Checklist Indicator]
    DisableComplete --> PerformChecklist
    CheckAllComplete -- Yes --> TapComplete[Tap 'Complete Task']
    TapComplete --> ValidateProofReqs{Mandatory Proof Requirements Met?}
    ValidateProofReqs -- No --> PromptProof[Prompt: 'At least 1 photo proof is required']
    PromptProof --> AddProofMenu
    ValidateProofReqs -- Yes --> SetCompleted[Task Status -> COMPLETED]
    SetCompleted --> EnqueueTaskSync[Enqueue Mutation for Server Sync]
    EnqueueTaskSync --> ReturnTaskList[Return to Task List with Success Toast]
```

---

### Flow M-05: Offline Synchronization & Conflict Handling

```mermaid
flowchart TD
    WorkerAction[Worker Completes Task / Check-In] --> WriteLocal[Write to Local SQLite Database]
    WriteLocal --> EnqueueItem[Insert Mutation Payload into Pending Sync Queue]
    EnqueueItem --> UpdateUIIcons[Status Bar Shows: 'Offline (N Pending Changes)']
    
    CheckNet{Network Connectivity Restored?}
    CheckNet -- No --> WaitRetry[Listen to OS Network State Change]
    WaitRetry --> CheckNet
    
    CheckNet -- Yes --> UpdateUIStatus[Status Bar Shows: 'Syncing...']
    UpdateUIStatus --> DequeueNext[Fetch Oldest Pending Mutation]
    DequeueNext --> SendToServer[POST /api/v1/sync/mutations with Idempotency Key]
    
    SendToServer --> ServerEval{Server Response}
    ServerEval -- 200 OK --> CommitServer[Server Commits Mutation & Returns Ack]
    CommitServer --> RemoveQueue[Remove Item from Local Queue]
    RemoveQueue --> HasMore{More Pending Items?}
    HasMore -- Yes --> DequeueNext
    HasMore -- No --> SetAllSynced[Status Bar Shows: 'All Changes Synced' (Green)]

    ServerEval -- 409 Conflict --> ConflictStrategy{Conflict Type}
    ConflictStrategy -- Task Canceled by Admin --> KeepProof[Keep Proof of Work; Flag Task as Canceled Locally]
    ConflictStrategy -- Stale Version --> MergeFields[Merge Non-Conflicting Fields; Last Write Wins on Proof]
    KeepProof --> RemoveQueue
    MergeFields --> RemoveQueue

    ServerEval -- 5xx / Network Drop --> ExponentialBackoff[Schedule Retry with Exponential Backoff + Jitter]
    ExponentialBackoff --> UpdateUIStatusFailed[Status Bar Shows: 'Sync Paused - Will Retry']
```

---

## 3. Web User Flows (Dispatch & Management)

### Flow W-01: Task Creation, Checklist Configuration & Dispatch

```mermaid
flowchart TD
    WebConsole[Web Dashboard] --> ClickNewTask[Click 'Create Task' Button]
    ClickNewTask --> TaskModal[Open Task Creation Modal]
    TaskModal --> EnterCoreDetails[Enter Title, Description, Priority]
    EnterCoreDetails --> SetSchedule[Set Due Date & SLA Window]
    SetSchedule --> SelectLocation{Requires Physical Site?}
    SelectLocation -- Yes --> ChooseSite[Select Registered Location from Dropdown / Search]
    SelectLocation -- No --> SkipSite[Leave Location Unset]
    ChooseSite --> BuildChecklist[Add Checklist Items & Flag Mandatory Items]
    SkipSite --> BuildChecklist
    BuildChecklist --> SetProofPolicy[Set Proof Policy: Require Photo / Signature]
    SetProofPolicy --> AssignWorker[Assign to Team and/or Field Worker]
    AssignWorker --> SubmitTask[Click 'Dispatch Task']
    SubmitTask --> ValidateTaskServer[Server Validates Tenant Context & RBAC]
    ValidateTaskServer --> PersistTask[Task Created with Status = ASSIGNED]
    PersistTask --> BroadcastPush[Send Push Notification to Field Worker Mobile App]
    BroadcastPush --> UpdateWebBoard[Task Appears on Kanban Board & Calendar]
```

---

### Flow W-02: Real-Time Live Map Oversight & Exception Triage

```mermaid
flowchart TD
    OpenMap[Open Live Operational Map] --> LoadLayer[Render Map with Registered Customer Sites]
    LoadLayer --> RenderWorkers[Plot Worker Last Verified Positions]
    RenderWorkers --> HighlightExceptions{Any Check-Ins with LOCATION_EXCEPTION?}
    HighlightExceptions -- Yes --> FlashPin[Pin Flashes Amber / Red with Exception Tag]
    FlashPin --> ClickPin[Dispatcher Clicks Exception Pin]
    ClickPin --> ShowExceptionCard[Display Exception Flyout:\n- Worker Name\n- Target Site\n- Actual Distance (e.g. 350m)\n- Worker Reason Note\n- Check-In Timestamp]
    ShowExceptionCard --> DispatcherAction{Dispatcher Action}
    DispatcherAction -- Override & Approve --> ClickOverride[Click 'Approve Exception']
    ClickOverride --> LogOverrideAudit[Server Logs Audit Event with Dispatcher ID]
    LogOverrideAudit --> ClearAlert[Alert Cleared; Visit Status -> VALID]
    DispatcherAction -- Contact Worker --> CallWorker[Click Direct Phone Call Link]
    DispatcherAction -- Reassign --> ReassignTask[Open Reassign Flyout]
```
