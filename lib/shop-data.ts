export interface Product {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  category: string
  inStock: boolean
  featured: boolean
}

export const products: Product[] = [
  {
    id: "1",
    name: "Espresso Cup - Ocean Blue",
    slug: "espresso-cup-ocean-blue",
    description: "A handcrafted espresso cup with a deep ocean blue glaze. Perfect for your morning ritual. Each cup is unique with subtle variations in the glaze pattern.",
    price: 450000,
    currency: "IDR",
    category: "Cups",
    inStock: true,
    featured: true,
  },
  {
    id: "2",
    name: "Tea Bowl - Matte White",
    slug: "tea-bowl-matte-white",
    description: "A serene tea bowl with our signature matte white glaze. The smooth finish and gentle curves make it ideal for contemplative tea moments.",
    price: 380000,
    currency: "IDR",
    category: "Bowls",
    inStock: true,
    featured: true,
  },
  {
    id: "3",
    name: "Coffee Mug - Earth Tone",
    slug: "coffee-mug-earth-tone",
    description: "A generous coffee mug with warm earth-toned glazes inspired by Bali's volcanic soil. Comfortable handle and perfectly weighted.",
    price: 520000,
    currency: "IDR",
    category: "Cups",
    inStock: true,
    featured: true,
  },
  {
    id: "4",
    name: "Matcha Bowl - Sage Green",
    slug: "matcha-bowl-sage-green",
    description: "A traditional-style matcha bowl (chawan) with a calming sage green glaze. Wide enough for whisking and shaped for comfortable holding.",
    price: 620000,
    currency: "IDR",
    category: "Bowls",
    inStock: true,
    featured: true,
  },
  {
    id: "5",
    name: "Pour Over Dripper",
    slug: "pour-over-dripper",
    description: "A handcrafted ceramic pour-over coffee dripper. Features spiral ridges for optimal extraction and a stable base.",
    price: 750000,
    currency: "IDR",
    category: "Coffee Gear",
    inStock: true,
    featured: false,
  },
  {
    id: "6",
    name: "Sake Set - Midnight",
    slug: "sake-set-midnight",
    description: "An elegant sake set including one tokkuri (carafe) and two ochoko (cups). Deep midnight glaze with subtle crystalline effects.",
    price: 980000,
    currency: "IDR",
    category: "Sets",
    inStock: true,
    featured: false,
  },
  {
    id: "7",
    name: "Breakfast Bowl - Speckled",
    slug: "breakfast-bowl-speckled",
    description: "A versatile breakfast bowl with a charming speckled finish. Perfect for oatmeal, yogurt, or small portions of rice.",
    price: 420000,
    currency: "IDR",
    category: "Bowls",
    inStock: false,
    featured: false,
  },
  {
    id: "8",
    name: "Tumbler - Raw Edge",
    slug: "tumbler-raw-edge",
    description: "A rustic tumbler featuring an unglazed raw edge at the rim. The contrast between smooth glaze and raw clay is striking.",
    price: 350000,
    currency: "IDR",
    category: "Cups",
    inStock: true,
    featured: false,
  },
  {
    id: "9",
    name: "Small Vase - Bud",
    slug: "small-vase-bud",
    description: "A delicate bud vase perfect for a single flower stem. Minimal design that lets the flower be the focus.",
    price: 280000,
    currency: "IDR",
    category: "Vases",
    inStock: true,
    featured: false,
  },
  {
    id: "10",
    name: "Serving Platter - Oval",
    slug: "serving-platter-oval",
    description: "An elegant oval serving platter with raised edges. Ideal for presenting appetizers or as a stunning centerpiece.",
    price: 890000,
    currency: "IDR",
    category: "Platters",
    inStock: true,
    featured: false,
  },
  {
    id: "11",
    name: "Espresso Cup Set - 4 Piece",
    slug: "espresso-cup-set-4",
    description: "A curated set of four espresso cups, each with a slightly different glaze variation. Perfect for hosting.",
    price: 1600000,
    currency: "IDR",
    category: "Sets",
    inStock: true,
    featured: false,
  },
  {
    id: "12",
    name: "Tea Pot - Minimalist",
    slug: "tea-pot-minimalist",
    description: "A beautifully proportioned teapot with clean lines and an integrated strainer. Holds approximately 500ml.",
    price: 1200000,
    currency: "IDR",
    category: "Tea Ware",
    inStock: false,
    featured: false,
  },
]

export const categories = [
  "All",
  "Cups",
  "Bowls",
  "Sets",
  "Coffee Gear",
  "Tea Ware",
  "Vases",
  "Platters",
]

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug)
}

export function getAllProducts(): Product[] {
  return products
}

export function getFeaturedProducts(): Product[] {
  return products.filter((product) => product.featured)
}

export function getProductsByCategory(category: string): Product[] {
  if (category === "All") return products
  return products.filter((product) => product.category === category)
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price)
}
