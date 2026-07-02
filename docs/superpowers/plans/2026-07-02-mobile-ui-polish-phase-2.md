# Mobile UI Polish Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring legacy mobile screens closer to the official redesigned UI without changing backend behavior or routes.

**Architecture:** Keep the current route structure and business logic. Apply theme-aware styling to legacy screens by replacing hardcoded light-only colors with `Theme.of(context)` and existing `AppTheme`/`hospital_ui.dart` helpers where practical.

**Tech Stack:** Flutter, Material 3, GoRouter, Provider, existing AWS-backed API services.

---

### Task 1: Theme-Aware Legacy Styling

**Files:**
- Modify: `mobile/lib/screens/**/*.dart`
- Test: `mobile/test/models/model_test.dart`
- Test: `tests/caothien-mobile-contract.test.js`

- [ ] **Step 1: Replace hardcoded light backgrounds**

Replace exact legacy patterns:

```dart
backgroundColor: Colors.grey[100],
```

with:

```dart
backgroundColor: Theme.of(context).scaffoldBackgroundColor,
```

- [ ] **Step 2: Replace hardcoded dark app bars**

Replace exact legacy patterns:

```dart
backgroundColor: Color(0xFF2C3E50),
```

with:

```dart
backgroundColor: Theme.of(context).colorScheme.primary,
foregroundColor: Theme.of(context).colorScheme.onPrimary,
```

- [ ] **Step 3: Replace obvious white input surfaces**

For form fields using:

```dart
fillColor: readOnly ? Colors.grey[100] : Colors.white,
```

use:

```dart
fillColor: readOnly
    ? Theme.of(context).disabledColor.withValues(alpha: 0.08)
    : Theme.of(context).colorScheme.surface,
```

- [ ] **Step 4: Format and verify**

Run:

```powershell
E:\flutter_windows_3.44.1-stable\flutter\bin\dart.bat format mobile\lib
E:\flutter_windows_3.44.1-stable\flutter\bin\flutter.bat test
npm.cmd test
```

Expected: Flutter tests pass and Node contract tests pass.

### Task 2: Commit and Push

**Files:**
- Modify: Git branch `feat/week1-mobile-auth/caothien`

- [ ] **Step 1: Review diff**

Run:

```powershell
git diff --stat
git diff --check
```

Expected: No whitespace errors.

- [ ] **Step 2: Commit**

Run:

```powershell
git add .
git commit -m "Polish mobile legacy UI"
```

- [ ] **Step 3: Push**

Run:

```powershell
git push hospital HEAD:feat/week1-mobile-auth/caothien
```
