# Brand Selection Vehicle Filter Integration

## Overview
This update implements a new brand selection workflow that integrates with the vehicle filter system. When a user clicks on a car brand from the header, they are taken to a drilldown page where they select their specific model and sub-model, which then automatically updates the vehicle filter and persists the selection.

## Changes Made

### 1. Header Component (`src/components/Header.tsx`)
- **Updated Brand Links**: Changed brand links from passing `brandId` and `brandName` to just `brandId`
  - Desktop: Line 788 - Changed href to `/parts?brandId=${encodeURIComponent(b.car_id)}`
  - Mobile: Line 854 - Updated mobile brand links similarly
- This simplifies the URL structure and ensures consistent ID-based navigation

### 2. New BrandDrilldown Component (`src/components/BrandDrilldown.tsx`)
- **Purpose**: Handles the brand → model → sub-model selection workflow
- **Features**:
  - Fetches models using `getModelsByBrandId(brandId)` API
  - Fetches sub-models using `getSubModelsByModelId(modelId)` API
  - Uses image path format: `uploads/cars/{image}` for vehicle images
  - Automatically persists selections to localStorage via `setPersistedVehicleFilter()`
  - Shows progress indicator (3-step: Brand → Model → Sub-Model)
  - Responsive grid layout with visual selection states
  - Displays year ranges for models/sub-models when available
  - Includes reset functionality to clear selections
  - Shows current selection summary

### 3. CarParts Page (`src/pages/CarParts.tsx`)
- **Added BrandDrilldown Import**: Line 13 - Imported the new component
- **Added Brand Drilldown State**: Lines 248-249
  - Added `brandIdParam` to capture the brand ID from URL
  - Added `inBrandDrillMode` flag to detect when brand drilldown is active
- **New Brand Drilldown Section**: Lines 1218-1308
  - Renders when `inBrandDrillMode` is true and no search query exists
  - Two-column layout (sidebar with vehicle filter + main content with drilldown)
  - Integrates with existing vehicle filter state
  - Shows filtered products once model is selected
  - Maintains manufacturer selector integration
  - Mobile-responsive with separate mobile layouts

## API Integration

### Endpoints Used
1. **`getAllBrands()`** - Gets all available car brands
2. **`getModelsByBrandId(brandId)`** - Gets models for a specific brand
   - Endpoint: `/getModelByBrandId?brand_id={brandId}`
3. **`getSubModelsByModelId(modelId)`** - Gets sub-models for a specific model
   - Endpoint: `/getSubModelByModelId?model_id={modelId}`

### Expected Response Format
Based on the example response provided, the API returns:
```json
{
  "result": [
    {
      "id": 363,
      "name": "Mercedes- Benz A-CLASS (W168)",
      "slug": "The Best or Nothing",
      "year": 2001,
      "year_2": 2004,
      "img_url": null,
      "car_id": "3a3bdaeb3fc6dfdfa83124eeef4afc31",
      "suitability": 1,
      "status": 1,
      "createdAt": "2023-10-30 12:37:02",
      "updatedAt": "2023-10-30 12:37:02"
    }
  ]
}
```

## Vehicle Filter Integration

### How It Works
1. When a user clicks a brand from the header, they navigate to `/parts?brandId={car_id}`
2. The `BrandDrilldown` component loads models for that brand
3. User selects a model → sub-models load
4. User selects a sub-model (optional)
5. At each step, the vehicle filter state is updated with:
   ```typescript
   {
     brandId: string,
     brandName: string,
     modelId?: string,
     modelName?: string,
     engineId?: string,  // sub-model ID
     engineName?: string  // sub-model name
   }
   ```
6. This state is:
   - Persisted to `localStorage` under key `gapa:veh-filter`
   - Passed to the `VehicleFilter` component for display
   - Used to filter products by vehicle compatibility

### Product Filtering
Once a vehicle is selected, products are filtered based on:
- The vehicle filter state matches against product compatibility data
- Manufacturer selection (if any)
- The filtering logic is already implemented in `CarParts.tsx` via `productMatchesVehicle()` function

## Image Path Handling
Vehicle images use the path format: `uploads/cars/{filename}`
- Fallback to logo if image not found
- Handles both absolute and relative paths
- Example: `uploads/cars/1698669644Benz.png`

## User Flow
1. User clicks "Mercedes-Benz" in header
2. Navigates to `/parts?brandId=3a3bdaeb3fc6dfdfa83124eeef4afc31`
3. Sees grid of Mercedes models (A-Class, C-Class, etc.)
4. Selects "A-Class (W169)"
5. Sees grid of sub-models with years (2004-2012, etc.)
6. Selects specific sub-model
7. Vehicle filter automatically updates and persists
8. Products are filtered to show only compatible parts
9. Selection remains active across page navigation

## Benefits
- ✅ Consistent with existing vehicle filter workflow
- ✅ Persistent vehicle selection across sessions
- ✅ Clean, intuitive UI with visual feedback
- ✅ Progressive enhancement (works without sub-model selection)
- ✅ Integrates seamlessly with manufacturer filtering
- ✅ Mobile-responsive design
- ✅ Proper error handling and loading states
