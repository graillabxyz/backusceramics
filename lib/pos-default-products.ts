import { workshops } from "@/lib/classes-data"

type DefaultPosProductKind = "class" | "fnb"

export interface DefaultPosProduct {
  kind: DefaultPosProductKind
  name: string
  slug: string
  sku: string
  description: string
  price: number
  category: string
  quantity: number
  status: "AVAILABLE" | "DRAFT"
  cafeOnly: boolean
  showInShop: boolean
}

const DEFAULT_SERVICE_QUANTITY = 9999

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function classDefaults(): DefaultPosProduct[] {
  return workshops
    .filter((workshop) => workshop.available)
    .flatMap((workshop) => {
      const base: DefaultPosProduct = {
        kind: "class",
        name: workshop.title,
        slug: `class-${workshop.id}`,
        sku: `CLASS-${workshop.id.toUpperCase()}`,
        description: `Site class offering: ${workshop.title}. ${workshop.duration}.`,
        price: workshop.price,
        category: "CLASSES",
        quantity: DEFAULT_SERVICE_QUANTITY,
        status: "AVAILABLE",
        cafeOnly: false,
        showInShop: false,
      }

      if (!workshop.priceAlt) return [base]

      return [
        base,
        {
          ...base,
          name: `${workshop.title} - ${workshop.priceAlt.label}`,
          slug: `class-${workshop.id}-${slugify(workshop.priceAlt.label)}`,
          sku: `CLASS-${workshop.id.toUpperCase()}-${slugify(workshop.priceAlt.label).toUpperCase()}`,
          description: `Site class offering: ${workshop.title}, ${workshop.priceAlt.label}. ${workshop.duration}.`,
          price: workshop.priceAlt.price,
        },
      ]
    })
}

const fnbNames = [
  "Apple Cinnamon Oats",
  "Poached Pear",
  "Chicken Sandwich",
  "Burrata Croissant",
  "Mangiare e Amore",
  "Julian's Scramble Egg",
  "Weekly Baked",
  "Coconut Flan",
  "Pastry",
  "Monthly Special",
  "Butter Dates",
  "Eggs Beni",
  "French Toast",
  "Turkish Egg",
  "Extra Burrata",
  "Whole Coconut Flan",
  "Sourdough Slice",
  "Extra 2 Egg",
  "Extra Bacon",
  "Milk Coffee",
  "Black Coffee",
  "Iced Coffee",
  "Manual Brew",
  "Chai Latte",
  "Matcha Latte",
  "Ceremony Grade Matcha",
  "Orange Juice",
  "Hibiscus Cooler",
  "Glass Cow Milk",
  "Jujube Tea",
  "Coconut Water",
  "Electrolytes Hydration",
  "Extra Vegetal Milk",
  "Extra Decaf",
  "Monday Special - Pastry",
  "Tuesday Special - Porridge",
  "Wednesday Special Burrata",
  "Thursday Special Baked",
  "Friday Special Julian Scramble",
]

function fnbDefaults(): DefaultPosProduct[] {
  return fnbNames.map((name) => ({
    kind: "fnb",
    name,
    slug: `fnb-${slugify(name)}`,
    sku: `FNB-${slugify(name).toUpperCase()}`,
    description: "Seeded from in-store POS reference. Add price and set available before selling.",
    price: 0,
    category: "F_AND_B",
    quantity: DEFAULT_SERVICE_QUANTITY,
    status: "DRAFT",
    cafeOnly: true,
    showInShop: false,
  }))
}

export function getDefaultPosProducts() {
  return [...classDefaults(), ...fnbDefaults()]
}
