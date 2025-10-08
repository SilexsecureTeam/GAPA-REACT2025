# Brand Selection Flow - Quick Reference

## User Journey
```
Header Brand Click
        ↓
/parts?brandId=xxx
        ↓
┌─────────────────────────────────────────────┐
│  BrandDrilldown Component                   │
│                                             │
│  Step 1: Select Model                       │
│  [Mercedes A-Class] [C-Class] [E-Class]    │
│         ↓ (user selects)                    │
│                                             │
│  Step 2: Select Sub-Model                   │
│  [W168 (2001-2004)] [W169 (2004-2012)]    │
│         ↓ (user selects)                    │
│                                             │
│  ✓ Vehicle Filter Updated & Persisted       │
└─────────────────────────────────────────────┘
        ↓
Products Filtered by Vehicle Compatibility
```

## Component Architecture
```
Header.tsx
  ├─ Brand Click → /parts?brandId={car_id}
  └─ (Desktop & Mobile menus updated)

CarParts.tsx
  ├─ Detects: inBrandDrillMode = !!brandIdParam
  ├─ Renders: BrandDrilldown Component
  └─ Integrates: VehicleFilter state

BrandDrilldown.tsx
  ├─ Fetches: Models → Sub-Models
  ├─ Updates: VehicleFilterState
  ├─ Persists: localStorage
  └─ Notifies: Parent via onComplete()

VehicleFilter.tsx
  └─ Displays: Current selection
```

## Data Flow
```
1. API Calls
   getAllBrands() → Brand list
   getModelsByBrandId(brandId) → Models
   getSubModelsByModelId(modelId) → Sub-Models

2. State Management
   BrandDrilldown → VehicleFilterState
                 → localStorage (gapa:veh-filter)
                 → CarParts filtered products

3. URL Parameters
   /parts?brandId=xxx → Brand drill mode
   (existing params still work: catId, subCatId, etc.)
```

## Key Features
- ✅ Progressive selection (brand → model → sub-model)
- ✅ Visual feedback (progress dots, selection highlights)
- ✅ Image support (uploads/cars/{filename})
- ✅ Year range display
- ✅ Reset functionality
- ✅ LocalStorage persistence
- ✅ Mobile responsive
- ✅ Integrates with existing manufacturer filter

## Testing Checklist
- [ ] Click brand from header (desktop)
- [ ] Click brand from header (mobile)
- [ ] Select a model
- [ ] Select a sub-model
- [ ] Verify vehicle filter updates
- [ ] Check localStorage persistence
- [ ] Verify products are filtered
- [ ] Test with manufacturer filter
- [ ] Test reset functionality
- [ ] Test with missing images
- [ ] Test navigation (back/forward)
- [ ] Test mobile layout
