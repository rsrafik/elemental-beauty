// The full-lab content for the seeded Soap Bar lab — the copy from the
// mockups, so the materials, lesson and instruction tabs have something real
// to show.
//
// All three fields use the same plain-text format, which is what an officer
// will type into a box (see frontend/lib/labContent.js, which reads it):
//
//   # Section heading
//   - one item per line
//
// Instructions are the same shape: each heading is a part, each line a step.

export const SOAP_BAR_CONTENT = {
    ingredients: `# Oils & Fats
- Coconut oil - 230g
- Olive oil - 200g
- Palm oil - 150g
- Castor oil - 30g

# Lye Solution
- Sodium hydroxide (NaOH) - 85g
- Distilled water - 200ml

# Additives & Extras
- Fragrance or essential oil - 20-30ml
- Skin-safe colorant/mica powder - 1-2 tsp
- Sodium lactate - 5ml (speeds unmolding)
- Kaolin clay - 1 tbsp (adds slip)
- Exfoliant (oatmeal, coffee grounds, poppy seeds) - 2-3 tbsp

# Optional Extras
- Shea butter - 50g (extra moisturizing)
- Honey - 1 tbsp (humectant)
- Activated charcoal - 1 tsp (detoxifying bars)`,

    equipment: `# Measuring & Weighing
- Digital kitchen scale (0.1g precision)
- Measuring cups (heat-resistant)
- Measuring spoons

# Mixing & Processing
- Stick/immersion blender
- Stainless steel or high-density polyethylene (HDPE) mixing bowls (x2 - one for lye, one for oils)
- Silicone spatulas (x2-3)
- Whisk
- Long-handled stainless steel spoon

# Heating
- Microwave or double boiler/hot plate
- Infrared or probe thermometer (x2 — one per bowl)

# Molding
- Silicone loaf mold or individual cavity molds
- Soap cutter or sharp knife
- Cutting board`,

    instructions: `# Prepare Your Lye Solution
- Place your heat-resistant bowl on the digital scale and tare it to zero.
- Carefully measure out 85g of sodium hydroxide (NaOH) and set aside.
- Measure 200ml of distilled water into a separate heat-resistant bowl.
- Slowly add the NaOH to the water (never the reverse) while stirring with a stainless steel spoon.
- The solution will heat rapidly to ~80°C - this is normal. Stir until fully dissolved.
- Set aside to cool to 40-45°C, monitoring with a thermometer.

# Prepare Your Oils
- Measure out 230g coconut oil, 150g palm oil, and 50g shea butter into a stainless steel bowl.
- Melt together using a double boiler or microwave in short 30-second bursts, stirring between each.
- Once melted, add 200g olive oil and 30g castor oil and stir to combine.
- Allow the oil mixture to cool to 40-45°C, monitoring with a thermometer.

# Combine & Reach Trace
- Once both the lye solution and oil mixture are within 5-10°C of each other, slowly pour the lye solution into the oils (not the reverse).
- Stir gently with a spatula to begin combining.
- Insert the immersion blender and blend in short 5-10 second bursts, alternating with hand stirring.
- Continue until the mixture reaches trace — a thick, pudding-like consistency that holds a drizzle pattern on the surface.

# Add Extras
- Add 20-30ml of your chosen essential oil or fragrance and stir in thoroughly with a spatula.`
}

export const SOAP_BAR_LESSON_FILE = 'soap-bar-lesson.pdf'
