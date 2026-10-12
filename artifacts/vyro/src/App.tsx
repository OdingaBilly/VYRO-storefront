import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown,
  CircleAlert, Menu, Search, X,
} from 'lucide-react';
import {
  getGetAdminSummaryQueryKey, getGetProductQueryKey, getListAdminProductsQueryKey,
  getListCategoriesQueryKey, getListProductsQueryKey, useCreateProduct,
  useGetAdminSummary, useGetProduct, useListAdminProducts, useListCategories,
  useListProducts, useUpdateProduct,
} from '@workspace/api-client-react';
import type { AdminProduct, ProductInput, ProductUpdate } from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import logoMark from '@assets/icon-0.2_1791828673226.png';
import ride01 from '@assets/01_1791828673225.png';
import ride02 from '@assets/02_1791828673225.jpg';
import ride03 from '@assets/03_1791828673224.jpg';
import ride05 from '@assets/05_1791828673223.jpg';
import ride06 from '@assets/06_1791828673223.jpg';
import ride07 from '@assets/07_1791828673223.jpg';
import rideFilmA from '@assets/pinsave-video_(1)_1791828629283.mp4';
import rideFilmB from '@assets/pinsave-video_1791828629284.mp4';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${logoMark}`,
  },
  variables: {
    colorPrimary: '#FF6A00',
    colorForeground: '#20262B',
    colorMutedForeground: '#60686D',
    colorDanger: '#B42318',
    colorBackground: '#FBFAF6',
    colorInput: '#FBFAF6',
    colorInputForeground: '#20262B',
    colorNeutral: '#DDDCD5',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '6px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FBFAF6] rounded-xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#171C20] font-bold',
    headerSubtitle: 'text-[#60686D]',
    socialButtonsBlockButtonText: 'text-[#20262B] font-semibold',
    formFieldLabel: 'text-[#20262B] font-semibold',
    footerActionLink: 'text-[#D95700] font-semibold',
    footerActionText: 'text-[#60686D]',
    dividerText: 'text-[#60686D]',
    identityPreviewEditButton: 'text-[#D95700]',
    formFieldSuccessText: 'text-[#237A50]',
    alertText: 'text-[#B42318]',
    logoBox: 'max-h-14',
    logoImage: 'max-h-12 object-contain',
    socialButtonsBlockButton: 'border-[#DDDCD5] bg-[#F5F3EC]',
    formButtonPrimary: 'bg-[#FF6A00] hover:bg-[#E85F00]',
    formFieldInput: 'border-[#C8C8C1] bg-[#FBFAF6] text-[#20262B]',
    footerAction: 'text-[#60686D]',
    dividerLine: 'bg-[#DDDCD5]',
    alert: 'border-[#B42318]',
    otpCodeFieldInput: 'border-[#C8C8C1] text-[#20262B]',
    formFieldRow: 'text-[#20262B]',
    main: 'text-[#20262B]',
  },
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function formatMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

function imageUrl(path?: string | null) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return path.startsWith('/') ? path : `/api/storage/public-objects/${path}`;
}

function errorStatus(error: unknown) {
  const e = error as { status?: number; response?: { status?: number }; cause?: { status?: number } };
  return e?.status ?? e?.response?.status ?? e?.cause?.status;
}

function BrandLogo({ invert = false, className = '' }: { invert?: boolean; className?: string }) {
  return <span className={`brand-logo ${invert ? 'brand-logo-invert' : ''} ${className}`}><img src={logoMark} alt="VYRO" /></span>;
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const close = () => setMenuOpen(false);
  return (
    <header className="site-header" data-testid="site-header">
      <div className="header-inner container-wide page-gutter">
        <Link href="/" className="brand-home" onClick={close} data-testid="link-home-logo"><BrandLogo /></Link>
        <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Main navigation">
          <Link href="/shop" onClick={close} className={location.startsWith('/shop') ? 'nav-active' : ''} data-testid="link-shop">Shop</Link>
          <Link href="/field-notes" onClick={close} className={location.startsWith('/field-notes') ? 'nav-active' : ''} data-testid="link-field-notes">Field Notes</Link>
          <Link href="/our-story" onClick={close} className={location === '/our-story' ? 'nav-active' : ''} data-testid="link-story">Our story</Link>
        </nav>
        <div className="header-actions">
          <Link href="/search" aria-label="Search catalogue" className="icon-action" data-testid="link-search"><Search size={19} strokeWidth={1.7} /></Link>
          <Link href="/sign-in" className="account-link" data-testid="link-account">Account <ArrowUpRight size={14} /></Link>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} data-testid="button-mobile-menu">{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top container-wide page-gutter">
        <div className="footer-brand"><BrandLogo invert /><p className="eyebrow">BETTER BEYOND.</p><p>Performance meets purpose.<br />Engineered for what’s next.</p></div>
        <div className="footer-links"><span className="eyebrow">Explore</span><Link href="/shop">Shop the catalogue</Link><Link href="/our-story">Our story</Link><Link href="/field-notes">Field Notes</Link></div>
        <div className="footer-links"><span className="eyebrow">Your VYRO</span><Link href="/sign-in">Sign in</Link><Link href="/search">Search</Link><Link href="/admin">Catalogue administration</Link></div>
        <div className="footer-note"><span className="eyebrow">A note on the beginning</span><p>Our catalogue is being built with care. When something is available, you’ll find its real details here.</p></div>
      </div>
      <div className="footer-bottom container-wide page-gutter"><span>© {new Date().getFullYear()} VYRO</span><span className="technical">BUILT FOR THE WAY OUT.</span><span>BETTER BEYOND.</span></div>
    </footer>
  );
}

function SiteShell({ children }: { children: ReactNode }) {
  return <><Header /><main>{children}</main><Footer /><div className="grain" aria-hidden="true" /></>;
}

function SectionLabel({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <div className={`section-label ${dark ? 'section-label-dark' : ''}`}><span className="label-mark" /><span className="eyebrow">{children}</span></div>;
}

function HomePage() {
  const categories = useListCategories();
  const featured = useListProducts({ featured: true, page: 1, pageSize: 8 });
  const hasFeatured = (featured.data?.products.length ?? 0) > 0;
  return (
    <SiteShell>
      <section className="home-hero">
        <div className="hero-photo" style={{ backgroundImage: `url("${ride01}")` }} role="img" aria-label="Cycling equipment photographed in a dark, high-contrast editorial setting" />
        <div className="hero-shade" />
        <div className="hero-topline page-gutter"><span className="eyebrow">VYRO / FIELD BUILT</span><span className="technical">01 — 04 / PERFORMANCE MEETS PURPOSE</span></div>
        <div className="hero-content container-wide page-gutter">
          <p className="eyebrow hero-kicker rise">ENGINEERED FOR WHAT’S NEXT</p>
          <h1 className="display rise-delay">BETTER<br /><span>BEYOND.</span></h1>
          <div className="hero-bottom rise-delay">
            <p>For the miles that make you.<br />And the places that change you.</p>
            <div className="hero-actions"><Link className="btn btn-primary" href="/shop" data-testid="button-explore-catalogue">Explore the catalogue <ArrowRight size={17} /></Link><Link className="hero-story-link" href="/our-story" data-testid="link-discover-story">Discover VYRO <ArrowDownRight size={15} /></Link></div>
          </div>
        </div>
        <span className="hero-caption technical">EDITORIAL CYCLING STUDY / NOT PRODUCT INVENTORY</span>
      </section>

      {categories.isLoading && <section className="home-categories page-gutter container-wide" aria-label="Loading categories"><div className="section-heading"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-title" /></div><div className="category-skeletons">{[1, 2, 3].map((i) => <div className="skeleton category-skeleton" key={i} />)}</div></section>}
      {categories.isError && <div className="inline-notice container-wide page-gutter" role="status"><CircleAlert size={18} /> Categories are temporarily unavailable. <button onClick={() => categories.refetch()} className="text-button">Try again</button></div>}
      {!!categories.data?.length && <section className="home-categories page-gutter container-wide">
        <div className="section-heading"><SectionLabel>01 / FIND YOUR LINE</SectionLabel><div><h2 className="display">Start with<br className="mobile-break" /> what moves you.</h2><Link className="link-arrow" href="/shop">View all categories <ArrowRight size={16} /></Link></div></div>
        <div className="category-row">{categories.data.map((category, i) => <Link href={`/shop/${category.slug}`} className={`category-tile category-tile-${i % 3}`} key={category.id} data-testid={`card-category-${category.id}`}>
          <div className="category-image" style={category.imagePath ? { backgroundImage: `url("${imageUrl(category.imagePath)}")` } : undefined}><span className="tile-index technical">0{i + 1}</span><span className="tile-arrow"><ArrowUpRight size={20} /></span></div>
          <div className="category-copy"><div><h3 className="display">{category.name}</h3>{category.description && <p>{category.description}</p>}</div><ArrowRight size={17} /></div>
        </Link>)}</div>
      </section>}

      {featured.isLoading && <section className="featured-loading container-wide page-gutter"><div className="skeleton skeleton-title" /><div className="skeleton featured-skeleton" /></section>}
      {featured.isError && <div className="inline-notice container-wide page-gutter" role="status"><CircleAlert size={18} /> Featured collection could not load. <button onClick={() => featured.refetch()} className="text-button">Retry</button></div>}
      {hasFeatured && <section className="featured-section page-gutter container-wide">
        <div className="section-heading"><SectionLabel>02 / SELECTED FROM THE CATALOGUE</SectionLabel><div><h2 className="display">Ready for the<br />next mile.</h2><Link className="link-arrow" href="/shop">Shop all <ArrowRight size={16} /></Link></div></div>
        <ProductGrid products={featured.data?.products ?? []} />
      </section>}

      <section className="belief-section">
        <div className="belief-image" style={{ backgroundImage: `url("${ride03}")` }} role="img" aria-label="Close detail of a performance bicycle frame in rain, shown as editorial inspiration" />
        <div className="belief-copy">
          <SectionLabel dark>02 / THE VYRO POINT OF VIEW</SectionLabel>
          <p className="belief-overline eyebrow">DRIVEN BY BETTER POSSIBILITIES</p>
          <h2 className="display">More than<br />movement.</h2>
          <p className="belief-description">The best gear disappears into the moment. What stays is the road ahead, the air in your lungs, and the people who helped you get there.</p>
          <Link href="/our-story" className="btn btn-primary" data-testid="button-our-story">What we believe <ArrowRight size={17} /></Link>
          <span className="belief-index technical">VYRO / PRINCIPLE 01</span>
        </div>
      </section>

      <section className="principles-section container-wide page-gutter">
        <div className="principles-intro"><SectionLabel>03 / MADE FOR WHAT MATTERS</SectionLabel><h2 className="display">Good movement<br />has a point of view.</h2><p>We believe progress should feel useful — on the bike, off the map, and in the choices we make along the way.</p></div>
        <div className="principle-list">
          {[['01', 'Innovation', 'Thoughtful engineering. Continuous improvement.'], ['02', 'Adventure', 'A reason to take the road you don’t know.'], ['03', 'Performance', 'Purposeful things, made to be used.'], ['04', 'Community', 'We go further when we go together.']].map(([n, title, text]) => <article className="principle-item" key={n}><span className="technical">{n}</span><div><h3 className="display">{title}</h3><p>{text}</p></div><ArrowUpRight size={17} /></article>)}
        </div>
      </section>

      <FieldPreview />
      <section className="community-band">
        <div className="community-topline"><span className="eyebrow">VYRO / THE LONG WAY ROUND</span><span className="technical">DESIGNED FOR PARTICIPATION</span></div>
        <h2 className="display">The best part<br />is what happens<br /><em>out there.</em></h2>
        <p>We’re building a place for useful ideas, good kit and the people who put both to work.</p>
        <Link href="/field-notes" className="btn btn-outline" data-testid="button-read-field-notes">Get to know us <ArrowRight size={16} /></Link>
      </section>
    </SiteShell>
  );
}

function ProductGrid({ products }: { products: Array<{ id: string; slug: string; name: string; shortDescription: string | null; categoryName: string | null; primaryImage: { path: string; altText: string }; priceMinor: number; currency: string; available: boolean }> }) {
  return <div className="product-grid">{products.map((p) => <Link href={`/products/${p.slug}`} className="product-card" key={p.id} data-testid={`card-product-${p.id}`}>
    <div className="product-image">{p.primaryImage?.path ? <img src={imageUrl(p.primaryImage.path)} alt={p.primaryImage.altText || p.name} /> : <div className="product-image-fallback"><BrandLogo /></div>}<span className={`availability ${p.available ? 'available' : 'unavailable'}`}>{p.available ? 'Available' : 'Unavailable'}</span></div>
    <div className="product-card-meta"><span className="eyebrow">{p.categoryName || 'VYRO'}</span><span className="technical">{formatMoney(p.priceMinor, p.currency)}</span></div>
    <h3 className="display">{p.name}</h3>{p.shortDescription && <p>{p.shortDescription}</p>}
  </Link>)}</div>;
}

function FieldPreview() {
  return <section className="field-preview container-wide page-gutter">
    <div className="field-intro"><SectionLabel>04 / FIELD NOTES</SectionLabel><h2 className="display">The outside<br />is the point.</h2><p>Observations, practices and perspective from a life in motion.</p><Link href="/field-notes" className="link-arrow">Enter Field Notes <ArrowRight size={16} /></Link></div>
    <div className="field-visuals">
      <Link href="/field-notes" className="field-photo field-photo-main" data-testid="card-field-notes"><img src={ride07} alt="Monochrome close-up of a road bike wheel and tire detail" /><span className="field-photo-caption"><span className="eyebrow">ON THE DETAILS</span><span className="display">Every line has a reason.</span><ArrowUpRight size={19} /></span></Link>
      <div className="field-side-note"><img src={ride06} alt="Road bicycle in profile against a dark studio background" /><span className="technical">A STUDY IN MOVEMENT / 02</span></div>
    </div>
  </section>;
}

function CataloguePage({ categorySlug, searchMode = false }: { categorySlug?: string; searchMode?: boolean }) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [sort, setSort] = useState<'newest' | 'name' | 'price-asc' | 'price-desc'>('newest');
  const [page, setPage] = useState(1);
  const categories = useListCategories();
  const category = categories.data?.find((c) => c.slug === categorySlug);
  const params = { q: searchMode ? new URLSearchParams(window.location.search).get('q') || undefined : undefined, category: categorySlug, sort, page, pageSize: 12 };
  const result = useListProducts(params);
  const title = searchMode ? 'Search the catalogue' : category ? category.name : 'The catalogue';
  const submitSearch = (e: FormEvent) => { e.preventDefault(); setPage(1); setLocation(`/search?q=${encodeURIComponent(query.trim())}`); };
  const onSort = (value: typeof sort) => { setSort(value); setPage(1); };
  const currentQ = new URLSearchParams(window.location.search).get('q') ?? '';
  return <SiteShell><div className="catalogue-page container-wide page-gutter">
    <div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>{category && <><span>/</span><span>{category.name}</span></>}</div>
    <div className="catalogue-heading"><div><SectionLabel>VYRO / CATALOGUE</SectionLabel><h1 className="display">{title}<span className="orange-period">.</span></h1><p>{searchMode ? 'Search products and equipment in the current catalogue.' : 'Considered equipment for moving well and going further.'}</p></div>
      {searchMode && <form onSubmit={submitSearch} className="search-form"><label htmlFor="catalogue-query" className="field-label">Search products</label><div className="search-input-row"><input id="catalogue-query" className="form-control" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try a name or category" data-testid="input-search-query" /><button className="btn btn-dark" aria-label="Search" data-testid="button-submit-search"><Search size={18} /></button></div></form>}
    </div>
    {!searchMode && <div className="category-chips"><Link className={!categorySlug ? 'category-chip active' : 'category-chip'} href="/shop">All</Link>{categories.data?.map((c) => <Link className={categorySlug === c.slug ? 'category-chip active' : 'category-chip'} href={`/shop/${c.slug}`} key={c.id} data-testid={`link-category-filter-${c.id}`}>{c.name}</Link>)}</div>}
    <div className="catalogue-toolbar"><span className="technical">{result.data ? `${result.data.total} ${result.data.total === 1 ? 'RESULT' : 'RESULTS'}` : 'CATALOGUE RESULTS'}</span><label className="sort-control">Sort by <select value={sort} onChange={(e) => onSort(e.target.value as typeof sort)} aria-label="Sort products" data-testid="select-product-sort"><option value="newest">Newest</option><option value="name">Name</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select><ChevronDown size={15} /></label></div>
    {result.isLoading ? <div className="catalogue-skeleton-grid" aria-label="Loading catalogue">{[1, 2, 3, 4].map((n) => <div className="catalogue-skeleton" key={n}><div className="skeleton" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div>)}</div> :
      result.isError ? <StatePanel title="We couldn’t load the catalogue" copy="Please check your connection and try again." action="Try again" onAction={() => result.refetch()} /> :
      !result.data?.products.length ? <StatePanel title={searchMode && currentQ ? 'No matches this time.' : 'Nothing in the catalogue just yet.'} copy={searchMode && currentQ ? `We couldn’t find a product for “${currentQ}”. Try another search or browse all categories.` : 'We’re preparing the first collection. There are no products listed yet, so we won’t fill the page with placeholders.'} action={searchMode ? 'Browse the catalogue' : 'Explore Field Notes'} href={searchMode ? '/shop' : '/field-notes'} /> :
      <><ProductGrid products={result.data.products} /><div className="pagination"><button className="btn btn-outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} data-testid="button-previous-page"><ArrowLeft size={16} /> Previous</button><span className="technical">PAGE {result.data.page} / {Math.max(1, Math.ceil(result.data.total / result.data.pageSize))}</span><button className="btn btn-outline" onClick={() => setPage(page + 1)} disabled={page * result.data.pageSize >= result.data.total} data-testid="button-next-page">Next <ArrowRight size={16} /></button></div></>}
  </div></SiteShell>;
}

function ProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const productQuery = useGetProduct(slug);
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState('');
  const product = productQuery.data;
  const selected = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0];
  return <SiteShell><div className="product-detail container-wide page-gutter">
    <div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>{product && <><span>/</span><span>{product.name}</span></>}</div>
    {productQuery.isLoading ? <div className="product-detail-skeleton"><div className="skeleton" /><div><span className="skeleton skeleton-line" /><span className="skeleton skeleton-title" /><span className="skeleton skeleton-line" /></div></div> :
      productQuery.isError || !product ? <StatePanel title="This product isn’t available" copy="It may have been removed, or the catalogue may be temporarily unavailable." action="Back to the catalogue" href="/shop" /> :
      <div className="product-detail-grid">
        <div className="product-gallery">{product.images.length ? <><div className="product-gallery-main"><img src={imageUrl(product.images[activeImage]?.path)} alt={product.images[activeImage]?.altText || product.name} /></div><div className="product-thumbnails">{product.images.map((image, i) => <button key={image.id} className={i === activeImage ? 'thumb active' : 'thumb'} onClick={() => setActiveImage(i)} aria-label={`View image ${i + 1}`} data-testid={`button-product-image-${i}`}><img src={imageUrl(image.path)} alt="" /></button>)}</div></> : <div className="product-gallery-empty"><BrandLogo /><span className="eyebrow">IMAGE NOT AVAILABLE</span></div>}</div>
        <div className="product-information"><SectionLabel>{product.category.name} / PRODUCT DETAIL</SectionLabel>{product.brand && <p className="eyebrow product-brand">{product.brand}</p>}<h1 className="display">{product.name}</h1>{product.shortDescription && <p className="product-short">{product.shortDescription}</p>}
          {selected && <p className="product-price technical">{formatMoney(selected.priceMinor, selected.currency)}</p>}
          {product.variants.length > 1 && <label className="field-label variant-label">Choose an option<select className="form-control" value={selected?.id ?? ''} onChange={(e) => setVariantId(e.target.value)} data-testid="select-product-variant">{product.variants.map((v) => <option value={v.id} key={v.id}>{v.name}{v.available ? '' : ' — unavailable'}</option>)}</select></label>}
          <p className={`product-availability ${selected?.available ? 'available' : 'unavailable'}`}><span />{selected?.available ? 'Available' : 'Currently unavailable'}</p>
          <button className="btn btn-dark add-to-bag" disabled data-testid="button-add-to-bag" title="Shopping bag and checkout are not available yet">Shopping bag is coming later</button>
          <p className="phase-note">Checkout isn’t part of this release. We’ll show accurate purchase options here when they’re ready.</p>
          {product.description && <div className="product-description"><h2 className="display">Details</h2><p>{product.description}</p></div>}
          <div className="product-technical"><span className="eyebrow">PRODUCT RECORD</span><span className="technical">REF / {product.slug}</span></div>
        </div>
      </div>}
  </div></SiteShell>;
}

function StoryPage() {
  return <SiteShell><article className="story-page container-wide">
    <section className="story-hero page-gutter"><div><SectionLabel>VYRO / OUR STORY</SectionLabel><h1 className="display">BETTER<br />BEYOND<span className="orange-period">.</span></h1><p>Performance meets purpose. Engineered for what’s next.</p></div><img src={ride01} alt="Cyclist's view of a road bicycle on textured pavement, editorial inspiration photography" /><span className="technical story-img-caption">EDITORIAL STUDY / CYCLING</span></section>
    <section className="story-thesis page-gutter"><span className="eyebrow">A SIMPLE IDEA, WITH ROOM TO GO</span><h2 className="display">Movement is a beginning.<br />Not a destination.</h2><p>VYRO exists for the people who find something more on the other side of effort. We believe in useful innovation, honest performance and the kind of adventure that brings people closer to the world around them.</p></section>
    <section className="story-photo-band"><img src={ride03} alt="Water beading on a technical cycling frame, monochrome equipment study" /><div><SectionLabel dark>BUILT AROUND REAL USE</SectionLabel><h2 className="display">Less noise.<br />More purpose.</h2><p>No claims without proof. No product for product’s sake. Just thoughtful choices that make getting out there feel better.</p></div></section>
    <section className="story-pillars page-gutter"><SectionLabel>WHAT GUIDES US</SectionLabel><div>{[['01', 'Innovation', 'Better is a practice. We keep asking how thoughtful engineering can do more with less.'], ['02', 'Adventure', 'Curiosity is a compass. We make space for detours, new horizons and the unknown.'], ['03', 'Performance', 'Reliability earns its place through use. Purpose always comes before noise.'], ['04', 'Community', 'Progress is better shared. We want more people to find their own way forward.']].map(([n, name, copy]) => <article key={n}><span className="technical">{n}</span><h3 className="display">{name}</h3><p>{copy}</p></article>)}</div></section>
    <section className="story-ending page-gutter"><img src={ride02} alt="Close crop of a bicycle wheel and frame in a dark, monochrome editorial image" /><div><span className="eyebrow">THE ROAD AHEAD</span><h2 className="display">We’re just<br />getting started.</h2><Link href="/shop" className="btn btn-primary">See the catalogue <ArrowRight size={17} /></Link></div></section>
  </article></SiteShell>;
}

function FieldNotesPage() {
  return <SiteShell><div className="notes-page container-wide page-gutter"><section className="notes-heading"><SectionLabel>VYRO / FIELD NOTES</SectionLabel><h1 className="display">Out there,<br />in good company.</h1><p>Field observations, moving images and useful ideas. An editorial space for the things we learn in motion.</p></section>
    <section className="notes-feature"><div className="notes-feature-image"><img src={ride05} alt="Road bicycle photographed from the front, a black-and-white editorial study" /><span className="technical">VISUAL STUDY / 01</span></div><div className="notes-feature-copy"><span className="eyebrow">THE ART OF THE RIDE / EDITORIAL</span><h2 className="display">Pay attention<br />to the small things.</h2><p>Good days outside rarely come down to one big thing. They’re built from the details: a quiet morning, the right pace, a road worth remembering.</p><span className="notes-tag">A VYRO FIELD NOTE</span></div></section>
    <section className="notes-video-section"><SectionLabel>IN MOTION / SHORT FILMS</SectionLabel><h2 className="display">A little time<br />outside.</h2><p className="video-note">Optional films from the VYRO visual archive. Press play when you’re ready; sound stays under your control.</p><div className="video-grid">{[[rideFilmA, 'Ride sequence, portrait editorial film'], [rideFilmB, 'Outdoor movement, portrait editorial film']].map(([src, alt]) => <figure className="video-card" key={src}><video controls playsInline preload="metadata" aria-label={alt} data-testid="video-editorial"><source src={src} type="video/mp4" />Your browser does not support the video element.</video><figcaption className="technical">EDITORIAL FILM / USER CONTROLLED</figcaption></figure>)}</div></section>
    <section className="notes-disclosure"><CircleAlert size={17} /><p>Images and film on this page are editorial inspiration. Bicycles and equipment shown may carry other brands and are not VYRO catalogue products.</p></section>
  </div></SiteShell>;
}

function StatePanel({ title, copy, action, href, onAction }: { title: string; copy: string; action?: string; href?: string; onAction?: () => void }) {
  return <section className="state-panel" role="status"><span className="state-index technical">VYRO / STATUS</span><span className="state-rule" /><h2 className="display">{title}</h2><p>{copy}</p>{href && action && <Link className="btn btn-dark" href={href} data-testid="link-state-action">{action} <ArrowRight size={16} /></Link>}{onAction && action && <button className="btn btn-dark" onClick={onAction} data-testid="button-state-retry">{action} <ArrowRight size={16} /></button>}</section>;
}

function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-logo"><BrandLogo invert /></Link><span className="eyebrow">CATALOGUE OPS</span><nav aria-label="Administration"><Link href="/admin" data-testid="link-admin-overview">Overview</Link><Link href="/admin/products" data-testid="link-admin-products">Products</Link><Link href="/admin/products/new" data-testid="link-admin-create">Create product</Link></nav><div className="admin-sidebar-foot"><Link href="/" data-testid="link-storefront">← Return to storefront</Link><span className="technical">VYRO / PHASE 01</span></div></aside><main className="admin-main"><div className="admin-topline"><span className="technical">ADMIN / CATALOGUE</span><Link href="/sign-in" className="admin-signout" data-testid="link-admin-account">Account <ArrowUpRight size={13} /></Link></div><div className="admin-content"><SectionLabel>VYRO / ADMINISTRATION</SectionLabel><h1 className="display">{title}</h1>{children}</div></main></div>;
}

function AdminDenied({ error }: { error: unknown }) {
  const status = errorStatus(error);
  if (status === 401 || status === 403) return <div className="admin-access" role="alert"><CircleAlert size={22} /><h2 className="display">{status === 401 ? 'Sign in to continue.' : 'Administrator access required.'}</h2><p>{status === 401 ? 'This area is available to authenticated catalogue administrators.' : 'Your account is signed in, but it does not have permission to manage this catalogue.'} VYRO administrator access is confirmed by the catalogue service, not by sign-in alone.</p><Link className="btn btn-dark" href="/sign-in">Continue to sign in <ArrowRight size={16} /></Link></div>;
  return <div className="admin-access" role="alert"><CircleAlert size={22} /><h2 className="display">Catalogue admin is unavailable.</h2><p>We couldn’t verify access with the catalogue service. Please retry in a moment.</p></div>;
}

function AdminOverviewPage() {
  const summary = useGetAdminSummary();
  return <AdminShell title="Catalogue overview">{summary.isLoading ? <div className="metric-grid">{[1, 2, 3, 4, 5].map((n) => <div className="metric-skeleton skeleton" key={n} />)}</div> : summary.isError ? <AdminDenied error={summary.error} /> : summary.data && <><div className="admin-intro-row"><p>Catalogue health, at a glance. Counts are live from the product service.</p><Link href="/admin/products" className="btn btn-dark">Manage products <ArrowRight size={16} /></Link></div><div className="metric-grid">{[['TOTAL PRODUCTS', summary.data.totalProducts], ['PUBLISHED', summary.data.publishedProducts], ['DRAFTS', summary.data.draftProducts], ['ARCHIVED', summary.data.archivedProducts], ['OUT OF STOCK VARIANTS', summary.data.outOfStockVariants]].map(([label, value]) => <article className="metric-card" key={label}><span className="eyebrow">{label}</span><strong className="display">{value}</strong><span className="technical">LIVE COUNT</span></article>)}</div><section className="admin-next-step"><div><span className="eyebrow">NEXT STEP</span><h2 className="display">Build the catalogue with care.</h2><p>Products aren’t seeded. Add a real record when the details are ready to publish.</p></div><Link href="/admin/products/new" className="btn btn-primary">Create a product <ArrowRight size={16} /></Link></section></>}</AdminShell>;
}

function AdminProductsPage() {
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const list = useListAdminProducts(appliedQ ? { q: appliedQ } : {});
  const submit = (e: FormEvent) => { e.preventDefault(); setAppliedQ(q.trim()); };
  return <AdminShell title="Products"><div className="admin-intro-row"><p>Search and maintain the product records behind the public catalogue.</p><Link href="/admin/products/new" className="btn btn-primary" data-testid="button-create-product"><span>＋</span> Add product</Link></div>
    <form className="admin-search" onSubmit={submit}><label className="field-label" htmlFor="admin-search">Search products</label><div><input id="admin-search" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or product detail" data-testid="input-admin-search" /><button className="btn btn-dark" data-testid="button-admin-search">Search</button></div></form>
    {list.isLoading ? <div className="admin-list-skeleton">{[1, 2, 3].map((i) => <div className="skeleton" key={i} />)}</div> : list.isError ? <AdminDenied error={list.error} /> : list.data?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Status</th><th>Variants</th><th>Updated</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{list.data.map((p) => <tr key={p.id} data-testid={`row-admin-product-${p.id}`}><td><strong>{p.name}</strong><span className="table-slug technical">{p.slug}</span></td><td>{p.categoryName || '—'}</td><td><span className={`status-pill status-${p.status}`}>{p.status}</span></td><td>{p.variants.length}</td><td>{new Date(p.updatedAt).toLocaleDateString()}</td><td><Link className="table-action" href={`/admin/products/${p.id}`} data-testid={`link-edit-product-${p.id}`}>Edit <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div> : <StatePanel title="A clean slate." copy={appliedQ ? 'No products match that search. Try another name, or create a product record.' : 'There are no catalogue records yet. Add a real product when its details are ready; the public storefront won’t show placeholders.'} action="Create a product" href="/admin/products/new" />}
  </AdminShell>;
}

type VariantDraft = { sku: string; name: string; options: string; price: string; currency: string; compareAt: string; stock: string };
type ImageDraft = { path: string; altText: string };
const emptyVariant: VariantDraft = { sku: '', name: '', options: '{}', price: '', currency: 'USD', compareAt: '', stock: '0' };

function AdminProductForm({ productId }: { productId?: string }) {
  const cache = useQueryClient();
  const [, setLocation] = useLocation();
  const adminList = useListAdminProducts({});
  const categories = useListCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const existing = adminList.data?.find((p) => p.id === productId);
  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [featured, setFeatured] = useState(false);
  const [variant, setVariant] = useState<VariantDraft>(emptyVariant);
  const [image, setImage] = useState<ImageDraft>({ path: '', altText: '' });
  const [optionsError, setOptionsError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    if (!existing || initialized) return;
    setName(existing.name); setSlug(existing.slug); setCategoryId(existing.categoryId ?? ''); setBrand(existing.brand ?? '');
    setShortDescription(existing.shortDescription ?? ''); setDescription(existing.description ?? ''); setStatus(existing.status);
    setFeatured(existing.featured);
    const v = existing.variants[0];
    if (v) setVariant({ sku: v.sku, name: v.name, options: JSON.stringify(v.options), price: (v.priceMinor / 100).toFixed(2), currency: v.currency, compareAt: v.compareAtPriceMinor == null ? '' : (v.compareAtPriceMinor / 100).toFixed(2), stock: String(v.stockOnHand) });
    const img = existing.images[0];
    if (img) setImage({ path: img.path, altText: img.altText });
    setInitialized(true);
  }, [existing, initialized]);
  const pending = create.isPending || update.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErrorMessage('');
    let options: Record<string, string>;
    try {
      const parsed: unknown = JSON.parse(variant.options || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((v) => typeof v !== 'string')) throw new Error();
      options = parsed as Record<string, string>; setOptionsError('');
    } catch {
      setOptionsError('Enter variant options as a JSON object of text values.'); return;
    }
    if (!name.trim() || !slug.trim() || !variant.sku.trim() || !variant.name.trim() || !variant.price || Number(variant.price) < 0) {
      setErrorMessage('Complete the required product and first variant fields.'); return;
    }
    const payload = {
      categoryId: categoryId || null, name: name.trim(), slug: slug.trim(), shortDescription: shortDescription || null,
      description: description || null, brand: brand || null, status, featured,
      images: [
        ...(image.path.trim() ? [{ path: image.path.trim(), altText: image.altText, sortOrder: 0, isPrimary: true }] : []),
        ...(existing?.images.slice(1).map((img) => ({ path: img.path, altText: img.altText, sortOrder: img.sortOrder, isPrimary: img.isPrimary })) ?? []),
      ],
      variants: [
        { sku: variant.sku.trim(), name: variant.name.trim(), options, priceMinor: Math.round(Number(variant.price) * 100), currency: variant.currency.toUpperCase(), compareAtPriceMinor: variant.compareAt ? Math.round(Number(variant.compareAt) * 100) : null, stockOnHand: Math.max(0, Math.floor(Number(variant.stock) || 0)) },
        ...(existing?.variants.slice(1).map((v) => ({ sku: v.sku, name: v.name, options: v.options, priceMinor: v.priceMinor, currency: v.currency, compareAtPriceMinor: v.compareAtPriceMinor, stockOnHand: v.stockOnHand })) ?? []),
      ],
    };
    const onSuccess = (saved: AdminProduct) => {
      cache.invalidateQueries({ queryKey: getListAdminProductsQueryKey({}) });
      cache.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      cache.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      cache.invalidateQueries({ queryKey: getListProductsQueryKey() });
      cache.invalidateQueries({ queryKey: getGetProductQueryKey(saved.slug) });
      if (existing?.slug) cache.invalidateQueries({ queryKey: getGetProductQueryKey(existing.slug) });
      setLocation(`/admin/products/${saved.id}`);
    };
    const onError = (error: unknown) => {
      const status = errorStatus(error);
      setErrorMessage(status === 401 ? 'Your sign-in could not be verified. Please sign in and try again.' : status === 403 ? 'This account does not have administrator permission. Your details are still here.' : 'The product could not be saved. Your details are still here; please try again.');
    };
    if (productId) update.mutate({ productId, data: payload as ProductUpdate }, { onSuccess, onError });
    else create.mutate({ data: payload as ProductInput }, { onSuccess, onError });
  };
  if (productId && adminList.isLoading) return <AdminShell title="Edit product"><div className="admin-form-skeleton"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div></AdminShell>;
  if ((productId && adminList.isError) || (productId && adminList.isSuccess && !existing)) return <AdminShell title="Edit product"><AdminDenied error={adminList.error ?? new Error('Product not found')} /></AdminShell>;
  return <AdminShell title={productId ? 'Edit product' : 'Create product'}><div className="form-intro"><p>{productId ? 'Update a catalogue record. Changes are sent to the product service.' : 'Add an actual product record. Required fields are marked; nothing here is published unless you choose that status.'}</p><Link href="/admin/products" className="link-arrow"><ArrowLeft size={15} /> Back to products</Link></div>
    <form className="admin-product-form" onSubmit={submit} noValidate>
      <div className="admin-form-main"><section className="form-section"><div className="form-section-head"><span className="technical">01</span><h2 className="display">Product record</h2></div>
        <div className="form-grid"><div className="form-field span-2"><label className="field-label" htmlFor="product-name">Product name <span>*</span></label><input id="product-name" className="form-control" maxLength={200} value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160)); }} required data-testid="input-product-name" /></div>
        <div className="form-field"><label className="field-label" htmlFor="product-slug">Slug <span>*</span></label><input id="product-slug" className="form-control technical" maxLength={160} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} required data-testid="input-product-slug" /></div>
        <div className="form-field"><label className="field-label" htmlFor="product-category">Category</label><select id="product-category" className="form-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} data-testid="select-product-category"><option value="">Unassigned</option>{categories.data?.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></div>
        <div className="form-field span-2"><label className="field-label" htmlFor="product-short">Short description</label><input id="product-short" className="form-control" maxLength={280} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} data-testid="input-product-short-description" /></div>
        <div className="form-field span-2"><label className="field-label" htmlFor="product-description">Full description</label><textarea id="product-description" className="form-control form-textarea" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-product-description" /></div>
        <div className="form-field"><label className="field-label" htmlFor="product-brand">Brand</label><input id="product-brand" className="form-control" maxLength={120} value={brand} onChange={(e) => setBrand(e.target.value)} data-testid="input-product-brand" /></div>
        </div></section>
        <section className="form-section"><div className="form-section-head"><span className="technical">02</span><h2 className="display">Product image</h2></div><p className="form-helper">Use an approved App Storage path or an existing accessible image URL. Image uploads are not available in this form.</p><div className="form-grid"><div className="form-field span-2"><label className="field-label" htmlFor="image-path">Image path</label><input id="image-path" className="form-control technical" value={image.path} onChange={(e) => setImage({ ...image, path: e.target.value })} placeholder="/api/storage/public-objects/…" data-testid="input-image-path" /></div><div className="form-field span-2"><label className="field-label" htmlFor="image-alt">Alternative text</label><input id="image-alt" className="form-control" value={image.altText} onChange={(e) => setImage({ ...image, altText: e.target.value })} data-testid="input-image-alt" /></div></div></section>
      </div>
      <aside className="admin-form-side">
        <section className="form-section"><div className="form-section-head"><span className="technical">03</span><h2 className="display">First variant</h2></div><p className="form-helper">Variant details are authoritative product data. Enter the actual SKU, price, currency and stock.</p>
          <div className="form-field"><label className="field-label" htmlFor="variant-sku">SKU <span>*</span></label><input id="variant-sku" className="form-control technical" value={variant.sku} onChange={(e) => setVariant({ ...variant, sku: e.target.value })} required data-testid="input-variant-sku" /></div>
          <div className="form-field"><label className="field-label" htmlFor="variant-name">Variant name <span>*</span></label><input id="variant-name" className="form-control" value={variant.name} onChange={(e) => setVariant({ ...variant, name: e.target.value })} required data-testid="input-variant-name" /></div>
          <div className="form-grid side-grid"><div className="form-field"><label className="field-label" htmlFor="variant-price">Price (major units) <span>*</span></label><input id="variant-price" className="form-control" type="number" min="0" step="0.01" value={variant.price} onChange={(e) => setVariant({ ...variant, price: e.target.value })} required data-testid="input-variant-price" /></div><div className="form-field"><label className="field-label" htmlFor="variant-currency">Currency</label><input id="variant-currency" className="form-control technical" minLength={3} maxLength={3} value={variant.currency} onChange={(e) => setVariant({ ...variant, currency: e.target.value })} data-testid="input-variant-currency" /></div></div>
          <div className="form-grid side-grid"><div className="form-field"><label className="field-label" htmlFor="variant-compare">Compare at (optional)</label><input id="variant-compare" className="form-control" type="number" min="0" step="0.01" value={variant.compareAt} onChange={(e) => setVariant({ ...variant, compareAt: e.target.value })} data-testid="input-variant-compare-at" /></div><div className="form-field"><label className="field-label" htmlFor="variant-stock">Stock on hand</label><input id="variant-stock" className="form-control" type="number" min="0" step="1" value={variant.stock} onChange={(e) => setVariant({ ...variant, stock: e.target.value })} data-testid="input-variant-stock" /></div></div>
          <div className="form-field"><label className="field-label" htmlFor="variant-options">Options (JSON)</label><textarea id="variant-options" className="form-control form-textarea technical" rows={3} value={variant.options} onChange={(e) => setVariant({ ...variant, options: e.target.value })} aria-describedby="options-help" data-testid="input-variant-options" /><span id="options-help" className="form-helper">A JSON object with text values, for example {`{"size":"M"}`}.</span>{optionsError && <span className="form-error" role="alert">{optionsError}</span>}</div>
        </section>
        <section className="form-section"><div className="form-section-head"><span className="technical">04</span><h2 className="display">Visibility</h2></div><div className="form-field"><label className="field-label" htmlFor="product-status">Status</label><select id="product-status" className="form-control" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} data-testid="select-product-status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div><label className="checkbox-row"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} data-testid="checkbox-product-featured" /><span>Include in featured collection</span></label></section>
        {errorMessage && <div className="form-error-box" role="alert"><CircleAlert size={17} />{errorMessage}</div>}
        <button className="btn btn-primary form-submit" type="submit" disabled={pending} data-testid="button-save-product">{pending ? 'Saving…' : productId ? 'Save changes' : 'Create product'} {!pending && <Check size={16} />}</button>
      </aside>
    </form>
  </AdminShell>;
}

function AdminRoute({ children, title }: { children: ReactNode; title: string }) {
  return <Show when="signed-in">{children}<Show when="signed-out"><AdminShell title={title}><div className="admin-access"><CircleAlert size={22} /><h2 className="display">Sign in to continue.</h2><p>Catalogue administration requires an authenticated account and service-side administrator permission.</p><Link className="btn btn-dark" href="/sign-in">Sign in <ArrowRight size={16} /></Link></div></AdminShell></Show></Show>;
}

function AuthRoutes() {
  return <div className="auth-page"><div className="auth-copy"><Link href="/" className="auth-brand"><BrandLogo /></Link><span className="eyebrow">VYRO / MEMBER ACCESS</span><h1 className="display">BETTER<br />BEYOND.</h1><p>Good to have you here. Sign in to your VYRO account.</p><Link href="/" className="link-arrow"><ArrowLeft size={15} /> Back to the storefront</Link></div><div className="auth-form-wrap"><Route path="/sign-in/*?"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} /></Route><Route path="/sign-up/*?"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} /></Route></div></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/admin" /></Show><Show when="signed-out"><HomePage /></Show></>;
}

function Router() {
  const [location] = useLocation();
  return <div className="router-frame"><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/shop" component={() => <CataloguePage />} />
    <Route path="/shop/:category" component={() => { const p = useParams<{ category: string }>(); return <CataloguePage categorySlug={p.category} />; }} />
    <Route path="/products/:slug" component={ProductPage} />
    <Route path="/search" component={() => <CataloguePage searchMode />} />
    <Route path="/our-story" component={StoryPage} />
    <Route path="/field-notes" component={FieldNotesPage} />
    <Route path="/admin" component={() => <AdminRoute title="Catalogue overview"><AdminOverviewPage /></AdminRoute>} />
    <Route path="/admin/products" component={() => <AdminRoute title="Products"><AdminProductsPage /></AdminRoute>} />
    <Route path="/admin/products/new" component={() => <AdminRoute title="Create product"><AdminProductForm /></AdminRoute>} />
    <Route path="/admin/products/:id" component={() => { const p = useParams<{ id: string }>(); return <AdminRoute title="Edit product"><AdminProductForm productId={p.id} /></AdminRoute>; }} />
    <Route path="/sign-in/*?"><AuthRoutes /></Route>
    <Route path="/sign-up/*?"><AuthRoutes /></Route>
    <Route component={NotFound} />
  </Switch><span className="sr-only" aria-live="polite" data-testid="text-current-route">{location}</span></div>;
}

function ClerkRoutedApp() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to))}><Router /></ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ClerkRoutedApp /></WouterRouter></QueryClientProvider>;
}

export default App;
