# Troubleshooting SIP 503 Service Unavailable (Cause 34)

## Problem

You are receiving a `503 Service Unavailable` error with `Reason: Q.850;cause=34` when the AI attempts to call out.

## Meaning

**Cause 34** means "No circuit/channel available". In FreePBX terms, this simply means **"I don't have a route for this number."**

## Diagnosis

The AI is dialing: `+4531426562`
The System is sending to FreePBX: `4531426562` (The `+` is stripped for compatibility)

FreePBX does **not** have an Outbound Route that matches `4531426562`.

## Solution: Fix FreePBX Outbound Routes

Follow these steps to ensure your FreePBX can route the call.

### 1. Log in to FreePBX

Go to your FreePBX administration panel in your browser.

### 2. Go to "Outbound Routes"

Navigate to **Connectivity** -> **Outbound Routes**.

### 3. Edit or Create a Route

If you have an existing route for your trunk, **Edit** it. Otherwise, click **Add Outbound Route**.

### 4. Configure "Dial Patterns"

This is the critical step. You need a pattern that matches the number the AI is sending.

Click the **Dial Patterns** tab.

Add a new pattern:

- **prepend**: (leave blank)
- **prefix**: (leave blank)
- **match pattern**: `XXXXXXXX.` (This matches any number with 8 or more digits - simplistic but effective for testing)
  - OR be more specific: `45XXXXXXXX` (Matches Danish numbers starting with 45)
  - OR if you want to support `+`: put `+` in the **prefix** (so it strips it? no, `prefix` is removed from the dial string before sending to trunk matching, `prepend` is added).
  
  **Generic Catch-All Pattern (Recommended for testing):**
  - **match pattern**: `.` (A single dot matches ANYTHING. **WARNING**: Use only for testing as it allows all calls)

  **Standard Pattern:**
  - **match pattern**: `X.` (Matches any number of digits)

### 5. Verify Trunk Selection

Click the **Route Settings** tab.

- **Trunk Sequence**: Ensure your active Trunk (the one that connects to the outside world) is selected here.

### 6. Submit and Apply

1. Click **Submit**.
2. Click the big red **Apply Config** button at the top right.

### 7. Test Again

Use the "Test AI Call" button in Mission Control or the voice interface.

## Advanced: Debugging CID Issues

If the route exists but fails, your Trunk provider might be rejecting the Caller ID.

- Check your Trunk settings.
- Ensure `P-Asserted-Identity` is allowed or required.
- Try forcing a valid Caller ID in your Outbound Route settings ("Route CID").
