# Personnel Platform Refactor Roadmap

## Architecture rule

Controls dispatch commands. Engines own reusable behavior. Plugins compose engines into business workflows. Renderers display state. No plugin may directly modify another plugin's state or persistence.

## Core platform

- `StateEngine` — scoped source of truth
- `FilterEngine` — reusable search and filtering
- `SelectionEngine` — reusable scoped selection and ordering
- `AssignmentEngine` — destination, assignment, grouping, sort, undo/redo
- `StoreEngine` — namespaced persistence and migrations
- `GeneratorEngine` — payload orchestration
- `ReportEngine` — preview, generation, revisions and output
- `CommandBus` — all button and keyboard actions
- `EventBus` — state and workflow notifications
- `PluginHost` — registration, dependencies and lifecycle

## Plugins

- Reassignment
- Transfer Queue
- AOGEN
- Generated Reports
- Report Editor
- Debug (Developer Mode only)

## Migration phases

### Phase 0 — Foundation

- [x] Platform core
- [x] Engine registry
- [x] Command bus
- [x] Event bus
- [x] Plugin host
- [x] Reassignment plugin pilot

### Phase 1 — Shared filters and selection

- [ ] Move main personnel filters to `FilterEngine`
- [ ] Move AO cart to `SelectionEngine`
- [ ] Add scoped selection tests
- [ ] Disable matching legacy handlers in Developer Mode

### Phase 2 — Assignment engine

- [ ] Own Step 1 selection state
- [ ] Own Step 2 destination directory
- [ ] Own Step 3 groups and group changes
- [ ] Add sorting and manual ordering
- [ ] Add validation and full undo/redo
- [ ] Remove legacy reassignment state dependencies

### Phase 3 — Store engine

- [ ] Move drafts and cart persistence to namespaced storage
- [ ] Add schema versions and migrations
- [ ] Add New Report and Continue Existing lifecycle
- [ ] Remove direct `localStorage` calls from plugins

### Phase 4 — Generator and report engines

- [ ] Define one official report payload
- [ ] Move preview generation
- [ ] Move AOGEN request generation
- [ ] Move generated-report revisions
- [ ] Add validation and payload tests

### Phase 5 — Plugin migration

- [ ] Transfer Queue plugin
- [ ] AOGEN plugin
- [ ] Generated Reports plugin
- [ ] Report Editor plugin
- [ ] Debug plugin

### Phase 6 — Legacy retirement

- [ ] Run Developer Mode without legacy patches
- [ ] Pass regression suite
- [ ] Move old files to `legacy/`
- [ ] Remove old production includes
- [ ] Deploy engine/plugin architecture

## Developer checks

```javascript
$PF.status();
$PF.plugins.list();
$PF.engines.list();
$RE.report();
```

The platform foundation remains Developer Mode only until each migrated feature passes local regression tests.
