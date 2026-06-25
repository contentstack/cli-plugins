# fix: export logs disappear after clone confirmation prompt in `cm:stacks:clone`

## Commit Message

```
fix(clone): remove console.clear() from cloneTypeSelection to preserve export logs

A console.clear() call at the top of cloneTypeSelection() was unconditionally
wiping the terminal buffer right before the "Type of data to clone" prompt,
erasing all previously printed export progress logs. Removing it lets all
module-wise export logs persist on screen throughout the full clone flow.
```

---

## Problem

When running `csdx cm:stacks:clone`, the CLI prints module-wise export progress logs (Stack, Assets, Locales, Environments, Global Fields, Content Types, Entries). After the user selects **"Want to clone content into a new stack? → Yes"** and provides the Organization, Stack Name, and Type of data inputs, **all previously printed export logs disappear from the terminal**.

This makes it impossible to review the export process or debug module-wise progress after the fact.

---

## Root Cause

`cloneTypeSelection()` in `clone-handler.ts` had an unconditional `console.clear()` call as its very first line:

```ts
async cloneTypeSelection(): Promise<any> {
  console.clear(); // ← wiped the entire terminal buffer
  return new Promise(async (resolve, reject) => {
    ...
    await inquirer.prompt(cloneTypeSelection); // "Type of data to clone"
  });
}
```

**Execution sequence:**
```
clone-handler.ts  HandleExportCommand runs        → export logs printed to console
clone-handler.ts  executeDestination()            → "Want to clone into a new stack?" prompt
clone-handler.ts  createNewStack()                → org, stack name prompts
clone-handler.ts  CloneTypeSelectionCommand       → cloneTypeSelection() called
clone-handler.ts  console.clear()                 ← entire terminal buffer wiped here
clone-handler.ts  inquirer.prompt(cloneType)      → renders on blank terminal
```

The export phase completes and all its logs are visible — then `console.clear()` fires just before the final "Type of data" prompt, erasing everything. `console.clear()` emits `\x1bc` (full terminal reset), not just a line clear, so there is no way to scroll back.

---

## Fix

Removed the `console.clear()` from `cloneTypeSelection()`. The inquirer list prompt renders correctly without it — there was no functional reason for the clear.

**`src/core/util/clone-handler.ts`**
```diff
  async cloneTypeSelection(): Promise<any> {
-   console.clear();
    return new Promise(async (resolve, reject) => {
```

---

## What Is Not Changed

Two other `console.clear()` calls remain at lines 425 and 506 inside the Shift+Left (undo) keypress handlers in `execute()` and `executeDestination()`. These are conditional on a specific keypress and are tracked separately for a follow-up fix.

---

## Acceptance Criteria Met

| Criteria | Status |
|---|---|
| All previously printed export logs remain visible after "Yes" confirmation | ✅ |
| No log removal after clone confirmation | ✅ |
| New logs append below existing logs without overwriting | ✅ |
| Module-wise export logs (Stack, Assets, Locales, etc.) remain traceable | ✅ |
| Consistent CLI behaviour during the entire clone operation | ✅ |
