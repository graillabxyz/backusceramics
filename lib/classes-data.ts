export interface Workshop {
  id: string
  slug: string
  title: string
  subtitle: string
  price: number
  priceAlt?: { label: string; price: number }
  currency: string
  description: string
  level: string
  duration: string
  schedule?: string[]
  features: string[]
  available: boolean
  category: "workshop" | "residency" | "kids"
  maxParticipants?: number
  image?: string
}

export const workshops: Workshop[] = [
  {
    id: "beginner-wheel",
    slug: "beginner-wheel",
    title: "Beginner Wheel Single Day",
    subtitle: "Meeting with the soil",
    price: 650000,
    currency: "IDR",
    description: "For first-timers. Learn the basics of wheel throwing: centering, shaping, and making your first functional piece. No experience needed. A perfect introduction to the pottery wheel.",
    level: "Beginner",
    duration: "1 day (2 hours)",
    schedule: [
      "Monday - Friday: 10:00 - 12:00 PM",
      "Monday - Friday: 12:00 - 14:00 PM",
      "Saturday: 14:00 - 16:00 PM"
    ],
    features: [
      "Learn centering techniques",
      "Basic wheel throwing",
      "Create your first functional piece",
      "All materials included",
      "Pieces glazed and fired by studio",
      "Ready in ~2 weeks"
    ],
    available: true,
    category: "workshop",
    maxParticipants: 3,
    image: "/beginner_single_day.jpg"
  },
  {
    id: "handbuilding",
    slug: "handbuilding",
    title: "Handbuilding Single Day",
    subtitle: "By Hand",
    price: 500000,
    currency: "IDR",
    description: "All levels. A guided, theme-based class focused on texture, form, and working by hand. Playful, experimental, and different every session. No wheel required.",
    level: "All Levels",
    duration: "1 day (2 hours)",
    schedule: [
      "Monday - Friday: 14:00 - 16:00 PM"
    ],
    features: [
      "Focus on texture and form",
      "Work by hand techniques",
      "Playful and experimental",
      "Different theme every session",
      "All materials included",
      "Pieces glazed and fired by studio"
    ],
    available: true,
    category: "workshop",
    maxParticipants: 8,
    image: "/handbuilding.JPG"
  },
  {
    id: "3-day-workshop",
    slug: "3-day-workshop",
    title: "3 Days Workshop",
    subtitle: "Exploring Time and Clay",
    price: 2500000,
    currency: "IDR",
    description: "For beginners to intermediate. Each workshop focuses on one theme (bowls, sets, teapots, forms, etc.) Designed as a series you can return to and grow with over time. Develop your skills across multiple sessions.",
    level: "Beginner to Intermediate",
    duration: "3 days",
    schedule: [
      "Monday - Saturday: 10:00 - 12:00 PM"
    ],
    features: [
      "Theme-based learning",
      "Focus on bowls, sets, teapots, or forms",
      "Develop your skills over time",
      "Multiple pieces to take home",
      "All materials included",
      "Pieces glazed and fired by studio"
    ],
    available: true,
    category: "workshop",
    maxParticipants: 3,
    image: "/3day.jpg"
  },
  {
    id: "6-day-workshop",
    slug: "6-day-workshop",
    title: "6 Days Workshop",
    subtitle: "Deep Dive into Clay",
    price: 3500000,
    currency: "IDR",
    description: "For those ready to go deeper. An intensive week of focused practice and exploration. Build a cohesive body of work and develop your personal style with guidance.",
    level: "Beginner to Advanced",
    duration: "6 days",
    schedule: [
      "Monday - Saturday: 10:00 - 12:00 PM"
    ],
    features: [
      "Extended intensive learning",
      "Build a cohesive body of work",
      "Develop personal style",
      "Advanced techniques introduction",
      "All materials included",
      "Pieces glazed and fired by studio",
      "Portfolio-worthy pieces"
    ],
    available: true,
    category: "workshop",
    maxParticipants: 3,
    image: "/6day.jpg"
  },
  {
    id: "3-week-residency",
    slug: "3-week-residency",
    title: "3 Week Residency",
    subtitle: "Time, Depth and Process",
    price: 22000000,
    currency: "IDR",
    description: "The 3 week course residency offers a complete immersion into ceramics, from the very beginning of the process to the final firing. Participants learn the foundations of working with clay, alongside technical learning.",
    level: "All Levels",
    duration: "3 weeks",
    features: [
      "Complete immersion into ceramics",
      "From shaping to final firing",
      "Learn foundations of clay work",
      "Technical skill development",
      "Portfolio planning support",
      "Full studio access",
      "Personal mentorship",
      "Help with accommodation setup"
    ],
    available: true,
    category: "residency",
    maxParticipants: 1,
    image: "/3week.jpg"
  },
  {
    id: "6-week-residency",
    slug: "6-week-residency",
    title: "6 Week Residency",
    subtitle: "Time, Depth and Process",
    price: 40000000,
    currency: "IDR",
    description: "The 6 week course residency offers a complete immersion into ceramics, from the very beginning of the process to the final firing. Participants learn the foundations of working with clay, alongside technical learning.",
    level: "All Levels",
    duration: "6 weeks",
    features: [
      "Extended complete immersion",
      "Advanced techniques",
      "Multiple kiln firings",
      "Glaze formulation introduction",
      "Portfolio development",
      "Full studio access",
      "Personal mentorship",
      "Help with accommodation setup"
    ],
    available: true,
    category: "residency",
    maxParticipants: 1,
    image: "/6week.jpg"
  },
  {
    id: "kids-workshop",
    slug: "kids-workshop",
    title: "Kids & Family Workshop",
    subtitle: "Theme Sensory Play",
    price: 400000,
    priceAlt: { label: "Parent & Child", price: 500000 },
    currency: "IDR",
    description: "Every Saturday, we host kids' ceramic workshops designed as a playful and creative introduction to clay. Some sessions are dedicated only to children, while others invite parents and kids to create together. Changing theme every 2 weeks. Includes drink and snack.",
    level: "Kids & Families",
    duration: "1.5 hours",
    schedule: [
      "Saturday: 10:00 - 11:30 AM"
    ],
    features: [
      "Playful introduction to clay",
      "Kid-only or parent & child sessions",
      "Theme changes every 2 weeks",
      "Includes drink and snack",
      "Creative and sensory focused",
      "Pieces fired and ready for pickup"
    ],
    available: true,
    category: "kids",
    maxParticipants: 8,
    image: "/kidsclass.jpeg"
  }
]

export const studioInfo = {
  hours: {
    weekdays: "9:00 AM - 4:30 PM",
    saturday: "9:00 AM - 4:30 PM",
    sunday: "Closed"
  },
  policies: [
    "Pieces are glazed and fired by the studio",
    "Ready in approximately 2 weeks",
    "Pickup or shipping available",
    "Storage up to 3 months",
    "Class bookings are non-refundable within 7 days of the scheduled session",
    "Reschedule requests made 7 or more days in advance are subject to studio availability",
    "Classes can be held in Indonesian upon request"
  ],
  teachers: [
    {
      name: "Julian",
      role: "Lead Teacher",
      description: "Attentive and inspiring"
    }
  ],
  pets: ["Copper", "Dude"]
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(price)
}
