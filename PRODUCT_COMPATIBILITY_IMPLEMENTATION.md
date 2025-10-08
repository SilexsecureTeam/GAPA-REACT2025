# Product Compatibility Implementation - Brand Selection

## Overview
After a user selects their vehicle (brand, model, and optionally sub-model), compatible products automatically load and display based on the vehicle compatibility data stored in each product.

## How Product Compatibility Works

### 1. Vehicle Filter State
When a user selects their vehicle through the BrandDrilldown component, the following state is created and persisted:

```typescript
{
  brandId: string,        // e.g., "3a3bdaeb3fc6dfdfa83124eeef4afc31"
  brandName: string,      // e.g., "Mercedes-Benz"
  modelId: string,        // e.g., "365"
  modelName: string,      // e.g., "A-Class (W169)"
  engineId?: string,      // e.g., "890" (sub-model ID, optional)
  engineName?: string     // e.g., "2.0 CDI (2004-2012)" (optional)
}
```

This state is:
- Stored in `localStorage` under key `gapa:veh-filter`
- Used globally across the application
- Automatically applied to filter products

### 2. Product Compatibility Data Structure
Each product contains compatibility information in various fields:

```typescript
{
  compatibility: string | array,
  vehicle_compatibility: string | array,
  compatibilities: string | array,
  fitment: string | array,
  fitments: string | array
}
```

**Example compatibility values:**
- `"Mercedes-Benz A-Class (W169) 2.0 CDI 2004-2012"`
- `"Mercedes-Benz C-Class, E-Class, S-Class"`
- `"Universal"` (matches all vehicles)
- `"All vehicles"` (matches all vehicles)

### 3. Matching Algorithm
The matching is handled by the `vehicleMatches()` function in `src/services/vehicle.ts`:

```typescript
export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandName = '', modelName = '', engineName = '' } = state || {}
  
  // Extract compatibility text from product
  const text = String(compatibility).toLowerCase()
  
  // Universal compatibility matches everything
  if (text.includes('universal') || text.includes('all vehicles')) return true
  
  // Match each selected field
  const brandMatches = brandName ? text.includes(brandName.toLowerCase()) : true
  const modelMatches = modelName ? text.includes(modelName.toLowerCase()) : true
  const engineMatches = engineName ? includesWhole(text, engineName.toLowerCase()) : true
  
  // All provided fields must match
  return brandMatches && modelMatches && engineMatches
}
```

### 4. Product Display Logic

#### In Brand Drilldown Mode (`/parts?brandId=xxx`)

**Products appear when:**
- ✅ Brand is selected
- ✅ Model is selected
- ⚠️ Sub-model is optional

**Filtering applied:**
```typescript
// CarParts.tsx line ~670+
const filtered = useMemo(() => {
  let list = products
  
  // Apply vehicle filter if active
  if (hasVehicleFilter) {
    list = list.filter(productMatchesVehicle)
  }
  
  // Apply manufacturer filter if selected
  if (selectedManufacturerId) {
    list = list.filter((p) => makerIdOf(p) === selectedManufacturerId)
  }
  
  return list
}, [products, hasVehicleFilter, vehFilter, selectedManufacturerId])
```

### 5. User Experience Flow

#### Step 1: Brand Selection
```
User clicks "Mercedes-Benz" → /parts?brandId=3a3bdaeb...
```

#### Step 2: Model Selection
```
User selects "A-Class (W169)"
↓
Vehicle Filter State Updated:
{
  brandId: "3a3bdaeb...",
  brandName: "Mercedes-Benz",
  modelId: "365",
  modelName: "A-Class (W169)"
}
↓
Products are filtered and displayed automatically
```

#### Step 3: Sub-Model Selection (Optional)
```
User selects "2.0 CDI (2004-2012)"
↓
Vehicle Filter State Updated:
{
  brandId: "3a3bdaeb...",
  brandName: "Mercedes-Benz",
  modelId: "365",
  modelName: "A-Class (W169)",
  engineId: "890",
  engineName: "2.0 CDI (2004-2012)"
}
↓
Products are re-filtered with more specific criteria
↓
Fewer, more targeted products are shown
```

### 6. Visual Feedback

**After model selection:**
- ✅ Green success card shows selected vehicle
- 📦 Products grid appears below
- 🔢 Count badge shows number of compatible parts
- 📜 Auto-scroll to products section
- ℹ️ "Compatible parts are displayed below" message

**If no products found:**
- 😢 Empty state with helpful message
- 💡 Suggestion to try without sub-model filter (if applicable)
- 🔧 Option to adjust manufacturer filter

### 7. Example Product Compatibility Matching

**Product A:**
```json
{
  "name": "Brake Pad Set",
  "compatibility": "Mercedes-Benz A-Class (W169) 2004-2012"
}
```

**Matches:**
- ✅ Mercedes-Benz + A-Class (W169)
- ✅ Mercedes-Benz + A-Class (W169) + 2.0 CDI
- ❌ BMW + 3 Series

**Product B:**
```json
{
  "name": "Air Filter",
  "compatibility": "Universal"
}
```

**Matches:**
- ✅ All vehicles (always shown)

**Product C:**
```json
{
  "name": "Oil Filter",
  "compatibility": "Mercedes-Benz C-Class, E-Class, S-Class 2000-2010"
}
```

**Matches:**
- ❌ Mercedes-Benz + A-Class (W169) (wrong model)
- ✅ Mercedes-Benz + C-Class

### 8. Performance Optimizations

1. **Memoization**: Product filtering uses `useMemo` to prevent unnecessary recalculations
2. **Lazy Loading**: Products load only after vehicle selection
3. **Indexed Lookups**: Fast brand/model matching using string operations
4. **Progressive Loading**: Model selection immediately shows products; sub-model refines results

### 9. Category Exceptions

Some product categories don't require vehicle compatibility:
- Car Care (category ID: 3)
- Accessories (category ID: 4)
- Tools (category ID: 7)

These products are shown regardless of vehicle filter state.

### 10. Manufacturer Filter Integration

The vehicle filter works alongside the manufacturer filter:
```typescript
// Both filters are applied together
const filtered = products
  .filter(productMatchesVehicle)      // Vehicle compatibility
  .filter(matchesManufacturer)         // Manufacturer match
```

Users can:
- Select a vehicle (Mercedes A-Class)
- Then filter by manufacturer (e.g., Bosch, STARK)
- See only products that match BOTH criteria

## Testing Scenarios

### Scenario 1: Basic Selection
1. Click "Mercedes-Benz" in header
2. Select "A-Class (W169)"
3. ✅ See all products compatible with Mercedes A-Class

### Scenario 2: Refined Selection
1. Click "Mercedes-Benz" in header
2. Select "A-Class (W169)"
3. Select "2.0 CDI (2004-2012)"
4. ✅ See fewer, more specific products

### Scenario 3: No Results
1. Select rare vehicle combination
2. ✅ See helpful empty state
3. ✅ Option to broaden search

### Scenario 4: Universal Products
1. Select any vehicle
2. ✅ Universal products always appear
3. ✅ Vehicle-specific products also appear

### Scenario 5: Persistence
1. Select vehicle
2. Navigate to another page
3. Return to /parts
4. ✅ Vehicle filter still applied
5. ✅ Products still filtered

## Code Locations

- **Compatibility Matching**: `src/services/vehicle.ts` - `vehicleMatches()`
- **Product Filtering**: `src/pages/CarParts.tsx` - `filtered` useMemo
- **Brand Drilldown UI**: `src/components/BrandDrilldown.tsx`
- **Brand Drilldown Page**: `src/pages/CarParts.tsx` - Brand drill mode section
- **State Persistence**: `src/services/vehicle.ts` - `setPersistedVehicleFilter()`
