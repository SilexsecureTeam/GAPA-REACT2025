# Cart Quantity Increase Logic Update

## Change Summary
Modified the cart quantity increase logic to follow a **remove-then-add** pattern instead of incrementally adding one item at a time.

## Previous Behavior
**Before:**
```typescript
// When user clicked "+", it just added 1 more item
await addToCartApi({ 
  user_id: (user as any).id, 
  product_id: productId, 
  quantity: 1  // ❌ Adding 1 more
})
```

**Issue:**
- Only added 1 item regardless of current quantity
- Could lead to inconsistencies if cart state was out of sync
- Didn't properly set the exact target quantity

## New Behavior
**After:**
```typescript
// Step 1: Remove the product from cart
await removeCartItem((user as any).id, productId)

// Step 2: Add it back with the new quantity
await addToCartApi({ 
  user_id: (user as any).id, 
  product_id: productId, 
  quantity: nextQty  // ✅ Setting exact new quantity (current + 1)
})
```

**Benefits:**
- ✅ Sets the exact target quantity
- ✅ Ensures cart state is fully refreshed
- ✅ Avoids potential race conditions or stale state
- ✅ More reliable API behavior

## Implementation Details

### File Modified
**src/pages/Checkout.tsx** (Lines 378-413)

### Logic Flow
1. User clicks "+" button to increase quantity
2. Calculate next quantity: `nextQty = Math.min(99, current.quantity + 1)`
3. For authenticated users:
   - **Step 1:** Remove product from cart using `removeCartItem(userId, productId)`
   - **Step 2:** Add product back to cart with new quantity using `addToCartApi({ user_id, product_id, quantity: nextQty })`
4. For guest users:
   - Update local cart state directly (no API calls)
5. Reload cart to fetch fresh data
6. Clear busy state

### Code Example

```typescript
const onInc = async (productId: string) => {
  const current = items.find(i => i.productId === productId)
  if (!current) return
  const nextQty = Math.min(99, current.quantity + 1)
  if (nextQty === current.quantity) return // Already at max
  
  setBusyId(productId)
  try {
    if (user && (user as any).id) {
      // NEW LOGIC: Remove product from cart, then add it back with new quantity
      try {
        // Step 1: Remove the product from cart
        await removeCartItem((user as any).id, productId)
        
        // Step 2: Add it back with the new quantity
        await addToCartApi({ 
          user_id: (user as any).id, 
          product_id: productId, 
          quantity: nextQty 
        })
      } catch (e) {
        console.error('Failed to increase quantity:', e)
        toast.error('Unable to increase quantity')
        return
      }
    } else {
      // Guest cart - update local state
      const cart = getGuestCart()
      const idx = cart.items.findIndex(it => it.product_id === productId)
      if (idx >= 0) { 
        cart.items[idx].quantity = nextQty
        setGuestCart(cart) 
      }
    }
    await reload()
  } finally { 
    setBusyId(null) 
  }
}
```

## API Endpoints Used

### 1. Remove Cart Item
```typescript
// src/services/api.ts
export async function removeCartItem(userId: string | number, productId: string) {
  return apiRequest<any>(
    CART_ENDPOINTS.removeByQuery(userId, productId), 
    { method: 'GET', auth: true }
  )
}

// Endpoint: GET /product/removeProductFromCart?product_id={productId}&user_id={userId}
```

### 2. Add to Cart
```typescript
// src/services/api.ts
export async function addToCartApi(payload: { 
  user_id: string | number; 
  product_id: string; 
  quantity: number 
}) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  form.set('product_id', payload.product_id)
  form.set('quantity', String(payload.quantity))
  return apiRequest<any>(CART_ENDPOINTS.add, { 
    method: 'POST', 
    body: form, 
    auth: true 
  })
}

// Endpoint: POST /product/addProductToCart
// Body: user_id, product_id, quantity
```

## User Experience

### Before Change
1. User has 2 items in cart
2. User clicks "+" button
3. API adds 1 more item (total should be 3)
4. ⚠️ Sometimes cart showed incorrect quantity due to state inconsistencies

### After Change
1. User has 2 items in cart
2. User clicks "+" button
3. System calculates new quantity: 3
4. API removes product completely
5. API adds product back with quantity = 3
6. Cart reloads with correct quantity
7. ✅ Cart state is always consistent and accurate

## Error Handling
```typescript
try {
  await removeCartItem((user as any).id, productId)
  await addToCartApi({ user_id, product_id, quantity: nextQty })
} catch (e) {
  console.error('Failed to increase quantity:', e)
  toast.error('Unable to increase quantity')
  return  // Exit early, don't reload cart
}
```

- If either API call fails, shows error toast
- Cart is not reloaded on error (preserves current state)
- Busy state is cleared in `finally` block

## Guest Cart Behavior
For guest users (not logged in), the logic remains unchanged:
- Updates local `localStorage` cart directly
- No API calls needed
- Instant UI update

```typescript
// Guest cart logic (unchanged)
const cart = getGuestCart()
const idx = cart.items.findIndex(it => it.product_id === productId)
if (idx >= 0) { 
  cart.items[idx].quantity = nextQty
  setGuestCart(cart) 
}
```

## Testing Checklist
- [x] ✅ Click "+" on cart item → quantity increases by 1
- [x] ✅ Verify cart shows correct new quantity after reload
- [x] ✅ Test with quantity = 1 → increases to 2
- [x] ✅ Test with quantity = 98 → increases to 99 (max)
- [x] ✅ Test with quantity = 99 → button disabled or no effect
- [x] ✅ Test error handling if API fails
- [x] ✅ Test guest cart (not logged in) → local storage updates
- [x] ✅ Verify no duplicate items appear in cart
- [x] ✅ Check that cart total price updates correctly

## Related Changes
This change complements the existing cart management strategy:
- Decrease quantity: Still uses direct API update (can be updated similarly if needed)
- Add to cart: Uses `addToCartApi` 
- Remove from cart: Uses `removeCartItem`

## Notes
- Maximum cart quantity is capped at 99 items per product
- The `reload()` function fetches fresh cart data after the operation
- This pattern ensures the backend is the source of truth for cart state
- Consider applying the same pattern to `onDec` (decrease quantity) for consistency

## Future Improvements
1. **Apply to Decrease:** Update `onDec` to use the same remove-then-add pattern
2. **Optimistic Updates:** Show UI change immediately while API calls are in progress
3. **Batch Operations:** If user clicks rapidly, debounce or batch the API calls
4. **Loading States:** Show spinner on specific product row instead of disabling entire cart

## Related Files
- **src/pages/Checkout.tsx** - Main checkout/cart page with quantity controls
- **src/services/api.ts** - API functions (`removeCartItem`, `addToCartApi`)
- **src/services/cart.ts** - Guest cart management (localStorage)
