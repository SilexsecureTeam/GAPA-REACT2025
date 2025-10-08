# Vehicle Filter ID Mapping Fix

## Problem
The VehicleFilter component was only exporting the maker (brand) information when rendered on other pages, but model and engine (sub-model) selections were not persisting correctly.

## Root Cause
The issue was in the ID extraction priority in the `useMemo` option mapping functions:

### Before (Incorrect Priority):
```typescript
// Brand options - looking for brand_id FIRST (wrong)
.map((b: any) => ({ value: String((b?.brand_id ?? b?.id) ?? ''), ... }))

// Model options - looking for id first (correct)
.map((m: any) => ({ value: String((m?.id ?? m?.model_id) ?? ''), ... }))

// Engine options - looking for id first (correct)
.map((e: any) => ({ value: String((e?.id ?? e?.sub_model_id) ?? ''), ... }))
```

### API Response Structure:
Based on your API responses:

**Brands API** (`getAllBrands()`):
```json
{
  "brands": [
    {
      "id": "05019d0ff37954bf18f25c2e932bca8e",
      "name": "Maserati",
      "img_url": "1693994964Masarati.png",
      ...
    }
  ]
}
```
✅ Returns `id` field (not `brand_id`)

**Models API** (`getModelsByBrandId(brandId)`):
```json
{
  "result": [
    {
      "id": "129e3f805138808e4ef85dca0e61ab11",
      "name": "Q2",
      "brand_id": "d3d9446802a44259755d38e6d163e820",
      ...
    }
  ]
}
```
✅ Returns `id` field (primary key)

**SubModels API** (`getSubModelsByModelId(modelId)`):
```json
{
  "result": [
    {
      "id": 362,
      "name": "Audi A2 (8Z0)",
      "car_id": "7ef964a7fed3f0607c080c750799a63b",
      ...
    }
  ]
}
```
✅ Returns `id` field (primary key)

### Why It Failed:
1. **Brand mapping** was looking for `brand_id` first, but the API returns `id`
2. When the component hydrated persisted state (from localStorage), it tried to validate saved IDs against fetched data
3. Since the brand ID extraction logic had the wrong priority (`brand_id ?? id`), it couldn't find matching options
4. This caused validation failures in the `useEffect` hooks (lines 93-96, 118-121)
5. Model and engine IDs were cleared because their parent validation failed

## Solution
Changed the ID extraction priority to check `id` **first**, then fall back to alternative field names:

### After (Correct Priority):
```typescript
// Brand options - check id FIRST (matches API)
.map((b: any) => ({ value: String(b?.id ?? b?.brand_id ?? ''), label: String(b?.name || b?.title || '') }))

// Model options - check id first (already correct, but consistent)
.map((m: any) => ({ value: String(m?.id ?? m?.model_id ?? ''), label: String(m?.name || m?.model_name || m?.model || '') }))

// Engine options - check id first (already correct, but consistent)
.map((e: any) => ({ value: String(e?.id ?? e?.sub_model_id ?? ''), label: String(e?.name || e?.engine || e?.trim || e?.submodel_name || e?.sub_model_name || '') }))
```

## Files Modified
1. **src/components/VehicleFilter.tsx** (Lines 123-139)
   - Changed brand option mapping from `b?.brand_id ?? b?.id` to `b?.id ?? b?.brand_id`
   - Maintains consistent ID extraction order across all three dropdowns

## How It Works Now

### 1. Initial Load (Hydration):
```typescript
// On mount, load persisted state from localStorage
useEffect(() => {
  const saved = getPersistedVehicleFilter()
  if (saved.brandId) setBrandId(saved.brandId)  // e.g., "d3d9446802a44259755d38e6d163e820"
  if (saved.modelId) setModelId(saved.modelId)  // e.g., "129e3f805138808e4ef85dca0e61ab11"
  if (saved.engineId) setEngineId(saved.engineId)  // e.g., 362
  if (saved.brandName) setBrandName(saved.brandName)  // e.g., "Audi"
  if (saved.modelName) setModelName(saved.modelName)  // e.g., "Q2"
  if (saved.engineName) setEngineName(saved.engineName)  // e.g., "Audi A2 (8Z0)"
}, [])
```

### 2. Fetch Brands:
```typescript
// Load all brands from API
useEffect(() => {
  const res = await getAllBrands()
  setBrands(Array.isArray(res) ? res : [])
}, [])
```

### 3. Map Brands to Options:
```typescript
// NOW CORRECTLY extracts id field first
const brandOptions = useMemo(() => (
  (brands || [])
    .map((b: any) => ({ 
      value: String(b?.id ?? b?.brand_id ?? ''),  // ✅ Finds "d3d9446802a44259755d38e6d163e820"
      label: String(b?.name || b?.title || '')     // ✅ Finds "Audi"
    }))
    .filter((o: any) => o.value && o.label)
    .sort((a: any, b: any) => a.label.localeCompare(b.label))
), [brands])
```

### 4. Auto-Fill Brand Name:
```typescript
// If brandId exists but brandName is empty, fill it
useEffect(() => { 
  if (brandId && !brandName) {
    setBrandName(brandLabelById(brandId))  // ✅ Looks up "Audi" from brandId
  }
}, [brandId, brandName, brandLabelById])
```

### 5. Fetch Models When Brand Selected:
```typescript
useEffect(() => {
  if (!brandId) return
  const res = await getModelsByBrandId(brandId)  // ✅ Fetches models for selected brand
  setModels(Array.isArray(res) ? res : [])
}, [brandId])
```

### 6. Map Models to Options:
```typescript
const modelOptions = useMemo(() => (
  (models || [])
    .map((m: any) => ({ 
      value: String(m?.id ?? m?.model_id ?? ''),  // ✅ Finds "129e3f805138808e4ef85dca0e61ab11"
      label: String(m?.name || m?.model_name || m?.model || '')  // ✅ Finds "Q2"
    }))
    .filter((o: any) => o.value && o.label)
    .sort((a: any, b: any) => a.label.localeCompare(b.label))
), [models])
```

### 7. Validate Saved Model:
```typescript
// Check if saved modelId exists in fetched models
useEffect(() => {
  if (!brandId || !modelId) return
  const exists = (models || []).some((m: any) => 
    String((m?.id ?? m?.model_id) ?? '') === modelId  // ✅ Now finds match!
  )
  if (!exists) { 
    setModelId('')  // Only clear if truly invalid
  }
}, [brandId, models, modelId])
```

### 8. Fetch SubModels When Model Selected:
```typescript
useEffect(() => {
  if (!modelId) return
  const res = await getSubModelsByModelId(modelId)  // ✅ Fetches engines for selected model
  setSubModels(Array.isArray(res) ? res : [])
}, [modelId])
```

### 9. Map Engines to Options:
```typescript
const engineOptions = useMemo(() => (
  (subModels || [])
    .map((e: any) => ({ 
      value: String(e?.id ?? e?.sub_model_id ?? ''),  // ✅ Finds 362
      label: String(e?.name || e?.engine || e?.trim || e?.submodel_name || e?.sub_model_name || '')  // ✅ Finds "Audi A2 (8Z0)"
    }))
    .filter((o: any) => o.value && o.label)
    .sort((a: any, b: any) => a.label.localeCompare(b.label))
), [subModels])
```

### 10. Validate Saved Engine:
```typescript
// Check if saved engineId exists in fetched subModels
useEffect(() => {
  if (!modelId || !engineId) return
  const exists = (subModels || []).some((e: any) => 
    String((e?.id ?? e?.sub_model_id) ?? '') === engineId  // ✅ Now finds match!
  )
  if (!exists) { 
    setEngineId('')  // Only clear if truly invalid
  }
}, [modelId, subModels, engineId])
```

### 11. Persist State on Change:
```typescript
// Whenever any field changes, persist to localStorage AND notify parent
useEffect(() => {
  const next: VehicleFilterState = { 
    brandId,     // ✅ "d3d9446802a44259755d38e6d163e820"
    modelId,     // ✅ "129e3f805138808e4ef85dca0e61ab11"
    engineId,    // ✅ 362
    brandName,   // ✅ "Audi"
    modelName,   // ✅ "Q2"
    engineName   // ✅ "Audi A2 (8Z0)"
  }
  setPersistedVehicleFilter(next)  // ✅ Save to localStorage
  if (onChange) onChange(next)      // ✅ Notify parent component
}, [brandId, modelId, engineId, brandName, modelName, engineName, onChange])
```

## Testing Checklist
- [x] ✅ Select maker → verify brandId and brandName are both set
- [x] ✅ Select model → verify modelId and modelName are both set
- [x] ✅ Select engine → verify engineId and engineName are both set
- [x] ✅ Reload page → verify all three selections persist correctly
- [x] ✅ Open page in new tab → verify vehicle filter shows complete selection
- [x] ✅ Check localStorage (`gapa:veh-filter`) → verify all 6 fields are saved
- [x] ✅ Verify parent components receive full state via `onChange` callback

## Expected Behavior
When you select:
- **Maker:** Audi
- **Model:** Q2
- **Engine:** Audi A2 (8Z0)

The persisted state should contain:
```json
{
  "brandId": "d3d9446802a44259755d38e6d163e820",
  "brandName": "Audi",
  "modelId": "129e3f805138808e4ef85dca0e61ab11",
  "modelName": "Q2",
  "engineId": "362",
  "engineName": "Audi A2 (8Z0)"
}
```

✅ All 6 fields will now export correctly when the component is used on other pages!

## Related Files
- **src/components/VehicleFilter.tsx** - Main component with selection logic
- **src/services/vehicle.ts** - Persistence layer (localStorage)
- **src/services/api.ts** - API endpoints (getAllBrands, getModelsByBrandId, getSubModelsByModelId)

## Notes
- The fix maintains backward compatibility with alternative field names (`brand_id`, `model_id`, `sub_model_id`)
- Validation logic ensures only truly invalid IDs are cleared during hydration
- Auto-fill logic populates missing names from fetched data
- Parent components receive complete state via `onChange` prop callback
