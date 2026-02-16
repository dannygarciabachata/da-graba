import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import {
  Play,
  Pause,
  Heart,
  UserPlus,
  UserCheck,
  Users,
  Music,
  Headphones,
  ArrowLeft,
  CheckCircle,
  Crown,
  Globe,
  MapPin,
  Share2,
  Gift,
  DollarSign,
  Loader2,
  X,
  CreditCard,
  MessageCircle,
  ThumbsUp,
  Send,
  Youtube,
  Disc,
  ExternalLink,
  Trash2,
} from "lucide-react";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const GIFT_AMOUNTS = [100, 300, 500, 1000, 2500, 5000];

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    stripePromise = fetch("/api/stripe/publishable-key")
      .then((r) => r.json())
      .then(({ publishableKey }) => loadStripe(publishableKey))
      .catch(() => null);
  }
  return stripePromise;
}

export default function ArtistProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/artist/:id");
  const artistId = Number(params?.id);

  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const [showGiftForm, setShowGiftForm] = useState(false);
  const [giftAmount, setGiftAmount] = useState(300);
  const [customAmount, setCustomAmount] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [fanName, setFanName] = useState("");
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const { data: artist, isLoading } = useQuery<any>({
    queryKey: ["/api/public/artists", artistId],
    queryFn: async () => {
      const res = await fetch(`/api/public/artists/${artistId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!artistId,
  });

  const { data: giftSummary } = useQuery<any>({
    queryKey: ["/api/public/artists", artistId, "gifts-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/public/artists/${artistId}/gifts-summary`);
      return res.json();
    },
    enabled: !!artistId,
  });

  const { data: likesData } = useQuery<any>({
    queryKey: ["/api/public/artists", artistId, "likes"],
    queryFn: async () => {
      const res = await fetch(`/api/public/artists/${artistId}/likes`);
      return res.json();
    },
    enabled: !!artistId,
  });

  const { data: comments, refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["/api/public/artists", artistId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/public/artists/${artistId}/comments`);
      return res.json();
    },
    enabled: !!artistId,
  });

  const { data: sharesData } = useQuery<any>({
    queryKey: ["/api/public/artists", artistId, "shares"],
    queryFn: async () => {
      const res = await fetch(`/api/public/artists/${artistId}/shares`);
      return res.json();
    },
    enabled: !!artistId,
  });

  const { data: discographyAlbums } = useQuery<any[]>({
    queryKey: ["/api/public/discography", artistId],
    queryFn: async () => {
      const res = await fetch(`/api/public/discography/${artistId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.albums || [];
    },
    enabled: !!artistId,
  });

  useEffect(() => {
    if (!showGiftForm || !cardContainerRef.current) return;
    let mounted = true;
    let cardEl: StripeCardElement | null = null;

    (async () => {
      const stripe = await getStripe();
      if (!stripe || !mounted || !cardContainerRef.current) return;
      const elements = stripe.elements();
      cardEl = elements.create("card", {
        style: {
          base: {
            color: "#ffffff",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
            "::placeholder": { color: "#6b7280" },
          },
          invalid: { color: "#ef4444" },
        },
      });
      cardEl.mount(cardContainerRef.current);
      cardEl.on("ready", () => { if (mounted) setCardReady(true); });
      cardElementRef.current = cardEl;
    })();

    return () => {
      mounted = false;
      if (cardEl) {
        cardEl.unmount();
        cardEl.destroy();
      }
      cardElementRef.current = null;
      setCardReady(false);
    };
  }, [showGiftForm]);

  const giftMutation = useMutation({
    mutationFn: async () => {
      const amountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : giftAmount;
      if (amountCents < 100 || amountCents > 100000) throw new Error("Invalid amount");
      if (!cardElementRef.current) throw new Error("Card not ready");

      const stripe = await getStripe();
      if (!stripe) throw new Error("Payment system not available");

      const res = await apiRequest("POST", `/api/artists/${artistId}/gift`, {
        amountCents,
        message: giftMessage || null,
        fanDisplayName: fanName || (user ? "Fan" : "Anonymous"),
      });
      const data = await res.json();

      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElementRef.current },
      });

      if (error) throw new Error(error.message);

      if (paymentIntent?.status === "succeeded") {
        const confirmRes = await apiRequest("POST", `/api/gifts/${data.gift.id}/confirm`, {
          paymentIntentId: paymentIntent.id,
        });
        return confirmRes.json();
      }

      throw new Error("Payment not completed");
    },
    onSuccess: () => {
      toast({ title: t('artist.gift.success') });
      setShowGiftForm(false);
      setGiftMessage("");
      setCustomAmount("");
      setFanName("");
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId, "gifts-summary"] });
    },
    onError: (err: any) => {
      toast({ title: t('artist.gift.error'), description: err.message, variant: "destructive" });
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/artists/${artistId}/follow`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId] });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/artists/${artistId}/subscribe`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId] });
      toast({ title: t('artist.profile.subscribed') });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/artists/${artistId}/like`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId, "likes"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/artists/${artistId}/comments`, { content: commentText });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId, "comments"] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/artists/${artistId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId, "comments"] });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (platform: string) => {
      await apiRequest("POST", `/api/artists/${artistId}/share`, { platform });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/artists", artistId, "shares"] });
    },
  });

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out ${artist?.artistName} on DGB Studio!`;
    
    if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: t('artist.profile.linkCopied') });
    }
    shareMutation.mutate(platform);
  };

  const handlePreviewTrack = (track: any) => {
    if (!track.previewUrl) return;
    if (playingTrackId === track.spotifyTrackId) {
      previewAudioRef.current?.pause();
      setPlayingTrackId(null);
      return;
    }
    if (previewAudioRef.current) previewAudioRef.current.pause();
    const audio = new Audio(track.previewUrl);
    audio.play();
    previewAudioRef.current = audio;
    setPlayingTrackId(track.spotifyTrackId);
    audio.addEventListener("ended", () => setPlayingTrackId(null));
  };

  const handlePlay = (song: any) => {
    if (!song.audioUrl) return;
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        audioElRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioElRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    const audio = new Audio(song.audioUrl);
    audio.play();
    audioElRef.current = audio;
    setCurrentSong(song);
    setIsPlaying(true);
    audio.addEventListener("ended", () => setIsPlaying(false));
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
          <div className="h-32 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="h-full overflow-auto flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{t('artist.profile.notFound')}</p>
          <Button variant="ghost" onClick={() => setLocation("/discover")} className="mt-3">
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('discover.backToDiscover')}
          </Button>
        </div>
      </div>
    );
  }

  const activeAmount = customAmount ? Math.round(parseFloat(customAmount) * 100) : giftAmount;

  return (
    <div className="h-full overflow-auto">
      <div className="relative h-48 bg-gradient-to-br from-primary/30 to-purple-600/30 overflow-hidden">
        {artist.bannerUrl && (
          <img src={artist.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={() => setLocation("/discover")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('discover.backToDiscover')}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 -mt-16 relative z-10">
        <div className="flex items-end gap-5 mb-6">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-purple-600 border-4 border-background flex items-center justify-center overflow-hidden flex-shrink-0">
            {artist.avatarUrl ? (
              <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="h-12 w-12 text-white" />
            )}
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold" data-testid="text-artist-name">{artist.artistName}</h1>
              {artist.isVerified && <CheckCircle className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {artist.genre && <Badge variant="outline" className="text-xs">{artist.genre}</Badge>}
              {artist.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {artist.country}
                </span>
              )}
              {artist.proEntity && artist.proEntity !== "none" && (
                <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                  {artist.proEntity.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-4 text-sm text-muted-foreground mr-auto">
            <span data-testid="text-follower-count"><strong className="text-foreground">{formatCount(artist.followerCount || 0)}</strong> {t('artist.profile.followers')}</span>
            <span data-testid="text-subscriber-count"><strong className="text-foreground">{formatCount(artist.subscriberCount || 0)}</strong> {t('artist.profile.subscribers')}</span>
            <span><strong className="text-foreground">{artist.songs?.length || 0}</strong> {t('artist.profile.songs')}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => user ? likeMutation.mutate() : toast({ title: t('artist.profile.loginToLike'), variant: "destructive" })}
              className={`gap-1 ${likesData?.userIds?.includes(user?.id) ? "text-pink-400" : ""}`}
              data-testid="button-like-profile"
            >
              <ThumbsUp className={`h-4 w-4 ${likesData?.userIds?.includes(user?.id) ? "fill-pink-400" : ""}`} />
              {likesData?.count || 0}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="gap-1"
              data-testid="button-toggle-comments"
            >
              <MessageCircle className="h-4 w-4" />
              {comments?.length || 0}
            </Button>

            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => handleShare("twitter")} className="px-2" data-testid="button-share-twitter">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleShare("whatsapp")} className="px-2" data-testid="button-share-whatsapp">
                <Globe className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleShare("link")} className="px-2" data-testid="button-share-link">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground ml-1">{sharesData?.count || 0}</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="border-pink-500/40 text-pink-400 hover:bg-pink-500/10"
            onClick={() => setShowGiftForm(!showGiftForm)}
            data-testid="button-send-gift"
          >
            <Gift className="h-4 w-4 mr-1" />
            {t('artist.gift.sendGift')}
          </Button>

          {user && (
            <>
              <Button
                variant={artist.isFollowing ? "secondary" : "outline"}
                size="sm"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                data-testid="button-follow"
              >
                {artist.isFollowing ? <UserCheck className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                {artist.isFollowing ? t('artist.profile.following') : t('artist.profile.follow')}
              </Button>
              {!artist.isSubscribed ? (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-primary to-purple-600"
                  onClick={() => subscribeMutation.mutate()}
                  disabled={subscribeMutation.isPending}
                  data-testid="button-subscribe"
                >
                  <Crown className="h-4 w-4 mr-1" />
                  {t('artist.profile.subscribe')} · ${((artist.monthlySubscriptionPrice || 299) / 100).toFixed(2)}/mo
                </Button>
              ) : (
                <Badge className="bg-primary/20 text-primary">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('artist.profile.subscribedBadge')}
                </Badge>
              )}
            </>
          )}
        </div>

        {showGiftForm && (
          <Card className="bg-gradient-to-br from-pink-500/10 to-purple-600/10 border-pink-500/20 p-5 mb-6" data-testid="gift-form">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-400" />
                {t('artist.gift.title', { name: artist.artistName })}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowGiftForm(false)} data-testid="button-close-gift">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {GIFT_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  variant={giftAmount === amt && !customAmount ? "default" : "outline"}
                  size="sm"
                  className={giftAmount === amt && !customAmount ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}
                  onClick={() => { setGiftAmount(amt); setCustomAmount(""); }}
                  data-testid={`button-gift-${amt}`}
                >
                  ${(amt / 100).toFixed(0)}
                </Button>
              ))}
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('artist.gift.customAmount')}</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="1.00 - 1,000.00"
                    className="pl-8"
                    data-testid="input-custom-amount"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('artist.gift.yourName')}</label>
                <Input
                  value={fanName}
                  onChange={(e) => setFanName(e.target.value)}
                  placeholder={t('artist.gift.anonymous')}
                  data-testid="input-fan-name"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('artist.gift.message')}</label>
                <Input
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder={t('artist.gift.messagePlaceholder')}
                  maxLength={200}
                  data-testid="input-gift-message"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {t('artist.gift.cardDetails')}
                </label>
                <div
                  ref={cardContainerRef}
                  className="bg-white/[0.05] border border-white/10 rounded-md px-3 py-3 min-h-[40px]"
                  data-testid="stripe-card-element"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">{t('artist.gift.total')}:</span>{" "}
                <span className="text-lg font-bold text-pink-400">
                  ${(activeAmount / 100).toFixed(2)}
                </span>
              </div>
              <Button
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                onClick={() => giftMutation.mutate()}
                disabled={giftMutation.isPending || activeAmount < 100 || activeAmount > 100000 || !cardReady}
                data-testid="button-confirm-gift"
              >
                {giftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4 mr-2" />
                )}
                {t('artist.gift.sendButton')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              {t('artist.gift.feeNote')}
            </p>
          </Card>
        )}

        {giftSummary && giftSummary.totalGifts > 0 && (
          <Card className="bg-white/[0.03] border-white/[0.06] p-4 mb-6" data-testid="gift-summary">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-4 w-4 text-pink-400" />
              <span className="text-sm font-medium">{t('artist.gift.recentGifts')}</span>
              <Badge variant="outline" className="text-xs text-pink-400 border-pink-400/30">
                {giftSummary.totalGifts} {t('artist.gift.gifts')}
              </Badge>
            </div>
            <div className="space-y-2">
              {giftSummary.recentGifts?.map((g: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <Heart className="h-3 w-3 text-pink-400 flex-shrink-0" />
                  <span className="font-medium">{g.fanDisplayName || "Anonymous"}</span>
                  <span className="text-pink-400 font-mono">${(g.amountCents / 100).toFixed(2)}</span>
                  {g.message && <span className="text-muted-foreground truncate">— {g.message}</span>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {artist.bio && (
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{artist.bio}</p>
        )}

        {showComments && (
          <Card className="bg-white/[0.03] border-white/[0.06] p-5 mb-6" data-testid="comments-section">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <MessageCircle className="h-4 w-4 text-primary" />
              {t('artist.profile.comments')} ({comments?.length || 0})
            </h3>
            
            {user && (
              <div className="flex gap-2 mb-4">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('artist.profile.writeComment')}
                  className="bg-white/[0.05] border-white/10 min-h-[60px] resize-none"
                  maxLength={500}
                  data-testid="input-comment"
                />
                <Button
                  size="sm"
                  onClick={() => commentMutation.mutate()}
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="self-end"
                  data-testid="button-post-comment"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {comments && comments.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {c.userAvatarUrl ? (
                        <img src={c.userAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{(c.userName || "F")[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.userName || "Fan"}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
                        </span>
                        {user && (c.userId === user.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-red-400"
                            onClick={() => deleteCommentMutation.mutate(c.id)}
                            data-testid={`button-delete-comment-${c.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t('artist.profile.noComments')}</p>
            )}
          </Card>
        )}

        {artist.youtubeUrls && artist.youtubeUrls.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3" data-testid="text-youtube-title">
              <Youtube className="h-5 w-5 text-red-500" />
              Videos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {artist.youtubeUrls.map((url: string, idx: number) => {
                const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?/]+)/)?.[1];
                if (!videoId) return null;
                return (
                  <div key={idx} className="aspect-video rounded-lg overflow-hidden bg-black" data-testid={`youtube-embed-${idx}`}>
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      className="w-full h-full"
                      allowFullScreen
                      title={`Video ${idx + 1}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3" data-testid="text-songs-title">
            <Music className="h-5 w-5 text-primary" />
            {t('artist.profile.discography')}
          </h2>
        </div>

        {artist.songs?.length > 0 ? (
          <div className="space-y-1 mb-8">
            {artist.songs.map((song: any, idx: number) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group ${isCurrent ? "bg-white/[0.06]" : ""}`}
                  data-testid={`row-song-${song.id}`}
                >
                  <span className="text-sm font-mono text-muted-foreground w-6 text-right">{idx + 1}</span>
                  <div
                    className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 cursor-pointer"
                    onClick={() => handlePlay(song)}
                    data-testid={`button-play-${song.id}`}
                  >
                    {song.imageUrl ? (
                      <img src={song.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {isCurrent && isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white fill-white" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>{song.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{song.genre || "---"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Headphones className="h-3 w-3" />
                    {formatCount(song.playCount || 0)}
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{formatDuration(song.duration)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t('artist.profile.noSongs')}</p>
          </div>
        )}

        {discographyAlbums && discographyAlbums.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3" data-testid="text-albums-title">
              <Disc className="h-5 w-5 text-primary" />
              {t('artist.profile.albums')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {discographyAlbums.map((album: any) => (
                <Card key={album.id} className="bg-white/[0.03] border-white/[0.06] overflow-hidden group" data-testid={`album-card-${album.id}`}>
                  <div className="aspect-square relative overflow-hidden">
                    {album.coverImageUrl ? (
                      <img src={album.coverImageUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                        <Disc className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate">{album.title}</h3>
                    <p className="text-xs text-muted-foreground">{album.releaseDate?.split("-")[0] || ""} · {album.albumType}</p>
                    {album.spotifyUrl && (
                      <a href={album.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:underline mt-1 inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Spotify
                      </a>
                    )}
                  </div>
                  {album.tracks && album.tracks.length > 0 && (
                    <div className="border-t border-white/[0.06] px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
                      {album.tracks.map((track: any) => (
                        <div
                          key={track.id}
                          className={`flex items-center gap-2 text-xs py-1 cursor-pointer hover:text-primary transition-colors ${playingTrackId === track.spotifyTrackId ? "text-primary" : "text-muted-foreground"}`}
                          onClick={() => handlePreviewTrack(track)}
                          data-testid={`track-row-${track.id}`}
                        >
                          <span className="w-4 text-right">{track.trackNumber}</span>
                          {track.previewUrl ? (
                            playingTrackId === track.spotifyTrackId ? (
                              <Pause className="h-3 w-3 flex-shrink-0" />
                            ) : (
                              <Play className="h-3 w-3 flex-shrink-0" />
                            )
                          ) : (
                            <Music className="h-3 w-3 flex-shrink-0 opacity-30" />
                          )}
                          <span className="truncate flex-1">{track.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
