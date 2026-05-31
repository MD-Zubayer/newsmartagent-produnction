# Order Fallback Regression Test Suite - Execution Guide

## File Location
```
jwtauth/tests_order_fallback.py
```

## Test Class
```python
OrderFallbackRegressionTests (6 comprehensive tests)
```

## How to Run Tests

### Option 1: Using Django Test Runner (Recommended)
```bash
cd /home/md-zubayer/newsmartagent/production

# Activate virtual environment (if not already active)
source .venv/bin/activate

# Run all order fallback tests
cd jwtauth
python manage.py test tests_order_fallback.OrderFallbackRegressionTests -v 2

# Or run specific test
python manage.py test tests_order_fallback.OrderFallbackRegressionTests.test_1_rejection_rollback_and_editing_state -v 2
```

### Option 2: Direct Python Execution
```bash
cd /home/md-zubayer/newsmartagent/production/jwtauth
python tests_order_fallback.py
```

---

## Test Suite Breakdown

### TEST 1: Slide-Back & Rollback (Editing State)
**Method:** `test_1_rejection_rollback_and_editing_state()`

**Scenario:**
- Customer provides: name, phone, address (complete order)
- System shows confirmation summary
- Customer rejects: "না, নাম্বারটি ভুল। নতুনটি ০১৭১২৩৪৫৬৭৮"

**What It Tests:**
1. `_is_rejection_text()` correctly detects rejection keywords ("না", "ভুল")
2. `_get_rejected_fields()` identifies which fields are rejected
3. `_clear_rejected_order_fields()` removes rejected field from memory
4. `_set_order_state()` transitions from 'awaiting_confirmation' to 'editing'
5. Memory state is persisted correctly after rollback

**Expected Result:** ✅ 
- Phone field is cleared from memory
- Order state becomes 'editing'
- System ready to re-collect phone number

---

### TEST 2: Interruption Detection & Resume Prompt
**Method:** `test_2_interruption_detection_and_resume_prompt()`

**Scenario:**
- Order collecting is in progress (3 of 6 fields provided)
- Customer asks: "আপনাদের অফিস কি কাল খোলা থাকবে?"
- System detects this is NOT an order question

**What It Tests:**
1. `_is_order_interruption()` detects non-order questions while `order_state='ordering'`
2. `_set_interruption_buffer()` saves which field was being collected
3. `_get_interruption_resume_prompt()` generates proper resume message

**Expected Result:** ✅
- Interruption is detected (contains question words but no order keywords)
- Buffer stores suspended field info
- Resume prompt contains: "আবার ফিরে আসছি..." + field name to collect

---

### TEST 3: 3-Strike Escalation & Human Handover
**Method:** `test_3_three_strike_escalation_trigger()`

**Scenario:**
- Customer submits invalid phone format 3 times
- System should escalate to human

**What It Tests:**
1. `_increment_field_failure()` tracks attempts per field (strike_context = min(count, 3))
2. `_get_first_escalation_field()` identifies fields that hit 3 strikes
3. `_mark_field_escalated()` prevents duplicate escalation
4. `_trigger_order_fallback_escalation()` executes:
   - Sets `contact.is_human_needed = True`
   - Creates dashboard `Notification` with type 'order_fallback_alert'
   - Sets `order_state = 'human_fallback'`
5. Fallback email is dispatched (mocked in test)

**Expected Result:** ✅
- strike_context reaches 3 after 3 failures
- Contact is flagged for human intervention
- Notification appears in dashboard
- Order state transitions to 'human_fallback'

---

### TEST 4: Deterministic Phone & Quantity Validation
**Method:** `test_4_deterministic_field_validation()`

**Scenario:**
- Customer provides: "আমি ৫টা নিতে চাই, নাম্বার: ০১৭-১২৩৪-৫৬৭৮"
- System must clean/validate before storing in memory

**What It Tests:**
1. `validate_phone_number_bd()` regex validation:
   - ✅ Accepts: `01712345678` (clean 11-digit)
   - ✅ Accepts: `017 1234 5678` (with spaces)
   - ✅ Accepts: `+880171234567` (with country code)
   - ❌ Rejects: `123456` (too short)
   - ❌ Rejects: `-5` (negative)

2. `validate_quantity()` regex validation:
   - ✅ Accepts: `5` (positive int)
   - ❌ Rejects: `0` (zero)
   - ❌ Rejects: `abc` (non-numeric)

3. Validation is applied BEFORE storing to memory via `extract_order_data_from_text()`

**Expected Result:** ✅
- Invalid formats are rejected
- Valid formats are normalized (hyphens removed, spaces trimmed)
- Phone stored as: `01712345678` (clean format)

---

### TEST 5: Validation Failure Increments Strike
**Method:** `test_5_validation_failure_increments_strike()`

**Scenario:**
- Extract order data from text with invalid phone
- Failed validation should increment strike counter automatically

**What It Tests:**
1. `extract_order_data_from_text()` with `user_memory` parameter calls `validate_*()` functions
2. On validation failure, `_increment_field_failure()` is called
3. Strike counter increments: 1 → 2 → 3
4. Failed field is NOT added to memory (only valid fields stored)

**Expected Result:** ✅
- After 3 invalid attempts, strike_context reaches 3
- Phone not stored in memory (validation failed)
- System ready to escalate on next query

---

### TEST 6: Complete Order Flow (Integration)
**Method:** `test_6_complete_order_confirmation_with_interruption_resume()`

**Scenario:**
- Full order collection: all 6 fields provided
- `_queue_order_for_confirmation()` is called
- System returns confirmation prompt

**What It Tests:**
1. `_save_order_fields_to_memory()` stores all fields with confidence metadata
2. `_has_complete_order_fields()` verifies all required fields present
3. `_queue_order_for_confirmation()`:
   - Clears any active interruption buffer
   - Generates confirmation prompt
   - Sets `order_state = 'awaiting_confirmation'`
4. Interruption buffer cleanup on order completion

**Expected Result:** ✅
- All fields saved to memory with metadata (confidence, source, timestamp)
- Order state is 'awaiting_confirmation'
- Confirmation prompt shows all field values
- Ready for final CONFIRM_ORDER action

---

## Test Dependencies & Fixtures

Each test uses:
- **User:** `test_merchant` (email: merchant@test.com)
- **Agent:** `Test Agent` (WhatsApp, gemini-pro model)
- **Contact:** `Test Sender` (sender_id: test_sender_001)

Tests are isolated; `tearDown()` cleans up UserMemory and Notifications after each test.

---

## Expected Test Output (All Passing)

```
test_1_rejection_rollback_and_editing_state (jwtauth.tests_order_fallback.OrderFallbackRegressionTests) ... ✅ TEST 1 PASSED: Rejection rollback and editing state working correctly.
ok
test_2_interruption_detection_and_resume_prompt (jwtauth.tests_order_fallback.OrderFallbackRegressionTests) ... ✅ TEST 2 PASSED: Interruption detection and resume prompt working correctly.
ok
test_3_three_strike_escalation_trigger (jwtauth.tests_order_fallback.OrderFallbackRegressionTests) ... ✅ TEST 3 PASSED: 3-Strike escalation and human handover working correctly.
ok
test_4_deterministic_field_validation (jwtauth.tests_order_fallback.OrderFallbackRegressionTests) ... ✅ TEST 4 PASSED: Deterministic field validation working correctly.
ok
test_5_validation_failure_increments_strike (jwtauth.tests_order_fallback.OrderFallbackRegressionTests) ... ✅ TEST 5 PASSED: Validation failure correctly increments strike counter.
ok
test_6_complete_order_confirmation_with_interruption_resume (jwtauth.tests_order_fallback.OrderFallbackRegressionTests) ... ✅ TEST 6 PASSED: Complete order flow with confirmation working correctly.
ok

======================================================================
Ran 6 tests in X.XXXs
🎉 ALL TESTS PASSED! Enhanced order fallback system is ready for production.
```

---

## Troubleshooting

### Django Not Found
```bash
# Ensure venv is activated
cd /home/md-zubayer/newsmartagent/production
source .venv/bin/activate

# Install dependencies (if needed)
pip install django celery redis requests
```

### Database Issues
```bash
# Run migrations first
cd jwtauth
python manage.py migrate
```

### Specific Test Failure
```bash
# Run individual test with detailed output
python manage.py test tests_order_fallback.OrderFallbackRegressionTests.test_3_three_strike_escalation_trigger -v 3
```

---

## Coverage Summary

✅ **Core Features Tested:**
- Rejection detection & field rollback
- Interruption buffering & resume prompts
- 3-strike escalation workflow
- Phone/quantity/price validation (regex + type-casting)
- Strike counter auto-increment on validation failure
- Complete end-to-end order flow

✅ **Integration Points Verified:**
- UserMemory state transitions
- Contact.is_human_needed flag
- Dashboard Notification creation
- Field metadata (confidence, source, timestamp)

✅ **Edge Cases Covered:**
- Multiple rejection keywords
- Validation with normalization (spaces, hyphens)
- Parallel field failures
- Interruption cleanup on resume

---

## Next Steps

1. **Run tests in staging environment** to confirm all fixtures work
2. **Monitor real order submissions** for any edge cases not covered
3. **Gather user feedback** on rejection detection accuracy
4. **Adjust prompts** based on actual conversation patterns
5. **Scale validation patterns** as new field types are added

