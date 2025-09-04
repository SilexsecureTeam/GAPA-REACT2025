import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FallbackLoader from "../components/FallbackLoader";
// import ProductCard, { type Product as UiProduct } from '../components/ProductCard'
import {
  getAllBrands,
  getAllCategories,
  getAllProducts,
  type ApiBrand,
  type ApiCategory,
  type ApiProduct,
} from "../services/api";
import {
  normalizeApiImage,
  pickImage,
  productImageFrom,
  categoryImageFrom,
} from "../services/images";
import logoImg from "../assets/gapa-logo.png";
import topImg from "../assets/top.png";
import AccessoryCard from "./AccessoryCard";

function Crumb() {
  return (
    <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
      <ol className="flex items-center gap-3 font-medium">
        <li>
          <Link to="/parts" className="hover:underline text-gray-700">
            Parts Catalogue
          </Link>
        </li>
        <li aria-hidden className="text-[24px] -mt-1.5">
          ›
        </li>
        <li className="font-semibold text-brand">All Parts</li>
      </ol>
    </nav>
  );
}

// Map API product into UI product for ProductCard
function toUiProduct(p: any, i: number) {
  // prepare brand and category names and their slugs
  const brandName = String(
    p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || ""
  );
  const categoryName =
    typeof p?.category === "string"
      ? p.category
      : p?.category?.name || p?.category?.title || p?.category_name || "";
  const toSlug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const brandSlug = brandName ? toSlug(brandName) : undefined;
  const partSlug = categoryName ? toSlug(categoryName) : undefined;

  return {
    id: String(p?.id ?? p?.product_id ?? i),
    title: String(p?.name || p?.title || p?.product_name || "Car Part"),
    image:
      productImageFrom(p) ||
      normalizeApiImage(pickImage(p) || "") ||
      "/gapa-logo.png",
    rating: Number(p?.rating || 4),
    brandSlug,
    partSlug,
  };
}

// Extract brand/category name heuristically from API product
// function brandOf(p: any): string {
//   return String(p?.brand || p?.manufacturer || p?.maker || p?.brand_name || 'Unknown')
// }
function categoryOf(p: any): string {
  const c = (p as any)?.category;
  if (typeof c === "string") return c;
  return String(c?.name || c?.title || (p as any)?.category_name || "General");
}

type Accessory = {
  id: string;
  title: string;
  image: string;
  rating: number;
  reviews: number;
  price: number;
  badge?: string;
};
const ACCESSORIES: Accessory[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `acc-${i + 1}`,
  title: [
    "Seat Organizer",
    "Phone Mount",
    "All-weather Mats",
    "Dash Cam",
    "LED Bulb",
  ][i % 5],
  image: topImg,
  rating: 3.8 + (i % 4) * 0.3,
  reviews: 500 + i * 37,
  price: 12000 + i * 1500,
  badge: i % 3 === 0 ? "Best Seller" : i % 3 === 1 ? "New" : undefined,
}));

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function CarParts() {
  const navigate = useNavigate();
  const accRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);

  const [canPrev, _setCanPrev] = useState(false);
  const [canNext, _setCanNext] = useState(true);

  // Per-category expand state (replaces global pagination)
  const INITIAL_VISIBLE = 10;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Categories dropdown state
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const [prods, b, c] = await Promise.all([
          getAllProducts(),
          getAllBrands(),
          getAllCategories(),
        ]);
        if (!alive) return;
        setProducts(Array.isArray(prods) ? prods : []);
        setBrands(Array.isArray(b) ? b : []);
        setCategories(Array.isArray(c) ? c : []);
      } catch (_) {
        if (!alive) return;
        setProducts([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  // No global filters now; use full list
  const filtered = products;

  // Navigate to SearchError if empty catalog
  useEffect(() => {
    if (!loading && filtered.length === 0) {
      const suggestSrc =
        Array.isArray(products) && products.length > 0 ? products[0] : null;
      const suggest = suggestSrc ? toUiProduct(suggestSrc, 0) : undefined;
      // persist suggestion for SearchError fallback
      if (suggest)
        localStorage.setItem("gapa:last-suggest", JSON.stringify(suggest));
      navigate("/search-error", {
        state: { reason: "no_results", suggest },
        replace: false,
      });
    }
  }, [filtered.length, loading]);

  // Group by category (all filtered items)
  const grouped = useMemo(() => {
    const map = new Map<string, ApiProduct[]>();
    for (const p of filtered) {
      const key = categoryOf(p);
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Resolve category image using API categories when available (by id or name)
  const catInfoFor = (sample: any) => {
    const name = categoryOf(sample);
    const c = sample?.category;
    let catObj: any | undefined;
    let catId: string | undefined;
    if (c && typeof c === "object") {
      catObj = c;
      catId = String(c?.id ?? c?.category_id ?? "");
    } else if (
      typeof c === "number" ||
      (typeof c === "string" && /^\d+$/.test(c))
    ) {
      // numeric id or numeric-like string
      catId = String(c);
    }
    if (!catObj && catId) {
      catObj = (categories as any[]).find(
        (x: any) => String(x?.id ?? x?.category_id ?? "") === catId
      );
    }
    if (!catObj && name) {
      const nLower = name.toLowerCase();
      catObj = (categories as any[]).find(
        (x: any) => String(x?.name || x?.title || "").toLowerCase() === nLower
      );
    }
    let img: string | undefined;
    if (catObj) {
      img =
        categoryImageFrom(catObj) || normalizeApiImage(pickImage(catObj) || "");
    }
    if (!img && c && typeof c === "object") {
      img = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || "");
    }
    const displayName = catObj
      ? String(catObj?.title || catObj?.name || name || "Category")
      : name || "Category";
    return { name: displayName, image: img || logoImg };
  };

  // Build categories menu model from grouped data (now includes product images)
  const catMenu = useMemo(() => {
    return grouped.map(([name, list]) => {
      const sample = list[0];
      const info = catInfoFor(sample as any);
      return {
        name: info.name || name,
        image: info.image,
        items: list.slice(0, 12).map((p, i) => ({
          id: String((p as any)?.id ?? (p as any)?.product_id ?? i),
          title: String(
            (p as any)?.name ||
              (p as any)?.title ||
              (p as any)?.product_name ||
              "Car Part"
          ),
          image:
            productImageFrom(p) ||
            normalizeApiImage(pickImage(p) || "") ||
            "/gapa-logo.png",
        })),
      };
    });
  }, [grouped]);

  const scrollByAmount = (dir: -1 | 1) => {
    const el = accRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9 * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const scrollToCat = (catName: string) => {
    const id = `cat-${toSlug(catName)}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">
          Browse Car Parts
        </h1>
        <Crumb />

        {/* Categories hover dropdown menu */}
        {!loading && catMenu.length > 0 && (
          <nav className="relative mt-4" onMouseLeave={() => setOpenIdx(null)}>
            <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-white p-2 ring-1 ring-black/10">
              {catMenu.map((c, i) => (
                <div key={c.name} className="relative">
                  <button
                    onMouseEnter={() => setOpenIdx(i)}
                    onFocus={() => setOpenIdx(i)}
                    onClick={() => {
                      setOpenIdx(null);
                      scrollToCat(c.name);
                    }}
                    className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium ${
                      openIdx === i
                        ? "bg-brand text-white"
                        : "text-gray-800 hover:bg-gray-100"
                    }`}
                    aria-haspopup
                    aria-expanded={openIdx === i}
                  >
                    <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                      <img
                        src={c.image}
                        alt=""
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "/gapa-logo.png";
                        }}
                      />
                    </span>
                    <span>{c.name}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${
                        openIdx === i ? "rotate-180" : ""
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {openIdx === i && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-screen max-w-md rounded-xl bg-white p-3 text-gray-900 shadow-lg ring-1 ring-black/10 sm:max-w-lg md:max-w-xl">
                      <div
                        role="menu"
                        aria-label={`${c.name} items`}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                      >
                        {c.items.map((it) => (
                          <Link
                            key={it.id}
                            role="menuitem"
                            to={`/product/${encodeURIComponent(it.id)}`}
                            className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-brand/5 focus:outline-none"
                          >
                            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                              <img
                                src={it.image}
                                alt=""
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    "/gapa-logo.png";
                                }}
                              />
                            </span>
                            <span className="truncate text-brand group-hover:underline">
                              {it.title}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>
        )}

        {/* Results */}
        {loading ? (
          <div className="mt-8">
            <FallbackLoader label="Loading parts…" />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Category sections (no global pagination) */}
            {grouped.length === 0 ? (
              <div className="text-center text-sm text-gray-600">
                No products found.
              </div>
            ) : (
              grouped.map(([_, list]) => {
                const sample = list[0];
                const info = catInfoFor(sample as any);
                const catName = info.name || "Category";
                const catImg = info.image;
                const isExpanded = !!expanded[catName];
                const visible = isExpanded
                  ? list
                  : list.slice(0, INITIAL_VISIBLE);
                return (
                  <section
                    id={`cat-${toSlug(catName)}`}
                    key={catName}
                    className="scroll-mt-28 rounded-xl bg-white p-4 ring-1 ring-black/10"
                  >
                    <div className="grid gap-4 md:grid-cols-[260px_1fr] md:items-start">
                      {/* Category card */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                          <img
                            src={catImg}
                            alt={catName}
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/gapa-logo.png";
                            }}
                          />
                        </div>
                        <div>
                          <h3 className="text-[16px] font-semibold text-gray-900">
                            {catName}
                          </h3>
                          <div className="text-[12px] text-gray-600">
                            {list.length} item{list.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>

                      {/* Product names list with per-category expand */}
                      <div>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {visible.map((p, i) => {
                            const id = String(
                              (p as any)?.id ?? (p as any)?.product_id ?? i
                            );
                            const title = String(
                              (p as any)?.name ||
                                (p as any)?.title ||
                                (p as any)?.product_name ||
                                "Car Part"
                            );
                            return (
                              <li
                                key={`${catName}-${id}-${i}`}
                                className="truncate"
                              >
                                <Link
                                  to={`/product/${encodeURIComponent(id)}`}
                                  className="text-[14px] text-brand hover:underline"
                                >
                                  {title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                        {list.length > INITIAL_VISIBLE && (
                          <div className="mt-3">
                            <button
                              onClick={() =>
                                setExpanded((s) => ({
                                  ...s,
                                  [catName]: !isExpanded,
                                }))
                              }
                              className="text-[13px] font-semibold text-brand hover:underline"
                            >
                              {isExpanded
                                ? "View less"
                                : `View more (${
                                    list.length - INITIAL_VISIBLE
                                  } more)`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Top brands from API */}
      <section className="mx-auto max-w-7xl px-4 pb-2 pt-2 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">
            Top brands
          </h3>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            View all
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <div className="mt-3 flex items-center justify-between gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
          {(brands.length ? brands : []).slice(0, 12).map((b, i) => {
            const name = (b as any)?.name || (b as any)?.title || "Brand";
            const logo = pickImage(b);
            const key = `${String((b as any)?.id ?? name ?? i)}-${i}`;
            return (
              <div key={key} className="shrink-0">
                {logo ? (
                  <img
                    src={normalizeApiImage(logo) || logoImg}
                    alt={name}
                    className="h-12 w-auto object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "/gapa-logo.png";
                    }}
                  />
                ) : (
                  <span className="text-[13px] font-medium">{name}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10">
        <h3 className="text-[14px] font-semibold text-gray-900">
          Top car accessories Categories
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-3 text-[12px] text-gray-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            "In-car phone chargers",
            "Satnav",
            "Dash camera",
            "Universal car floor mats",
            "Hubcaps",
            "First aid kit",
            "Car jacks",
            "Tyre compressors",
            "Car windscreen cover",
            "Microfiber cleaning cloth",
            "Car sponge",
            "Number plate surrounds",
          ].map((label) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10"
            >
              <span
                className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20"
                aria-hidden
              />
              <a href="#" className="hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Accessories carousel */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">
            Top-quality car accessories at unbeatable prices
          </h3>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              aria-label="Previous"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => scrollByAmount(-1)}
              disabled={!canPrev}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              aria-label="Next"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => scrollByAmount(1)}
              disabled={!canNext}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div
          ref={accRef}
          className="mt-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]"
          aria-label="Top accessories carousel"
        >
          <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
          <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-3 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
            {ACCESSORIES?.map((a) => (
              <div key={a.id} className="shrink-0">
                <AccessoryCard a={a} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Info section remains */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h2
          id="acc-easy-title"
          className="text-center text-[22px] font-semibold text-gray-900 sm:text-[28px]"
        >
          Car Accessories Made Easy with Gapa Naija
        </h2>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[14px] leading-6 text-gray-600">
          Car accessories play a huge role in making your driving experience
          safer, more convenient, and more enjoyable. At Gapa Naija, we provide
          high-quality accessories that not only protect your car but also add
          comfort, safety, and style for every trip.
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-3">
          {/* Types list (2 columns) */}
          <div className="md:col-span-2">
            <h3 className="text-[16px] font-semibold text-gray-900">
              Types of Car Accessories We Offer
            </h3>
            <div className="mt-4 grid gap-8 sm:grid-cols-2">
              <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                <li>
                  <div className="font-semibold text-gray-900">
                    Car Mats &amp; Liners
                  </div>
                  <p className="mt-1 text-gray-600">
                    Keep your interior clean and protected from dust, mud, and
                    spills while adding durability and comfort.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Covers &amp; Protectors
                  </div>
                  <p className="mt-1 text-gray-600">
                    From car body covers to seat and steering wheel covers,
                    these protect your vehicle from wear, scratches.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Car Care Essentials
                  </div>
                  <p className="mt-1 text-gray-600">
                    Brushes, scrapers, sponges, and cleaning kits to help you
                    maintain a spotless car without damaging the paintwork.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Safety &amp; Emergency Gear
                  </div>
                  <p className="mt-1 text-gray-600">
                    Be prepared with first aid kits, warning triangles, fire
                    extinguishers, reflective vests, safety hammers, and other
                    must-haves for emergencies.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Child Safety Accessories
                  </div>
                  <p className="mt-1 text-gray-600">
                    Special car seats and boosters designed for children of
                    different ages and sizes to keep your little ones safe on
                    the road.
                  </p>
                </li>
              </ul>

              <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                <li>
                  <div className="font-semibold text-gray-900">
                    Car Mats &amp; Liners
                  </div>
                  <p className="mt-1 text-gray-600">
                    Keep your interior clean and protected from dust, mud, and
                    spills while adding durability and comfort.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Covers &amp; Protectors
                  </div>
                  <p className="mt-1 text-gray-600">
                    From car body covers to seat and steering wheel covers,
                    these protect your vehicle from wear, scratches.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Car Care Essentials
                  </div>
                  <p className="mt-1 text-gray-600">
                    Brushes, scrapers, sponges, and cleaning kits to help you
                    maintain a spotless car without damaging the paintwork.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">
                    Safety &amp; Emergency Gear
                  </div>
                  <p className="mt-1 text-gray-600">
                    Be prepared with first aid kits, warning triangles, fire
                    extinguishers, reflective vests, safety hammers, and other
                    must-haves for emergencies.
                  </p>
                </li>
              </ul>
            </div>
          </div>

          {/* Why choose */}
          <aside className="md:pl-6">
            <h3 className="text-[16px] font-semibold text-gray-900">
              Why Choose Gapa Naija?
            </h3>
            <p className="mt-3 text-[13px] leading-6 text-gray-700">
              At Gapa Naija, we make shopping for car accessories simple,
              affordable, and reliable. With thousands of products, competitive
              prices, and fast delivery across Nigeria, you can always count on
              us to keep your car in top shape.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
