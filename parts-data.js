export const demoParts = [
  {
    partId: "EAS-1001",
    name: "Toyota Front Brake Pad Set",
    category: "Brakes",
    vehicle: "Toyota",
    price: 38,
    stock: "In Stock",
    imageUrl: "",
    description: "Reliable front brake pad set for Toyota models.",
    createdAt: new Date()
  },
  {
    partId: "EAS-1002",
    name: "Engine Oil 5L",
    category: "Fluids",
    vehicle: "Universal",
    price: 29,
    stock: "In Stock",
    imageUrl: "",
    description: "High quality engine oil for everyday maintenance.",
    createdAt: new Date()
  },
  {
    partId: "EAS-1003",
    name: "Outer CV Joint",
    category: "Suspension",
    vehicle: "Toyota",
    price: 52,
    stock: "Low Stock",
    imageUrl: "",
    description: "Durable outer CV joint assembly.",
    createdAt: new Date()
  },
  {
    partId: "EAS-1004",
    name: "Ignition Coil",
    category: "Electrical",
    vehicle: "Honda",
    price: 41,
    stock: "In Stock",
    imageUrl: "",
    description: "High-performance ignition coil unit.",
    createdAt: new Date()
  },
  {
    partId: "EAS-1005",
    name: "Water Pump",
    category: "Cooling",
    vehicle: "Nissan",
    price: 49,
    stock: "Order Ready",
    imageUrl: "",
    description: "Cooling system water pump for Nissan applications.",
    createdAt: new Date()
  },
  {
    partId: "EAS-1006",
    name: "2-Ton Hydraulic Jack",
    category: "Tools",
    vehicle: "Universal",
    price: 65,
    stock: "In Stock",
    imageUrl: "",
    description: "Workshop-grade hydraulic jack.",
    createdAt: new Date()
  }
];

export const categoryColorMap = {
  Brakes: "from-rose-500 to-red-700",
  Suspension: "from-blue-500 to-indigo-700",
  Electrical: "from-amber-400 to-orange-600",
  Cooling: "from-cyan-500 to-sky-700",
  Engine: "from-slate-600 to-slate-900",
  Fluids: "from-emerald-500 to-green-700",
  Tools: "from-violet-500 to-indigo-700",
  Emergency: "from-red-500 to-orange-500",
  Tyres: "from-zinc-600 to-zinc-900",
  Filters: "from-lime-500 to-emerald-700"
};

export function getCategoryGradient(category) {
  return categoryColorMap[category] || "from-blue-500 to-orange-500";
}
