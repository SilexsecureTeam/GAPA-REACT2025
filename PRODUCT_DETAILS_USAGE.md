# How to Use the Product Details Page

## Accessing the Page

### Method 1: Direct Navigation
Navigate to any product using its ID:
```
/product/{product-id}
```

Example:
```
/product/c4ca4238a0b923820dcc509a6f75849b
```

### Method 2: From Product Listings
Click on any product card in:
- **Car Parts page** (`/parts`)
- **Air Fresheners page** (`/air-fresheners`)
- **Accessories section**
- **Search results**

All product links automatically navigate to `/product/:id`

### Method 3: From CarPartDetails Page
When viewing a selected product in CarPartDetails, click the **"View Full Details"** button to open the dedicated ProductDetails page.

## Page Features

### 1. Product Overview Section
Located at the top, displays:
- **Product Name** (Large heading)
- **Article Number** (Below name)
- **Manufacturer Info** (Logo and name in a highlighted box)
- **Customer Reviews** (Star rating + review count)
- **Price** (Large, with VAT notice)
- **Stock Status** (Green "In Stock" or Red "Out of Stock" badge)

### 2. Image Gallery
**Left side:**
- Large main image display
- Grid of thumbnails below (4 per row)
- Click any thumbnail to change main image
- Active thumbnail highlighted with yellow border

### 3. Purchase Controls
**Right side:**
- **Quantity Selector:**
  - `-` button to decrease
  - Current quantity display
  - `+` button to increase
  - Locked at 2 for paired products

- **Add to Cart Button:**
  - Large yellow button with cart icon
  - Shows "Adding..." during process
  - Disabled when out of stock
  - Opens cart popup after adding

- **Wishlist Heart Icon:**
  - Top-right corner
  - Click to add/remove from wishlist
  - Shows toast notification

### 4. Information Tabs
Four tabs for different information types:

#### Tab 1: Description
- Full product description text
- Easy to read with proper spacing

#### Tab 2: Specifications
- Technical specs in two-column format
- Label on left (beige background)
- Value on right (white background)
- Includes: EAN, Weight, and custom properties

#### Tab 3: Compatibility & OEM
Two sections:

**OEM Part Numbers:**
- Each code in a separate chip
- "Copy" button per code
- Click to copy to clipboard
- Shows "Copied!" confirmation

**Suitable Vehicles:**
- List of compatible vehicles
- Scrollable if many entries
- Each vehicle in its own row

#### Tab 4: Reviews
- Customer reviews with ratings
- User avatar (first letter of name)
- Date posted
- Star rating (1-5 stars)
- Review text
- "View All X Reviews" button if more than 5

### 5. Navigation

**Breadcrumbs at top:**
```
Home / Car Parts / [Category] / [Product Name]
```
Click any level to navigate back.

**Return Navigation:**
- "Go Back" button on error page
- "Back to Products" button (returns to listing)
- Supports `?from=` URL parameter for smart returns

## User Interactions

### Adding to Cart
1. Adjust quantity if needed (+ / - buttons)
2. Click "Add to Cart" button
3. See success toast notification
4. Cart popup opens automatically
5. Continue shopping or proceed to checkout

### Managing Wishlist
1. Click heart icon (top-right of product info)
2. Filled heart = in wishlist
3. Empty heart = not in wishlist
4. Toggle to add/remove

### Copying OEM Numbers
1. Go to "Compatibility & OEM" tab
2. Find desired OEM code
3. Click "Copy" button next to it
4. Button changes to "Copied!" for 2 seconds
5. Code is now on your clipboard

### Reading Reviews
1. Click "Reviews" tab
2. Scroll through displayed reviews
3. If more than 5 reviews, click "View All X Reviews"
4. Reviews expand to show all
5. Click "Show Less" to collapse back

## Tips & Best Practices

### For Customers
- **Check Compatibility:** Always verify the product fits your vehicle using the compatibility list
- **Read OEM Numbers:** Cross-reference OEM numbers with your current parts
- **Check Reviews:** Read customer experiences before purchasing
- **Compare Specs:** Use specifications tab to ensure it meets your needs

### For Developers
- **Pass Return URL:** When navigating to product details, include `?from=` parameter:
  ```tsx
  <Link to={`/product/${id}?from=${encodeURIComponent(currentPath)}`}>
  ```
- **Handle Loading:** Page shows skeleton loaders during data fetch
- **Error Recovery:** Error page provides navigation options
- **Mobile First:** Layout is fully responsive

## API Calls Made

When the page loads, it makes these API calls:
1. `GET /product/:id` - Product details
2. `GET /product/getProductOEM/:id` - OEM numbers
3. `GET /product/getProductReview/:id` - Customer reviews
4. `GET /manufacturers` - Manufacturer list (via hook)

All calls happen in parallel for fast loading.

## Common Issues & Solutions

### Issue: Product not loading
**Solution:** Check product ID is valid, ensure API is accessible

### Issue: Images not showing
**Solution:** Images automatically fall back to empty space if failed

### Issue: Can't add to cart
**Solution:** Ensure product is in stock, check authentication status

### Issue: OEM copy not working
**Solution:** Check browser clipboard permissions

### Issue: Reviews not loading
**Solution:** API may have returned no reviews, this is normal for new products

## Mobile Experience

On mobile devices:
- Images stack above product info
- Tabs scroll horizontally
- Touch-friendly button sizes
- Optimized spacing and typography
- Full functionality maintained

## Accessibility

- Semantic HTML structure
- Proper heading hierarchy
- Alt text on all images
- Keyboard navigation support
- ARIA labels on interactive elements
- Focus indicators on focusable elements

## Performance

- Lazy loading for images
- Parallel API calls
- Optimized re-renders with useMemo
- Skeleton loaders for perceived performance
- Efficient state management
