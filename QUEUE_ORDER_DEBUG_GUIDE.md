# Queue Order Issue - Diagnosis Guide

## Issue
User reports: "Adding items without clicking priority still makes them appear at the top of the queue"

## Root Cause Analysis

### What SHOULD Happen (FIFO):
```
Add Item A (normal) at 11:00:00 → Queue: [A]
Add Item B (normal) at 11:00:01 → Queue: [A, B]
Add Item C (priority) at 11:00:02 → Queue: [C, A, B]
Add Item D (normal) at 11:00:03 → Queue: [C, A, B, D]
```

### Current Evidence from Code:

#### Firebase Sorting (firebaseQueueService.js:118)
✅ **Correct**: `items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))`
- Ascending order = Oldest timestamps FIRST (priorities with very old timestamps)
- Normal items with recent timestamps go AFTER priorities

#### Firebase Sync - Initial Load (useFirebaseSync.js:49-62)
✅ **Logic Correct**: `insertToQueue(..., index)` during forEach
- Since Firebase items already sorted, using loop index maintains order

#### Firebase Sync - Updates (useFirebaseSync.js:68-90)  
✅ **Fixed in this session**: Changed to `insertToQueue(..., queue.length)`
- Appends new items to end instead of inserting at loop index
- Firebase already sorted, so appending preserves order

#### Customer Web (customer-web/src/firebase.js:42)
❌ **ISSUE FOUND**: NO priority support!
```javascript
addedAt: Date.now()  // Always current timestamp, never priority
```
- Customer-web items can NEVER be marked as priority
- Should match main app's priority logic

#### Priority Calculation (firebaseQueueService.js:15-50)
✅ **Logic Correct**:
- Priority items: `addedAt = topItem.addedAt - 1000ms` (LIFO - newer priorities float above older ones)
- Normal items: `addedAt = Date.now()`

---

## Debugging Steps

Check browser console for logs:

```javascript
// When adding a normal item:
[Firebase] Pushing to queue: { 
  title: "...",
  addedBy: "...", 
  isPriority: false,              // Should be FALSE for normal
  addedAt: 1708000000000,         // Should be recent timestamp
  timestamp: "2/16/2026, 3:13:40 PM"
}

// When adding a priority item:
[Firebase] Pushing to queue: {
  title: "...",
  addedBy: "...",
  isPriority: true,               // Should be TRUE
  addedAt: 1676464000000,         // Should be VERY OLD (year in past)
  timestamp: "3/15/2025, 3:13:40 PM"  
}

// Initial load restore:
[FirebaseSync] Items with timestamps: [
  { title: "Item1", addedAt: 1676464000, addedBy: "..." },  // Priority (old)
  { title: "Item2", addedAt: 1708000000, addedBy: "..." },  // Normal
]
```

---

## Potential Issues to Verify

1. **Is `isPriority=false` being passed correctly?**
   - Button "Thêm Vào Hàng Chờ" should call with `false`
   - Button "Ưu Tiên (Lên Đầu)" should call with `true`

2. **Are timestamps correct?**
   - Normal items should have RECENT timestamps
   - Priority items should have VERY OLD timestamps (year in past)
   
3. **Is Firebase returning items in correct sort order?**
   - Check the "[FirebaseSync] Items with timestamps" log
   - Priority items should be FIRST in the array

4. **Is customer-web involved?**
   - If items from customer-web appear at top, that's a separate bug
   - Customer-web doesn't support priority yet

---

## Next Steps

1. ✅ **Logging Added** - Console will now show detailed timestamps and priority flags
2. 🔍 **Test Scenario**:
   - Add 3 normal items: "Song A", "Song B", "Song C"
   - Check queue order (should be A, B, C)
   - Check console logs for timestamps
   - If order is wrong, logs will show why

3. **If Issue Persists**:
   - Share browser console output
   - Check timestamp values
   - Verify priority flag is being set correctly

---

## Files Modified
- `useFirebaseSync.js` - Added detailed logging
- `firebaseQueueService.js` - Added detailed logging when pushing

## Expected Behavior After Fix
- Normal items appear in FIFO order (oldest added first)
- Priority items appear at TOP in LIFO order (newest priority first)
- Items from same second maintain Firebase order
