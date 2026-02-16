import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useStripeProducts, useStripeSubscription, useCheckout, usePortalSession } from "@/hooks/use-stripe";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  Check, Loader2, Crown, Zap, Music, Disc, X,
  Sparkles, Scissors, Mic2, SlidersHorizontal, Upload,
  Volume2, Headphones, Shield, Globe
} from "lucide-react";

const FEATURE_COMPARISON = [
  { feature: "AI Music Generation", free: true, basic: true, pro: true, premium: true },
  { feature: "Credits per month", free: "12 (one-time)", basic: "1,000", pro: "1,500", premium: "3,500" },
  { feature: "AI Lyrics Generator", free: true, basic: true, pro: true, premium: true },
  { feature: "Basic Stem Separation", free: true, basic: true, pro: true, premium: true },
  { feature: "Advanced Stem Separation (Demucs)", free: false, basic: false, pro: true, premium: true },
  { feature: "AI Mastering", free: false, basic: false, pro: true, premium: true },
  { feature: "AI Denoise", free: false, basic: false, pro: true, premium: true },
  { feature: "Sample Lab", free: false, basic: false, pro: true, premium: true },
  { feature: "AI Cover Creation", free: false, basic: false, pro: true, premium: true },
  { feature: "Audio Trimming", free: true, basic: true, pro: true, premium: true },
  { feature: "Priority Processing", free: false, basic: false, pro: true, premium: true },
  { feature: "Custom Instrument Kits", free: false, basic: false, pro: false, premium: true },
  { feature: "AI Training (Your Sounds)", free: false, basic: false, pro: false, premium: true },
  { feature: "Credit Top-Ups", free: false, basic: true, pro: true, premium: true },
  { feature: "Commercial License", free: false, basic: false, pro: false, premium: true },
  { feature: "Priority Support", free: false, basic: false, pro: false, premium: true },
  { feature: "100% Rights (Royalty Free)", free: false, basic: true, pro: true, premium: true },
  { feature: "Annual Discount", free: "-", basic: "2%", pro: "5%", premium: "10%" },
];

const FALLBACK_PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Get started with AI music creation. 12 credits included to explore the platform.",
    tier: "free",
    price: 0,
    annualDiscount: 0,
    priceId: null,
    features: [
      "12 credits (one-time)",
      "AI music generation",
      "Basic stem separation",
      "AI lyrics generator",
      "Audio trimming",
    ],
    icon: Music,
    order: 0,
    color: "text-blue-400",
  },
  {
    id: "basic",
    name: "Basic",
    description: "Essential tools for aspiring music creators. 1,000 credits monthly.",
    tier: "basic",
    price: 699,
    annualDiscount: 2,
    priceId: null,
    annualPriceId: null,
    features: [
      "1,000 credits/month",
      "AI music generation",
      "Stem separation",
      "AI lyrics generator",
      "Credit top-ups available",
      "100% rights (Royalty Free)",
    ],
    icon: Zap,
    order: 1,
    color: "text-green-400",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Professional tools for serious music creators. 1,500 credits monthly.",
    tier: "pro",
    price: 1499,
    annualDiscount: 5,
    priceId: null,
    annualPriceId: null,
    features: [
      "1,500 credits/month",
      "Everything in Basic",
      "Advanced stem separation (Demucs AI)",
      "AI mastering & denoise",
      "Sample Lab (record, upload, remix)",
      "Priority processing",
      "Credit top-ups available",
      "100% rights (Royalty Free)",
    ],
    icon: Disc,
    order: 2,
    color: "text-yellow-400",
  },
  {
    id: "premium",
    name: "Premium",
    description: "Full access to every tool. 3,500 credits, custom AI training, commercial license.",
    tier: "premium",
    price: 2999,
    annualDiscount: 10,
    priceId: null,
    annualPriceId: null,
    features: [
      "3,500 credits/month",
      "Everything in Pro",
      "Custom instrument kits",
      "AI training for your sounds",
      "Commercial use license",
      "Priority support",
      "Credit top-ups available",
      "100% rights (Royalty Free)",
    ],
    icon: Crown,
    order: 3,
    color: "text-amber-400",
  },
];

function formatPrice(amount: number) {
  return `$${(amount / 100).toFixed(2)}`;
}

function parsePlans(products: any[] | undefined) {
  if (!products || products.length === 0) return FALLBACK_PLANS;

  return products
    .map((product: any) => {
      const tier = product.metadata?.tier || product.name?.toLowerCase() || "free";
      const featuresStr = product.metadata?.features || "";
      const features = featuresStr ? featuresStr.split(",").map((f: string) => f.trim()) : [];
      const prices = product.prices || [];
      const monthlyPrice = prices.find((p: any) => p.interval === "month") || prices[0];
      const annualPrice = prices.find((p: any) => p.interval === "year");
      const fallback = FALLBACK_PLANS.find((p) => p.tier === tier);

      const iconMap: Record<string, any> = { free: Music, basic: Zap, pro: Disc, premium: Crown };
      const colorMap: Record<string, string> = {
        free: "text-blue-400",
        basic: "text-green-400",
        pro: "text-yellow-400",
        premium: "text-amber-400",
      };

      const discountMap: Record<string, number> = { free: 0, basic: 2, pro: 5, premium: 10 };
      const annualDiscount = parseInt(product.metadata?.annualDiscount || "0", 10) || discountMap[tier] || (fallback as any)?.annualDiscount || 0;

      return {
        id: product.id,
        name: product.name,
        description: product.description || fallback?.description || "",
        tier,
        price: monthlyPrice?.unitAmount || fallback?.price || 0,
        priceId: monthlyPrice?.id || null,
        annualPrice: annualPrice?.unitAmount || null,
        annualPriceId: annualPrice?.id || null,
        annualDiscount,
        features: features.length > 0 ? features : fallback?.features || [],
        icon: iconMap[tier] || Music,
        order: parseInt(product.metadata?.order || "0", 10) || fallback?.order || 0,
        color: colorMap[tier] || "text-blue-400",
      };
    })
    .sort((a: any, b: any) => a.order - b.order);
}

export default function PricingPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const { data: products, isLoading: productsLoading } = useStripeProducts();
  const { data: subscription } = useStripeSubscription();
  const checkout = useCheckout();
  const portal = usePortalSession();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (params.get("success") === "true") {
      toast({ title: "Subscription activated!", description: "Welcome to your new plan." });
    }
    if (params.get("canceled") === "true") {
      toast({ title: "Checkout canceled", description: "No changes were made to your subscription.", variant: "destructive" });
    }
  }, []);

  const plans = parsePlans(products);
  const currentTier = subscription?.tier || "free";
  const hasActiveSubscription = subscription?.subscription?.status === "active";

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="pricing-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8" data-testid="pricing-page">
      <div className="text-center space-y-3">
        <Badge className="bg-primary/10 text-primary border-primary/20">Pricing</Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-pricing-title">
          {t('pricing.title')}
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          {t('pricing.subtitle')}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant={billingInterval === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingInterval("monthly")}
            data-testid="button-billing-monthly"
          >
            {t('pricing.monthly')}
          </Button>
          <Button
            variant={billingInterval === "annual" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingInterval("annual")}
            data-testid="button-billing-annual"
          >
            {t('pricing.yearly')}
            <Badge className="ml-1.5 text-[10px] bg-green-500 text-white">{t('landing.save')} 2-10%</Badge>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan: any) => {
          const isCurrentPlan = currentTier === plan.tier;
          const isPopular = plan.tier === "premium";
          const IconComp = plan.icon;
          const discount = plan.annualDiscount || 0;
          const hasStripeAnnual = !!plan.annualPrice;
          const annualMonthlyPrice = hasStripeAnnual
            ? Math.round(plan.annualPrice / 12)
            : plan.price > 0 ? Math.round(plan.price * (1 - discount / 100)) : 0;
          const annualTotalPrice = hasStripeAnnual ? plan.annualPrice : annualMonthlyPrice * 12;
          const showAnnual = billingInterval === "annual" && plan.price > 0;
          const displayPrice = showAnnual ? annualMonthlyPrice : plan.price;
          const activePriceId = showAnnual && plan.annualPriceId ? plan.annualPriceId : plan.priceId;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${isPopular ? "border-primary/50 shadow-lg shadow-primary/10" : ""}`}
              data-testid={`card-plan-${plan.tier}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-black font-semibold" data-testid="badge-popular">
                    {t('common.mostPopular')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className={`mx-auto mb-3 p-3 rounded-lg bg-white/5`}>
                  <IconComp className={`h-6 w-6 ${plan.color}`} />
                </div>
                <CardTitle className="text-lg flex items-center justify-center gap-2 flex-wrap">
                  {plan.name}
                  {isCurrentPlan && (
                    <Badge variant="secondary" data-testid={`badge-current-${plan.tier}`}>
                      {t('pricing.currentPlan')}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs min-h-[2.5rem]">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="text-center">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold" data-testid={`text-price-${plan.tier}`}>{t('common.free')}</span>
                  ) : (
                    <div data-testid={`text-price-${plan.tier}`}>
                      <span className="text-3xl font-bold">{formatPrice(displayPrice)}</span>
                      <span className="text-muted-foreground text-sm">{t('common.perMonth')}</span>
                      {showAnnual && discount > 0 && (
                        <p className="text-xs text-green-400 mt-1">
                          {formatPrice(annualTotalPrice)}{t('landing.perYear')} ({discount}% off)
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-2">
                {isCurrentPlan && hasActiveSubscription ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                    data-testid={`button-manage-${plan.tier}`}
                  >
                    {portal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t('pricing.manage')}
                  </Button>
                ) : isCurrentPlan && plan.tier === "free" ? (
                  <Button variant="outline" className="w-full" disabled data-testid={`button-current-${plan.tier}`}>
                    {t('pricing.currentPlan')}
                  </Button>
                ) : activePriceId ? (
                  <Button
                    className={`w-full ${isPopular ? "bg-primary text-black" : ""}`}
                    onClick={() => checkout.mutate({ priceId: activePriceId })}
                    disabled={checkout.isPending}
                    data-testid={`button-subscribe-${plan.tier}`}
                  >
                    {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t('pricing.subscribe')}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled data-testid={`button-subscribe-${plan.tier}`}>
                    {plan.tier === "free" ? t('pricing.currentPlan') : t('pricing.comingSoon')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-center">
        <Button
          variant="ghost"
          onClick={() => setShowComparison(!showComparison)}
          data-testid="button-toggle-comparison"
          className="text-primary"
        >
          {showComparison ? t('pricing.hideComparison') : t('pricing.showComparison')}
        </Button>
      </div>

      {showComparison && (
        <div className="overflow-x-auto rounded-xl border border-white/10" data-testid="table-comparison">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left p-3 font-semibold">Feature</th>
                <th className="text-center p-3 font-semibold">Free</th>
                <th className="text-center p-3 font-semibold">Basic</th>
                <th className="text-center p-3 font-semibold">Pro</th>
                <th className="text-center p-3 font-semibold text-primary">Premium</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_COMPARISON.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3 text-muted-foreground">{row.feature}</td>
                  {(["free", "basic", "pro", "premium"] as const).map((tier) => (
                    <td key={tier} className="text-center p-3">
                      {typeof row[tier] === "boolean" ? (
                        row[tier] ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                        )
                      ) : (
                        <span className="text-xs font-medium">{row[tier]}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasActiveSubscription && subscription?.subscription && (
        <Card className="max-w-md mx-auto" data-testid="card-subscription-info">
          <CardContent className="p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Your subscription renews on{" "}
              <span className="text-foreground font-medium">
                {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </p>
            {subscription.subscription.cancelAtPeriodEnd && (
              <p className="text-xs text-destructive">
                Your subscription will be canceled at the end of the current period.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
