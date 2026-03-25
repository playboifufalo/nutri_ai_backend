export const mockProducts = [
  {
    id: "1",
    name: "Organic Banana",
    brand: "Fresh Farm",
    category: "Fruits",
    nutritional_info: {
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fat: 0.4,
      fiber: 3.1,
      sugar: 14.4,
      sodium: 1
    },
    allergens: [],
    ingredients: ["Organic Banana"],
    serving_size: "1 medium banana (118g)"
  },
  {
    id: "2", 
    name: "Whole Grain Bread",
    brand: "Baker's Choice",
    category: "Bakery",
    nutritional_info: {
      calories: 69,
      protein: 3.6,
      carbs: 12,
      fat: 1.2,
      fiber: 2,
      sugar: 1.5,
      sodium: 120
    },
    allergens: ["gluten", "wheat"],
    ingredients: ["Whole wheat flour", "Water", "Yeast", "Salt", "Sugar"],
    serving_size: "1 slice (28g)"
  },
  {
    id: "3",
    name: "Greek Yogurt",
    brand: "Dairy Fresh",
    category: "Dairy",
    nutritional_info: {
      calories: 100,
      protein: 17,
      carbs: 6,
      fat: 0,
      fiber: 0,
      sugar: 6,
      sodium: 65
    },
    allergens: ["milk"],
    ingredients: ["Cultured Grade A Nonfat Milk", "Live Active Cultures"],
    serving_size: "1 container (170g)"
  },
  {
    id: "4",
    name: "Almonds",
    brand: "Nut Co.",
    category: "Nuts & Seeds",
    nutritional_info: {
      calories: 579,
      protein: 21.2,
      carbs: 21.6,
      fat: 49.9,
      fiber: 12.5,
      sugar: 4.4,
      sodium: 1
    },
    allergens: ["tree nuts", "almonds"],
    ingredients: ["Raw Almonds"],
    serving_size: "1 oz (28g)"
  },
  {
    id: "5",
    name: "Quinoa",
    brand: "Ancient Grains",
    category: "Grains",
    nutritional_info: {
      calories: 368,
      protein: 14.1,
      carbs: 64.2,
      fat: 6.1,
      fiber: 7,
      sugar: 0,
      sodium: 5
    },
    allergens: [],
    ingredients: ["Organic Quinoa"],
    serving_size: "1/4 cup dry (43g)"
  }
];

export const mockScanHistory = [
  {
    id: "scan_1",
    user_id: 1,
    product_name: "Organic Banana",
    brand: "Fresh Farm",
    barcode: "1234567890123",
    scan_method: "barcode" as const,
    nutritional_info: {
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fat: 0.4,
      fiber: 3.1,
      sugar: 14.4,
      sodium: 1
    },
    allergens: [],
    ingredients: ["Organic Banana"],
    is_favorite: false,
    scanned_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    analysis_results: {}
  },
  {
    id: "scan_2",
    user_id: 1,
    product_name: "Greek Yogurt",
    brand: "Dairy Fresh",
    scan_method: "image" as const,
    nutritional_info: {
      calories: 100,
      protein: 17,
      carbs: 6,
      fat: 0,
      fiber: 0,
      sugar: 6,
      sodium: 65
    },
    allergens: ["milk"],
    ingredients: ["Cultured Grade A Nonfat Milk", "Live Active Cultures"],
    is_favorite: true,
    scanned_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    analysis_results: {}
  },
  {
    id: "scan_3",
    user_id: 1,
    product_name: "Almonds",
    brand: "Nut Co.",
    scan_method: "manual" as const,
    nutritional_info: {
      calories: 579,
      protein: 21.2,
      carbs: 21.6,
      fat: 49.9,
      fiber: 12.5,
      sugar: 4.4,
      sodium: 1
    },
    allergens: ["tree nuts", "almonds"],
    ingredients: ["Raw Almonds"],
    is_favorite: false,
    scanned_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    analysis_results: {}
  }
];