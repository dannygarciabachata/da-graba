import { getUncachableStripeClient } from "../server/stripeClient";

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const plans = [
    {
      name: "DGB Free",
      description: "Basic access to DGB Audio music creation tools",
      metadata: { tier: "free", order: "1" },
      monthlyPrice: 0,
    },
    {
      name: "DGB Pro",
      description: "Enhanced music production with more generations, stems, and priority processing",
      metadata: { tier: "pro", order: "2", features: "50 songs/month,Stem separation,AI mastering,Priority processing" },
      monthlyPrice: 1499,
    },
    {
      name: "DGB Premium",
      description: "Unlimited access to all DGB Audio features with priority support",
      metadata: { tier: "premium", order: "3", features: "Unlimited songs,All AI tools,Priority support,Custom voice models,Commercial license" },
      monthlyPrice: 2999,
    },
  ];

  for (const plan of plans) {
    const existing = await stripe.products.search({ query: `name:'${plan.name}'` });
    if (existing.data.length > 0) {
      console.log(`${plan.name} already exists, skipping`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`Created product: ${product.id} (${plan.name})`);

    if (plan.monthlyPrice > 0) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: "usd",
        recurring: { interval: "month" },
      });
      console.log(`  Created price: ${price.id} ($${(plan.monthlyPrice / 100).toFixed(2)}/month)`);
    }
  }

  console.log("Done seeding products!");
}

seedProducts().catch(console.error);
