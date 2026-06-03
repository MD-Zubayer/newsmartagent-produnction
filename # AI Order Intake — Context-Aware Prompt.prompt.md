# AI Order Intake — Context-Aware Prompting & Database-Driven Resolution

## TL;DR
Your AI is treating **every** message as a potential order because order instructions are added to the system prompt unconditionally. Instead, it should:
1. Only add order context when conversation shows **actual order intent** + incomplete data
2. Look up product details (price, stock) from database, not manual regex extraction
3. Avoid asking the same field twice by tracking what's already been said
4. Create order immediately once complete — before AI attempts follow-ups

## Steps

### Phase 1: Intent-Based Gatekeeping (No more order prompts for casual chat)
1. Move order instruction context from `perform_rag_search()` (always applied) to conditional logic
   - Only inject `order_instr` into system prompt if:
     - Conversation contains order keywords (buy/order/price/etc) AND
     - Order fallback detection returns non-empty order data
   - File: `jwtauth/aiAgent/business_logic/logic_handler.py` — modify `perform_rag_search()` signature to accept `has_order_intent` flag
   - File: `jwtauth/webhooks/tasks.py` — pass detection result to `perform_rag_search()`

2. Strengthen order detection: Check if at least 2+ order fields already present before triggering AI order context
   - File: `jwtauth/webhooks/tasks.py` `_has_order_intent_in_conversation()` — add minimum field count check

### Phase 2: Database-Driven Product Lookup (No hardcoded extraction)
3. Create product lookup helper that queries product database
   - File: Create new function in `jwtauth/aiAgent/business_logic/logic_handler.py` — `lookup_product_from_db(product_name)` 
   - Returns: `{product_id, name, price, in_stock, available_quantity}`
   - Modified prompt: Include instruction to AI: "If customer names a product, search by that name. I'll provide the price and stock info from database."

4. Add context enhancement step after product name extraction
   - File: `jwtauth/webhooks/tasks.py` — in `build_ai_context()` or webhook logic, if product_name is detected, fetch DB product and inject actual price/stock into history  

### Phase 3: Memory-Aware Prompting (Never repeat questions)
5. Track conversation history explicitly in AI prompt
   - File: `jwtauth/aiAgent/business_logic/logic_handler.py` — modify order instruction template to include summary:
     ```
     "Here's what I know so far about this order:
     - Customer: {extracted_name}
     - Phone: {extracted_phone}
     - Product: {extracted_product}
     [... etc]
     Only ask for missing fields, never repeat."
     ```
   - Extract fields via `_merge_order_data_with_conversation()` earlier, pass as context

6. Strict field validation in prompt
   - File: `jwtauth/aiAgent/business_logic/logic_handler.py` `_default_direct_order_instructions()` — add:
     ```
     "CRITICAL: If all of these fields are present: customer_name, phone_number, address, product_name, quantity, price — 
     immediately return JSON with order_intent='create'. Do NOT ask any more questions."
     ```

### Phase 4: Early Fallback Trigger (Order before AI)
7. Reorder webhook task flow: Run order fallback BEFORE AI call
   - File: `jwtauth/webhooks/tasks.py` around line 1000 — move order fallback block earlier, check if complete
   - If complete → return confirmation, skip AI entirely ✓ (already partially done, but ensure it checks ALL fields including price plain-number fallback)
   - If incomplete → proceed to AI WITH order context only

8. Pass incomplete order data to AI as context
   - File: `jwtauth/webhooks/tasks.py` — pass `existing_order_fields` dict to `build_ai_context()` so AI **knows** what's already collected

## Relevant Files
- `jwtauth/aiAgent/business_logic/logic_handler.py` — `get_order_instructions()`, `_default_direct_order_instructions()`, `perform_rag_search()`, `build_ai_context()`
- `jwtauth/webhooks/tasks.py` — Order fallback block (line ~940), fallback detection functions, webhook task flow

## Verification Test Cases
1. **Unit test**: Send message "name: Ali, phone: 01234567890, address: Dhaka, product: Phone, qty: 1, 1200" → should auto-create order WITHOUT asking questions
2. **Unit test**: Send "Phone" alone → AI should ask what model/brand specifically, NOT ask for price (price from DB, not manual)
3. **Unit test**: Send "abc 123" (random) → AI should NOT ask for order details, respond normally
4. **Conversation test**: Full order flow — extract fields incrementally, confirm each matches conversation, no repeats
5. **Field retention**: Send "Ali" → AI confirms name. Next send "1234567890" → AI recognizes as phone (tracked in memory), asks for address only

## Key Decisions
- **Product lookup**: AI suggests → Backend validates against DB before creating order ✓
- **Order trigger**: Only when order keywords + 2+ fields already extracted (not every message)
- **Prompt scope**: Order instruction only in system prompt if order intent detected in CURRENT conversation
- **Price detection**: Include plain-number fallback only when OTHER order fields present (context check)

## Further Considerations
1. **Question**: Should we maintain a product catalog model in Django or query from N8N/external API?
   - **Recommendation**: Create lightweight `Product` model (name, price, stock), populate from merchant data
   
2. **Question**: What if customer typos product name? Should AI fuzzy-match or ask clarification?
   - **Recommendation**: AI should ask "Did you mean...?" before returning order, not hardcoding

## Implementation Order
1. Phase 1, Step 1-2: Add `has_order_intent` flag and gate order context
2. Phase 4, Step 7-8: Ensure early fallback triggers BEFORE AI (move detection earlier)
3. Phase 3, Step 5-6: Enhance prompt with field summary and validation
4. Phase 2, Step 3-4: Add product DB lookup (if product model exists)
5. Test each phase incrementally

## Notes
- User conversation context: 
  - Currently: Every message gets order instruction → AI treats all messages as potential orders → repeated questions
  - Expected: Order context only when actual order conversation detected → AI only asks missing fields → auto-create when complete
  - Key blocker: No database product model → prices/stock manually extracted via regex
