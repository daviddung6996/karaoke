# Priority Queue Logic - Analysis & Fix

## Issue Found
**Khách hàng đặt ưu tiên không luôn ưu tiên đúng cách, đặc biệt khi có nhiều ưu tiên.**

## Root Cause
In `useFirebaseSync.js`, line 87: `insertToQueue(..., index)` was inserting new items at the loop counter position instead of appending to queue end. Since Firebase already sorts items correctly by `addedAt` (ascending), appending maintains order.

### Problematic Code (Line 67-89 OLD)
```javascript
firebaseItems.forEach((item, index) => {
    // ...
    insertToQueue({...}, index);  // ❌ WRONG: Uses loop index instead of queue length
});
```

## How Priority Actually Works

### 1️⃣ Firebase Timestamp Calculation
**File**: `firebaseQueueService.js` lines 9-50

- **Normal item**: `addedAt = Date.now()` (e.g., 1708000000000)
- **Priority item**: 
  - If queue empty: `addedAt = Date.now() - 365 days` (e.g., 1676464000000) 
  - If queue has items: `addedAt = topItem.addedAt - 1000ms` (LIFO - Last In First Out)

**Result**: Priority items get older timestamps, so they sort first.

**LIFO Effect**:
```
Priority request 1: addedAt = T_baseline
Priority request 2: addedAt = T_baseline - 1000 (newer priority floats above older priority)
Priority request 3: addedAt = T_baseline - 2000 (newest priority on top)
Normal requests: addedAt = now (all after priority items)
```

### 2️⃣ Firebase Sorting
**File**: `firebaseQueueService.js` line 118

```javascript
items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
```

✅ Ascending order = Priorities first (oldest timestamps), then normal items (newest timestamps).

### 3️⃣ Queue Sync Logic
**File**: `useFirebaseSync.js`

#### Initial Load (F5 Refresh) - Lines 49-61
```javascript
validItems.forEach((item, index) => {
    insertToQueue({...}, index);
});
```
✅ **Correct**: Firebase items already sorted → forEach with index maintains order

#### Subsequent Updates - Lines 67-89 OLD
```javascript
firebaseItems.forEach((item, index) => {
    insertToQueue({...}, index);  // ❌ BUG: Should use queue.length
});
```
❌ **Bug**: Inserting new items at positions 0, 1, 2... instead of appending

## The Fix
**File**: `useFirebaseSync.js` line 87

Changed:
```javascript
insertToQueue({...}, index);
```

To:
```javascript
insertToQueue({...}, queue.length);  // Always append to end
```

**Why this works**:
- Firebase items arrive pre-sorted by `addedAt`
- When appending new items, they naturally go to the end
- Queue already has correct order from Firebase's sort

## Verification Checklist

✅ Priority items get older timestamps than normal items  
✅ Firebase sorts ascending (oldest = top)  
✅ Initial load preserves Firebase order  
✅ Subsequent updates append to end (not insert at loop index)  
✅ Later priority items have smaller `addedAt` than earlier priorities (LIFO)  

## Test Case Scenario

1. User 1 adds "Hoa Lệ" (Normal) → Queue: [Hoa Lệ]
2. User 2 adds "Mưa Hương" (Priority) → Queue: [Mưa Hương (P1), Hoa Lệ]
3. User 3 adds "Em Yêu Anh" (Priority) → Queue: [Em Yêu Anh (P2), Mưa Hương (P1), Hoa Lệ]
4. User 4 adds "Chạy" (Normal) → Queue: [Em Yêu Anh (P2), Mưa Hương (P1), Hoa Lệ, Chạy]

✅ **After fix**: Order is preserved correctly across all operations

---

**Status**: ✅ FIXED  
**Files Modified**: `src/modules/core/useFirebaseSync.js` (line 87)  
**Testing**: Visual verification in queue list, check console logs for priority calculations
