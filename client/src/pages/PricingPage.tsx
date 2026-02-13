import { useEffect } from "react";
import { useSearch } from "wouter";
import { useStripeProducts, useStripeSubscription, useCheckout, usePortalSession } from "@/hooks/use-stripe";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Crown, Zap, Music } from "lucide-react";

const FALLBACK_PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Get started with basic music creation tools",
    tier: "free",
    price: 0,
    priceId: null,
    features: ["5 songs/month", "Basic stem separation", "AI lyrics"],
    icon: Music,
    order: 0,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Professional tools for serious creators",
    tier: "pro",
    price: 1499,
    priceId: null,
    features: ["50 songs/month", "Stem separation", "AI mastering", "Priority processing"],
    icon: Zap,
    order: 1,
  },
  {
    id: "premium",
    name: "Premium",
    description: "Unlimited access to the full DGB Audio suite",
    tier: "premium",
    price: 2999,
    priceId: null,
    features: ["Unlimited songs", "All AI tools", "Priority support", "Custom voice models", "Commercial license"],
    icon: Crown,
    order: 2,
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
      const price = product.prices?.[0];
      const fallback = FALLBACK_PLANS.find((p) => p.tier === tier);

      const iconMap: Record<string, any> = { free: Music, pro: Zap, premium: Crown };

      return {
        id: product.id,
        name: product.name,
        description: product.description || fallback?.description || "",
        tier,
        price: price?.unitAmount || fallback?.price || 0,
        priceId: price?.id || null,
        features: features.length > 0 ? features : fallback?.features || [],
        icon: iconMap[tier] || Music,
        order: parseInt(product.metadata?.order || "0", 10) || fallback?.order || 0,
      };
    })
    .sort((a: any, b: any) => a.order - b.order);
}

export default function PricingPage() {
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const { data: products, isLoading: productsLoading } = useStripeProducts();
  const { data: subscription } = useStripeSubscription();
  const checkout = useCheckout();
  const portal = usePortalSession();

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
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8" data-testid="pricing-page">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-pricing-title">Choose Your Plan</h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Unlock the full power of DGB Audio with a plan that fits your creative workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan: any) => {
          const isCurrentPlan = currentTier === plan.tier;
          const isPopular = plan.tier === "pro";
          const IconComp = plan.icon;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${isPopular ? "border-primary/50 shadow-lg shadow-primary/10" : ""}`}
              data-testid={`card-plan-${plan.tier}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-black font-semibold" data-testid="badge-popular">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 p-3 rounded-lg bg-primary/10">
                  <IconComp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg flex items-center justify-center gap-2 flex-wrap">
                  {plan.name}
                  {isCurrentPlan && (
                    <Badge variant="secondary" data-testid={`badge-current-${plan.tier}`}>
                      Current Plan
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="text-center">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold" data-testid={`text-price-${plan.tier}`}>Free</span>
                  ) : (
                    <div data-testid={`text-price-${plan.tier}`}>
                      <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
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
                    Manage Subscription
                  </Button>
                ) : isCurrentPlan && plan.tier === "free" ? (
                  <Button variant="outline" className="w-full" disabled data-testid={`button-current-${plan.tier}`}>
                    Current Plan
                  </Button>
                ) : plan.priceId ? (
                  <Button
                    className={`w-full ${isPopular ? "bg-primary text-black" : ""}`}
                    onClick={() => checkout.mutate({ priceId: plan.priceId })}
                    disabled={checkout.isPending}
                    data-testid={`button-subscribe-${plan.tier}`}
                  >
                    {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Subscribe
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled data-testid={`button-subscribe-${plan.tier}`}>
                    {plan.tier === "free" ? "Current Plan" : "Coming Soon"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

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
