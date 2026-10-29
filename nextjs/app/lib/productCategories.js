/**
 * Standard Multi-Level E-Commerce Category Hierarchy
 * Modeled after Pathao Commerce, Daraz, Amazon, and Bangladeshi retail categories.
 */
export const CATEGORY_TREE = [
  {
    name: "Fashion & Apparel",
    children: [
      {
        name: "Men's Fashion",
        children: [
          {
            name: "Traditional Wear",
            children: [
              "Panjabi",
              "Pyjama",
              "Kabli Set",
              "Fotua",
              "Lungi",
              "Koti / Waistcoat",
            ],
          },
          {
            name: "Western Wear",
            children: [
              "T-Shirts",
              "Polo Shirts",
              "Casual Shirts",
              "Formal Shirts",
              "Jeans",
              "Chinos & Trousers",
              "Joggers & Sweatpants",
              "Hoodies & Sweatshirts",
              "Jackets & Coats",
              "Blazers & Suits",
              "Shorts",
            ],
          },
          {
            name: "Footwear",
            children: [
              "Sneakers",
              "Formal Shoes",
              "Loafers",
              "Sandals & Slippers",
              "Boots",
            ],
          },
          {
            name: "Accessories",
            children: [
              "Belts",
              "Wallets",
              "Watches",
              "Sunglasses",
              "Caps & Hats",
              "Ties & Cufflinks",
              "Socks",
            ],
          },
          {
            name: "Underwear & Loungewear",
            children: ["Boxers & Briefs", "Vests / Undershirts", "Nightwear"],
          },
        ],
      },
      {
        name: "Women's Fashion",
        children: [
          {
            name: "Traditional & Ethnic Wear",
            children: [
              "Saree",
              "Salwar Kameez",
              "Kurtis & Tunics",
              "Abaya & Borka",
              "Hijab & Scarf",
              "Lehenga",
              "Dupatta & Shawls",
              "Palazzos & Leggings",
            ],
          },
          {
            name: "Western Wear",
            children: [
              "Tops & Tees",
              "Shirts",
              "Dresses & Jumpsuits",
              "Jeans & Jeggings",
              "Trousers & Pants",
              "Skirts",
              "Jackets & Shrugs",
              "Hoodies & Sweatshirts",
            ],
          },
          {
            name: "Footwear",
            children: [
              "Flats & Sandals",
              "Heels",
              "Sneakers",
              "Wedges",
              "Slippers",
            ],
          },
          {
            name: "Bags & Accessories",
            children: [
              "Handbags",
              "Tote Bags",
              "Crossbody Bags",
              "Clutches & Purses",
              "Backpacks",
              "Watches",
              "Sunglasses",
            ],
          },
          {
            name: "Jewellery",
            children: [
              "Necklaces",
              "Earrings",
              "Rings",
              "Bracelets & Bangles",
              "Anklets",
              "Jewellery Sets",
            ],
          },
          {
            name: "Lingerie & Sleepwear",
            children: ["Bras", "Panties", "Nightwear & Robes", "Shapewear"],
          },
        ],
      },
      {
        name: "Kids & Baby Fashion",
        children: [
          {
            name: "Boys' Clothing",
            children: ["Panjabi & Ethnic", "T-Shirts & Shirts", "Pants & Shorts", "Winter Wear"],
          },
          {
            name: "Girls' Clothing",
            children: ["Frocks & Dresses", "Salwar Kameez", "Tops & Tees", "Skirts & Pants"],
          },
          {
            name: "Baby (0-24m)",
            children: ["Rompers & Bodysuits", "Baby Sets", "Baby Footwear", "Bibs & Mittens"],
          },
        ],
      },
    ],
  },
  {
    name: "Electronics & Gadgets",
    children: [
      {
        name: "Mobile Phones & Tablets",
        children: [
          "Smartphones",
          "Feature Phones",
          "Tablets & iPads",
        ],
      },
      {
        name: "Mobile Accessories",
        children: [
          "Cases & Covers",
          "Screen Protectors",
          "Power Banks",
          "Chargers & Adapters",
          "Cables & Converters",
          "Car Mounts & Holders",
          "Selfie Sticks & Gimbals",
        ],
      },
      {
        name: "Audio & Sound",
        children: [
          "Wireless Earbuds (TWS)",
          "Neckbands",
          "Wired Earphones",
          "Headphones",
          "Bluetooth Speakers",
          "Soundbars & Home Audio",
          "Microphones",
        ],
      },
      {
        name: "Smart Electronics & Wearables",
        children: [
          "Smartwatches",
          "Fitness Bands",
          "Smartwatch Straps",
          "VR & Smart Glasses",
        ],
      },
      {
        name: "Computers & Laptops",
        children: [
          "Laptops",
          "Desktop PCs",
          "Monitors",
          "Keyboards & Mice",
          "Storage (SSD, HDD, Pen Drives)",
          "Routers & Networking",
          "Printers & Scanners",
          "Computer Components (RAM, GPU)",
        ],
      },
      {
        name: "Cameras & Photography",
        children: [
          "DSLR & Mirrorless",
          "Action & Dash Cams",
          "Security & CCTV Cameras",
          "Tripods & Lighting",
          "Camera Accessories",
        ],
      },
      {
        name: "Gaming",
        children: [
          "Gaming Consoles",
          "Controllers & Gamepads",
          "Gaming Headsets",
          "Gaming Chairs",
          "Gaming Accessories",
        ],
      },
    ],
  },
  {
    name: "Home Appliances & Living",
    children: [
      {
        name: "Kitchen Appliances",
        children: [
          "Blenders & Grinders",
          "Rice Cookers",
          "Electric Kettles",
          "Microwaves & Ovens",
          "Induction & Gas Cookers",
          "Air Fryers",
          "Toasters & Sandwich Makers",
        ],
      },
      {
        name: "Large Home Appliances",
        children: [
          "Refrigerators & Freezers",
          "Air Conditioners (AC)",
          "Washing Machines",
          "Televisions (Smart TV)",
          "Water Purifiers",
          "Room Heaters",
          "Fans (Ceiling, Stand, Rechargeable)",
        ],
      },
      {
        name: "Kitchen & Dining",
        children: [
          "Cookware & Pots",
          "Dinnerware & Plates",
          "Cutlery & Knives",
          "Drinkware & Bottles",
          "Food Storage Containers",
        ],
      },
      {
        name: "Home Decor & Bedding",
        children: [
          "Bedsheets & Pillow Covers",
          "Blankets & Comforters",
          "Curtains & Blinds",
          "Carpets & Rugs",
          "Clocks & Wall Art",
          "Lighting & Lamps",
        ],
      },
      {
        name: "Furniture",
        children: [
          "Sofas & Couches",
          "Beds & Wardrobes",
          "Tables & Desks",
          "Chairs",
          "Shoe Racks & Shelves",
        ],
      },
    ],
  },
  {
    name: "Health, Beauty & Personal Care",
    children: [
      {
        name: "Skin Care",
        children: [
          "Face Wash & Cleansers",
          "Moisturizers & Creams",
          "Serums & Essences",
          "Sunscreen & Sun Care",
          "Face Masks & Peels",
          "Toners & Mists",
          "Lip Care",
        ],
      },
      {
        name: "Hair Care",
        children: [
          "Shampoo & Conditioner",
          "Hair Oils & Serums",
          "Hair Color & Dye",
          "Hair Styling (Gel, Wax, Spray)",
          "Hair Dryers & Straighteners",
        ],
      },
      {
        name: "Makeup & Cosmetics",
        children: [
          "Face Makeup (Foundation, Concealer)",
          "Eye Makeup (Mascara, Eyeliner, Kajal)",
          "Lipstick & Lip Gloss",
          "Nail Polish & Care",
          "Makeup Brushes & Sponges",
        ],
      },
      {
        name: "Fragrances & Perfumes",
        children: [
          "Men's Perfume & Cologne",
          "Women's Perfume",
          "Body Mist & Spray",
          "Attar & Halal Perfumes",
        ],
      },
      {
        name: "Personal Care & Grooming",
        children: [
          "Bath & Body Wash",
          "Deodorants & Roll-ons",
          "Shaving & Beard Grooming",
          "Trimmers & Shavers",
          "Oral Care (Toothbrush, Paste)",
          "Feminine Hygiene",
        ],
      },
      {
        name: "Health & Wellness",
        children: [
          "Vitamins & Supplements",
          "First Aid & Bandages",
          "BP Monitors & Thermometers",
          "Fitness Equipment",
        ],
      },
    ],
  },
  {
    name: "Groceries & Food",
    children: [
      {
        name: "Beverages",
        children: [
          "Tea & Coffee",
          "Juices & Soft Drinks",
          "Health Drinks & Powder",
          "Syrups & Squashes",
        ],
      },
      {
        name: "Snacks & Packaged Food",
        children: [
          "Biscuits & Cookies",
          "Chocolates & Candies",
          "Chips & Crisps",
          "Noodles & Pasta",
          "Nuts & Dry Fruits",
        ],
      },
      {
        name: "Cooking Essentials",
        children: [
          "Rice, Flour & Grains",
          "Edible Oils & Ghee",
          "Spices & Masalas",
          "Salt, Sugar & Sweeteners",
          "Sauces, Pickles & Honey",
        ],
      },
      {
        name: "Dairy & Bakery",
        children: ["Milk & Powder", "Butter & Cheese", "Bread & Bakery"],
      },
      {
        name: "Organic & Herbal Food",
        children: ["Organic Honey", "Chiya Seeds", "Herbal Tea", "Mustard Oil"],
      },
    ],
  },
  {
    name: "Automotive & Motorbike",
    children: [
      {
        name: "Car Electronics",
        children: [
          "Alarms & Security > Anti-theft Accessories",
          "Alarms & Security > Car Alarms & Immobilizers",
          "Alarms & Security > Keyless Entry & Remote Systems",
          "Audio & Speakers > Amplifiers & Equalizers",
          "Audio & Speakers > Car Stereos & Head Units",
          "Audio & Speakers > Microphones & Accessories",
          "Dash Cams & Reverse Cameras",
          "GPS Trackers & Navigators",
        ],
      },
      {
        name: "Car Accessories & Care",
        children: [
          "Seat Covers & Cushions",
          "Floor Mats & Sunshades",
          "Car Cleaning & Polish",
          "Air Fresheners & Purifiers",
          "Tire Inflators & Tools",
        ],
      },
      {
        name: "Motorbike Accessories",
        children: [
          "Helmets & Visors",
          "Riding Gear (Jackets, Gloves)",
          "Bike Locks & Security",
          "Bike Covers & Bags",
          "Bike Lights & Horns",
        ],
      },
      {
        name: "Oils, Fluids & Parts",
        children: [
          "Engine Oil",
          "Brake & Transmission Fluid",
          "Filters & Spark Plugs",
          "Batteries",
        ],
      },
    ],
  },
  {
    name: "Baby, Toys & Stationery",
    children: [
      {
        name: "Baby Care",
        children: [
          "Diapers & Wipes",
          "Baby Feeding & Bottles",
          "Baby Bath & Skincare",
          "Baby Strollers & Walkers",
        ],
      },
      {
        name: "Toys & Games",
        children: [
          "Action Figures & Dolls",
          "RC Toys & Drones",
          "Educational & Board Games",
          "Puzzles & Building Blocks",
          "Outdoor Play & Bicycles",
        ],
      },
      {
        name: "Books & Stationery",
        children: [
          "Books & Literature",
          "Religious & Islamic Books",
          "Office Supplies",
          "Pens, Pencils & Art Supplies",
          "Notebooks & Diaries",
        ],
      },
    ],
  },
  {
    name: "Sports, Fitness & Outdoor",
    children: [
      {
        name: "Fitness & Gym",
        children: ["Dumbbells & Weights", "Yoga Mats", "Resistance Bands", "Supplements"],
      },
      {
        name: "Outdoor Sports",
        children: [
          "Cricket Gear",
          "Football & Boots",
          "Badminton Rackets & Shuttles",
          "Bicycles & Cycling Accessories",
          "Camping & Hiking",
        ],
      },
    ],
  },
];

/**
 * Flattens the tree into a list of full path strings:
 * e.g. "Automotive & Motorbike > Car Electronics > Alarms & Security > Anti-theft Accessories"
 */
function buildFlatCategories(nodes, prefix = "") {
  let list = [];
  for (const node of nodes) {
    if (typeof node === "string") {
      const full = prefix ? `${prefix} > ${node}` : node;
      list.push(full);
    } else if (node && typeof node === "object") {
      const cur = prefix ? `${prefix} > ${node.name}` : node.name;
      if (node.children && node.children.length > 0) {
        list = list.concat(buildFlatCategories(node.children, cur));
      } else {
        list.push(cur);
      }
    }
  }
  return list;
}

export const FLAT_CATEGORIES = buildFlatCategories(CATEGORY_TREE);
