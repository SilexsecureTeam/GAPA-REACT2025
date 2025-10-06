# Vehicle Brand Drill-Down Feature

## Overview
Implemented a hierarchical vehicle brand drill-down feature that allows users to browse car parts by selecting a vehicle brand from the header, then drilling down through models and engines to find compatible parts.

## User Flow

### 1. Click Brand from Header
- User clicks a car brand (e.g., "Toyota") in the header/navigation
- System navigates to `/parts?vehicleBrand=Toyota`

### 2. Select Model
- CarParts page displays all available models for that brand
- Models are extracted from product compatibility data
- User clicks a model (e.g., "Camry")
- URL updates to `/parts?vehicleBrand=Toyota&vehicleModel=Camry`

### 3. Select Engine/Sub-model
- Page displays available engines for that brand+model combination
- Engines are extracted from compatibility strings (e.g., "2.5L", "V6", "1.8 TFSI")
- User clicks an engine (e.g., "2.5L")
- URL updates to `/parts?vehicleBrand=Toyota&vehicleModel=Camry&vehicleEngine=2.5L`

### 4. View Compatible Products
- Page displays all products compatible with the selected vehicle
- **Only filters products from Car Parts (category 1) and Car Electricals (category 2)**
- Products are matched against their compatibility data
- Works alongside manufacturer filter and regular vehicle filter

## Technical Implementation

### URL Parameters
```typescript
vehicleBrand: string    // e.g., "Toyota"
vehicleModel: string    // e.g., "Camry"
vehicleEngine: string   // e.g., "2.5L"
```

### State Management
```typescript
const [activeVehicleBrand, setActiveVehicleBrand] = useState<string>('')
const [activeVehicleModel, setActiveVehicleModel] = useState<string>('')
const [activeVehicleEngine, setActiveVehicleEngine] = useState<string>('')
const [vehicleModels, setVehicleModels] = useState<string[]>([])
const [vehicleEngines, setVehicleEngines] = useState<string[]>([])
```

### Data Extraction Logic

#### Models Extraction
- Fetches all products
- Parses compatibility fields for mentions of the selected brand
- Extracts model names using regex pattern matching
- Returns unique sorted list of models

#### Engines Extraction
- Fetches all products
- Filters compatibility data for selected brand + model
- Extracts engine specs using patterns like:
  - `2.5L`, `1.8L` (displacement with L)
  - `V6`, `V8` (cylinder configuration)
  - `1.8 TFSI` (displacement with engine code)
- Returns unique sorted list of engines

### Product Filtering

#### Category Restriction
```typescript
const cid = categoryIdOf(p)
// Only apply to Car Parts (1) and Car Electricals (2)
if (cid !== '1' && cid !== '2') return false
```

#### Compatibility Matching
```typescript
// Match all three: brand + model + engine
const brandMatch = lowerStr.includes(activeVehicleBrand.toLowerCase())
const modelMatch = lowerStr.includes(activeVehicleModel.toLowerCase())
const engineMatch = lowerStr.includes(activeVehicleEngine.toLowerCase())

if (brandMatch && modelMatch && engineMatch) return true
```

### Integration with Existing Filters

The vehicle brand drill-down works **alongside** existing filters:

1. **Vehicle Brand Drill-down** (from header) - filters Car Parts & Car Electricals only
2. **Regular Vehicle Filter** (VehicleSelector) - filters all applicable categories
3. **Manufacturer Filter** - filters by part manufacturer
4. **Category Drill-down** - filters by category hierarchy

All filters are applied sequentially in the `filtered` useMemo.

## UI Components

### Breadcrumb Navigation
```
Parts Catalogue › Toyota › Camry › 2.5L
```
- Clickable breadcrumbs allow going back to previous levels
- Clicking "Toyota" resets model and engine
- Clicking "Camry" resets only engine

### Model Selection Pills
- Grid layout of rounded pill buttons
- Hover effect with brand color
- Responsive: 2-6 columns based on screen size

### Engine Selection Pills
- Same styling as model pills
- Displays engine specifications clearly

### Product Grid
- Uses existing `ProductActionCard` component
- Includes "View" and "Add to Cart" actions
- Shows manufacturer selector above products
- Displays loading states during fetch

## API Compatibility

### No New Endpoints Required
Uses existing data structures:
- `getAllProducts()` - for extracting models/engines and filtering
- Product compatibility fields:
  - `compatibility`
  - `vehicle_compatibility`
  - `vehicleCompatibility`
  - `fitment`

### Data Parsing
Compatibility data can be:
- String: `"Toyota Camry 2.5L 2015-2020"`
- Array: `["Toyota Camry", "Toyota Corolla"]`
- Object: `{ brand: "Toyota", model: "Camry", engine: "2.5L" }`

Parser handles all formats automatically.

## Benefits

1. **Intuitive Navigation** - Natural flow from brand → model → engine
2. **No API Changes** - Works with existing product data
3. **Performance** - Loads only once, extracts on client
4. **Flexible** - Works alongside other filtering methods
5. **Focused Results** - Only shows Car Parts & Car Electricals (most relevant categories)
6. **Breadcrumb Navigation** - Easy to navigate back/forward
7. **Responsive Design** - Works on mobile and desktop

## Example Usage

### User Journey
1. User sees "Browse by Brand" in header with brands like Toyota, Honda, Mercedes
2. Clicks "Toyota"
3. Sees models: Camry, Corolla, RAV4, Highlander, etc.
4. Clicks "Camry"
5. Sees engines: 2.5L, 3.5L V6, Hybrid 2.5L
6. Clicks "2.5L"
7. Sees all compatible parts from Car Parts and Car Electricals categories
8. Can further filter by manufacturer (e.g., only show OEM Toyota parts)

### URL Examples
```
/parts?vehicleBrand=Toyota
/parts?vehicleBrand=Toyota&vehicleModel=Camry
/parts?vehicleBrand=Toyota&vehicleModel=Camry&vehicleEngine=2.5L
/parts?vehicleBrand=Toyota&vehicleModel=Camry&vehicleEngine=2.5L&makerId=123
```

## Testing Checklist

- [ ] Click brand from header navigates correctly
- [ ] Models load for selected brand
- [ ] Engines load for selected brand+model
- [ ] Products filter correctly for Car Parts only
- [ ] Products filter correctly for Car Electricals only
- [ ] Products from other categories are excluded
- [ ] Breadcrumb navigation works
- [ ] Loading states display properly
- [ ] Empty states display when no matches found
- [ ] Works with manufacturer filter
- [ ] Works with regular vehicle filter
- [ ] Mobile responsive layout
- [ ] Back button navigation preserves state

## Future Enhancements

1. **Cache Models/Engines** - Store in localStorage to avoid re-parsing
2. **Smarter Parsing** - Improve regex patterns for better extraction
3. **Year Filtering** - Add year selection after engine
4. **API Optimization** - Create dedicated endpoints for models/engines
5. **Search Within Results** - Add search bar for filtered products
6. **Popular Combinations** - Show most searched brand+model+engine combos
7. **Related Vehicles** - Suggest similar vehicles
8. **Compatibility Score** - Show confidence level for matches

## Notes

- Vehicle brand drill-down is triggered by `vehicleBrand` URL param
- Category drill-down is triggered by `catId` URL param
- Both can coexist but typically one is active at a time
- Search mode (`q` param) takes precedence over drill-downs
- VehicleFilter component provides additional filtering within drill-down results
