# Manual Testing Instructions - Phase 2 Complete

**Goal**: Verify the fully functional desktop app works end-to-end with the backend.

---

## Prerequisites

1. **Claude Code CLI is installed and configured**:
   ```bash
   claude --version
   # If not installed:
   npm install -g @anthropic-ai/claude-code
   claude configure
   ```

2. **Project dependencies are installed**:
   ```bash
   cd /Users/yeonwoo/dev/claude-code-manager
   pnpm install
   ```

---

## Option 1: Automated Startup (Recommended)

```bash
# Make script executable (first time only)
chmod +x start-dev.sh

# Start everything
./start-dev.sh
```

This will:
- ✅ Check Claude CLI is installed
- ✅ Start backend server in new terminal
- ✅ Start desktop app in new terminal
- ✅ Open the Tauri window automatically

**You should see:**
- Terminal 1: `✅ Server listening on http://0.0.0.0:3000`
- Terminal 2: Tauri app building and launching
- Desktop window: Claude Code Manager app opens

---

## Option 2: Manual Startup

**Terminal 1 - Backend:**
```bash
cd /Users/yeonwoo/dev/claude-code-manager
pnpm --filter @claude-code-manager/server dev
```

**Wait for:**
```
✅ Server listening on http://0.0.0.0:3000
```

**Terminal 2 - Desktop App:**
```bash
cd /Users/yeonwoo/dev/claude-code-manager/apps/desktop
pnpm dev
```

**Tauri window should open automatically**

---

## Manual Testing Checklist

### 1. Backend Health Check ✅

Before testing the app, verify the backend is responding:

```bash
# In a third terminal
curl http://localhost:3000/health
```

**Expected:**
```json
{"status":"ok"}
```

---

### 2. Desktop App - First Launch ✅

When the app opens, you should see:

- [  ] App title: "Claude Code Manager"
- [  ] Left sidebar with "Sessions" heading
- [  ] "New Session" button
- [  ] Either:
  - Empty state: "No sessions yet" message, OR
  - List of existing sessions
- [  ] Right side: "Select a session to start chatting"
- [  ] Settings button in header

**Take a screenshot if there are any visual issues**

---

### 3. Settings Panel ✅

1. Click "Settings" button in header
2. Verify you see:
   - [  ] "Settings" heading
   - [  ] Message: "API key is managed by Claude Code CLI"
   - [  ] Model dropdown (Sonnet, Opus, Haiku)
   - [  ] Theme dropdown (Light, Dark, System)
   - [  ] Save button
3. Change model to "Opus"
4. Change theme to "Dark"
5. Click "Save"
6. Verify: "Settings saved successfully!" message appears
7. Click "Chat" button to return

**Expected behavior:**
- Settings persist between saves
- Theme changes immediately
- No errors in console (F12)

---

### 4. Create a Session ✅

1. Click "New Session" button
2. In the dialog:
   - [  ] "Title" input field visible
   - [  ] "Root Directory" input field visible
   - [  ] "Base Branch" input field (optional)
3. Fill in:
   - Title: `Test Session 1`
   - Root Directory: Click browse and select `/Users/yeonwoo/dev/claude-code-manager` (or any Git repo)
   - Base Branch: `main` (or leave empty)
4. Click "Create"

**Expected behavior:**
- Dialog closes
- New session appears in left sidebar
- Session is automatically activated (highlighted)
- Right side shows chat interface
- Message input is ready

**If error occurs:**
- Check that the directory is a Git repository
- Check backend logs in Terminal 1
- Verify permissions on the directory

---

### 5. Send a Message ✅

**IMPORTANT**: This will make a real API call to Claude via Claude Code CLI!

1. With a session active, type in message input:
   ```
   Hello! Can you tell me what this project does based on the README?
   ```

2. Press Enter or click Send

**Expected behavior:**
- [  ] Message appears in chat as "user" message
- [  ] Loading indicator shows (if visible)
- [  ] Assistant message starts streaming in
- [  ] Full response appears after a few seconds
- [  ] Both messages saved and visible

**If streaming doesn't work:**
- Check backend logs for Claude CLI errors
- Verify Claude CLI is configured: `claude configure`
- Check backend Terminal 1 for error messages

---

### 6. Session Switching ✅

1. Create a second session:
   - Title: `Test Session 2`
   - Same directory as before

**Expected behavior:**
- [  ] Second session appears in sidebar
- [  ] Second session is now active
- [  ] Chat area is empty (no messages in new session)
- [  ] "No messages yet" empty state shows

2. Click on first session in sidebar

**Expected behavior:**
- [  ] First session becomes active
- [  ] Previous messages reappear
- [  ] Message input ready

---

### 7. Session Deletion ✅

1. Click delete button (X or trash icon) on second session
2. Confirmation dialog appears
3. Click "Delete"

**Expected behavior:**
- [  ] Session removed from sidebar
- [  ] If it was active, first session becomes active
- [  ] No errors

---

### 8. Empty States ✅

Test that empty states display correctly:

**No Sessions:**
1. Delete all sessions
2. Verify: "No sessions yet" message shows
3. Verify: "Create your first session to get started" shows

**No Messages:**
1. Create a new session
2. Don't send any messages
3. Verify: "No messages yet. Start a conversation!" shows

**No Active Session:**
1. Have sessions but none selected (refresh app if needed)
2. Verify: "Select a session to start chatting" shows

---

### 9. Error Handling ✅

Test that errors are handled gracefully:

**Backend Down:**
1. Stop backend server (Ctrl+C in Terminal 1)
2. Try to create a session
3. **Expected**: Error message displays (not a crash)
4. Restart backend: `pnpm --filter @claude-code-manager/server dev`
5. Try again - should work

**Invalid Directory:**
1. Try to create session with non-existent directory
2. **Expected**: Error message about directory not found

**Network Error Simulation:**
1. With backend running, create a session
2. Kill backend
3. Try to send a message
4. **Expected**: Error message, not app crash

---

### 10. Loading States ✅

Verify loading indicators work:

1. Create session and observe:
   - [  ] Sessions list shows "Loading sessions..." initially
   - [  ] Transitions to session list

2. Send a message and observe:
   - [  ] Input disabled while sending
   - [  ] Some indication message is processing

3. Switch sessions and observe:
   - [  ] "Loading messages..." shows briefly
   - [  ] Transitions to message list

---

### 11. User Experience ✅

Test general usability:

**Keyboard Shortcuts:**
- [  ] Ctrl+Enter (or Cmd+Enter on Mac) sends message from input
- [  ] ESC closes dialogs

**Scrolling:**
- [  ] Long message lists scroll correctly
- [  ] Auto-scrolls to newest message

**Responsiveness:**
- [  ] App responds quickly to clicks
- [  ] No lag when typing

**Visual:**
- [  ] Text is readable
- [  ] Buttons are clearly labeled
- [  ] Active state is obvious
- [  ] Theme (light/dark) works

---

## Common Issues & Solutions

### App Won't Start

**Error:** Tauri build errors
```bash
cd apps/desktop
pnpm install
pnpm dev
```

**Error:** Backend won't start
```bash
# Check Claude CLI
claude --version

# Reinstall if needed
npm install -g @anthropic-ai/claude-code-manager

# Check backend logs
cd packages/server
pnpm dev
```

### Network Errors

**Error:** "Network request failed"
```bash
# Verify backend is running
curl http://localhost:3000/health

# Check if port 3000 is blocked
lsof -i :3000
```

### Claude CLI Errors

**Error:** "Claude Code CLI not found"
```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Configure API key
claude configure

# Test it works
claude -p "test" --output-format stream-json
```

**Error:** "Rate limit exceeded"
- Wait a few minutes
- Claude API has rate limits
- Try again after delay

### Database Issues

**Error:** SQLite errors
```bash
# Remove database and restart
rm ~/.claude-code-manager/data/sessions.db

# Restart backend - database will be recreated
```

---

## Performance Notes

**Expected Performance:**

- App startup: 2-3 seconds (Tauri cold start)
- Session creation: < 500ms
- Message send: 1-5 seconds (depends on Claude API)
- Session switch: < 200ms
- Settings save: < 100ms

**If performance is slow:**
1. Check CPU usage in Activity Monitor
2. Check network connection
3. Verify no other apps using port 3000
4. Try restarting both servers

---

## Next Steps After Testing

Once all tests pass:

1. **Report any bugs found** with:
   - Description of issue
   - Steps to reproduce
   - Screenshots if visual
   - Console errors (F12 DevTools)

2. **Note any UX improvements**:
   - Confusing workflows
   - Missing features
   - Visual issues
   - Performance problems

3. **Ready for Phase 3** if all tests pass!

---

## Debug Mode

If you need to debug issues:

**Open DevTools:**
- macOS: Cmd+Option+I
- Windows/Linux: Ctrl+Shift+I

**Check Console Tab for:**
- JavaScript errors
- Network errors
- API response errors

**Check Network Tab for:**
- Failed requests
- Slow requests
- WebSocket connections

**Backend Logs:**
- All backend activity is logged in Terminal 1
- Look for error messages
- API call details
- Claude CLI output

---

## Success Criteria

The Phase 2 desktop app is working correctly if:

- ✅ App launches without errors
- ✅ Backend connects successfully
- ✅ Can create sessions
- ✅ Can send messages and receive responses
- ✅ Can switch between sessions
- ✅ Can delete sessions
- ✅ Settings persist
- ✅ No crashes or freezes
- ✅ Error messages are clear
- ✅ Loading states show appropriately
- ✅ Empty states display correctly

---

**Happy Testing!** 🎉

If you encounter issues, see [TESTING.md](./TESTING.md) for detailed troubleshooting.
