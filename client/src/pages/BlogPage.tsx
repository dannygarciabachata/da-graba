import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Calendar,
  Eye,
  ArrowLeft,
  User,
  Tag,
  Heart,
  Star,
  MessageCircle,
  Share2,
  Send,
  BookOpen,
  Search,
  Trash2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function BlogList() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const { data: posts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/blog/posts"],
  });
  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/blog/categories"],
  });

  const filteredPosts = (posts || []).filter((post: any) => {
    const matchesSearch =
      !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === null || post.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1
              className="text-xl font-bold"
              data-testid="text-blog-title"
            >
              {t('blog.title')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground pl-8">
            {t('blog.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('blog.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10"
                data-testid="input-blog-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={activeCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(null)}
                className="text-xs"
                data-testid="button-category-all"
              >
                Todos
              </Button>
              {(categories || []).map((cat: any) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className="text-xs"
                  data-testid={`button-category-${cat.id}`}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredPosts.length ? (
            <div className="text-center py-16">
              <div className="p-4 bg-white/5 rounded-full inline-block mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {searchQuery
                  ? t('blog.noArticles')
                  : t('blog.noArticlesYet')}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filteredPosts.map((post: any, idx: number) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link href={`/blog/${post.slug}`}>
                      <Card
                        className="overflow-hidden border-white/5 cursor-pointer group transition-all duration-300 hover:border-primary/30"
                        data-testid={`card-blog-post-${post.id}`}
                      >
                        <div className="aspect-video overflow-hidden bg-gradient-to-br from-primary/10 to-blue-600/10">
                          {post.featuredImageUrl ? (
                            <img
                              src={post.featuredImageUrl}
                              alt={post.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="h-12 w-12 text-primary/20" />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            {post.category && (
                              <Badge
                                variant="secondary"
                                className="text-xs"
                                style={{
                                  backgroundColor: (post.category.color || "#00F3FF") + "20",
                                  color: post.category.color || "#00F3FF",
                                }}
                              >
                                {post.category.name}
                              </Badge>
                            )}
                          </div>
                          <h2 className="text-base font-semibold text-white line-clamp-2 group-hover:text-primary transition-colors">
                            {post.title}
                          </h2>
                          {post.excerpt && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {post.excerpt}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {post.authorName || t('blog.defaultAuthor')}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {post.publishedAt
                                  ? formatDistanceToNow(new Date(post.publishedAt), {
                                      addSuffix: true,
                                      locale: es,
                                    })
                                  : "Borrador"}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Eye className="h-3 w-3" />
                                {post.viewCount || 0}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StarRating({
  rating,
  onRate,
  readonly = false,
  size = "md",
}: {
  rating: number;
  onRate?: (r: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const starSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-0.5" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => onRate?.(star)}
          className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`${starSize} ${
              (hover || rating) >= star
                ? "text-yellow-400 fill-yellow-400"
                : "text-white/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function BlogPostView() {
  const { t } = useTranslation();
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [commentName, setCommentName] = useState("");
  const [showShareMenu, setShowShareMenu] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null);

  const {
    data: post,
    isLoading,
    error,
  } = useQuery<any>({
    queryKey: ["/api/blog/posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const postId = post?.id;

  const { data: comments } = useQuery<any[]>({
    queryKey: ["/api/blog/posts", postId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${postId}/comments`);
      return res.json();
    },
    enabled: !!postId,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/blog/posts", postId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${postId}/stats`);
      return res.json();
    },
    enabled: !!postId,
  });

  const { data: userLiked } = useQuery<any>({
    queryKey: ["/api/blog/posts", postId, "like"],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${postId}/like`);
      if (res.status === 401) return { liked: false };
      return res.json();
    },
    enabled: !!postId,
  });

  const { data: starData } = useQuery<any>({
    queryKey: ["/api/blog/posts", postId, "stars"],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${postId}/stars`);
      return res.json();
    },
    enabled: !!postId,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/blog/posts/${postId}/like`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "like"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "stats"],
      });
    },
  });

  const starMutation = useMutation({
    mutationFn: async (rating: number) => {
      const res = await apiRequest("POST", `/api/blog/posts/${postId}/star`, {
        rating,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "stars"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "stats"],
      });
      toast({ title: "Calificación guardada" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/blog/posts/${postId}/comments`,
        {
          content: commentText,
          authorName: commentName || user?.firstName || "Anónimo",
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "comments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "stats"],
      });
      setCommentText("");
      toast({ title: "Comentario publicado" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/blog/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "comments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "stats"],
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (platform: string) => {
      await apiRequest("POST", `/api/blog/posts/${postId}/share`, { platform });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/blog/posts", postId, "stats"],
      });
    },
  });

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = post?.title || "";
    shareMutation.mutate(platform);
    setShowShareMenu(false);

    switch (platform) {
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
          "_blank"
        );
        break;
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank"
        );
        break;
      case "whatsapp":
        window.open(
          `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`,
          "_blank"
        );
        break;
      case "link":
        navigator.clipboard.writeText(url);
        toast({ title: "Enlace copiado al portapapeles" });
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="bg-card/90 border-white/10 p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Post no encontrado
          </h2>
          <p className="text-muted-foreground mb-4">
            Este artículo no existe o fue removido.
          </p>
          <Link href="/blog">
            <Button variant="outline" data-testid="button-back-to-blog">
              <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        <Link href="/blog">
          <Button
            variant="ghost"
            className="mb-4 text-muted-foreground"
            data-testid="button-back-to-blog"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
          </Button>
        </Link>

        {post.featuredImageUrl && (
          <div className="rounded-xl overflow-hidden mb-6 max-h-[400px]">
            <img
              src={post.featuredImageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
              data-testid="img-blog-featured"
            />
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {post.category && (
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: (post.category.color || "#00F3FF") + "20",
                  color: post.category.color || "#00F3FF",
                }}
              >
                {post.category.name}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.publishedAt)}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.viewCount || 0} {t('blog.views')}
            </span>
          </div>

          <h1
            className="text-3xl font-bold text-white mb-3"
            data-testid="text-blog-post-title"
          >
            {post.title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <User className="h-4 w-4" />
            <span>Por {post.authorName || t('blog.defaultAuthor')}</span>
          </div>

          {post.tags && (
            <div className="flex gap-2 flex-wrap mb-4">
              {post.tags.split(",").map((tag: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div
          className="prose prose-invert prose-sm max-w-none mb-8
            prose-headings:text-white prose-headings:font-bold
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white
            prose-code:text-primary prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-img:rounded-lg
            prose-blockquote:border-primary/50 prose-blockquote:text-gray-400"
          data-testid="blog-post-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="border-t border-white/5 pt-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant={userLiked?.liked ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!user) {
                    toast({
                      title: "Inicia sesión para dar like",
                      variant: "destructive",
                    });
                    return;
                  }
                  likeMutation.mutate();
                }}
                className="gap-2"
                data-testid="button-like-post"
              >
                <Heart
                  className={`h-4 w-4 ${userLiked?.liked ? "fill-current" : ""}`}
                />
                <span>{stats?.likes || 0}</span>
              </Button>

              <div className="flex items-center gap-2">
                <StarRating
                  rating={starData?.average || 0}
                  onRate={(r) => {
                    if (!user) {
                      toast({
                        title: "Inicia sesión para calificar",
                        variant: "destructive",
                      });
                      return;
                    }
                    starMutation.mutate(r);
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  ({starData?.count || 0})
                </span>
              </div>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="gap-2"
                  data-testid="button-share-post"
                >
                  <Share2 className="h-4 w-4" />
                  <span>{stats?.shares || 0}</span>
                </Button>

                <AnimatePresence>
                  {showShareMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full mt-2 left-0 bg-card border border-white/10 rounded-lg p-2 z-50 min-w-[160px] shadow-xl"
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/5 flex items-center gap-2"
                        onClick={() => handleShare("twitter")}
                        data-testid="button-share-twitter"
                      >
                        <ExternalLink className="h-3 w-3" /> Twitter / X
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/5 flex items-center gap-2"
                        onClick={() => handleShare("facebook")}
                        data-testid="button-share-facebook"
                      >
                        <ExternalLink className="h-3 w-3" /> Facebook
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/5 flex items-center gap-2"
                        onClick={() => handleShare("whatsapp")}
                        data-testid="button-share-whatsapp"
                      >
                        <ExternalLink className="h-3 w-3" /> WhatsApp
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-white/5 flex items-center gap-2"
                        onClick={() => handleShare("link")}
                        data-testid="button-share-link"
                      >
                        <Copy className="h-3 w-3" /> Copiar enlace
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                commentsRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className="gap-2 text-muted-foreground"
              data-testid="button-scroll-comments"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{stats?.comments || 0} {t('blog.comments')}</span>
            </Button>
          </div>
        </div>

        <div ref={commentsRef} className="border-t border-white/5 pt-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {t('blog.comments')} ({comments?.length || 0})
          </h3>

          {user ? (
            <Card className="border-white/10 p-4 mb-6">
              <div className="space-y-3">
                <Input
                  placeholder="Tu nombre (opcional)"
                  value={commentName}
                  onChange={(e) => setCommentName(e.target.value)}
                  className="bg-white/5 border-white/10"
                  data-testid="input-comment-name"
                />
                <Textarea
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="bg-white/5 border-white/10 min-h-[80px] resize-none"
                  data-testid="input-comment-text"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {commentText.length}/1000
                  </span>
                  <Button
                    size="sm"
                    onClick={() => commentMutation.mutate()}
                    disabled={
                      !commentText.trim() ||
                      commentText.length > 1000 ||
                      commentMutation.isPending
                    }
                    className="gap-2"
                    data-testid="button-submit-comment"
                  >
                    {commentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t('blog.publish')}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-white/10 p-4 mb-6 text-center">
              <p className="text-sm text-muted-foreground">
                Inicia sesión para dejar un comentario
              </p>
            </Card>
          )}

          <div className="space-y-4">
            <AnimatePresence>
              {(comments || []).map((comment: any) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card
                    className="border-white/5 p-4"
                    data-testid={`card-comment-${comment.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">
                            {comment.authorName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {comment.createdAt &&
                              formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                                locale: es,
                              })}
                          </span>
                        </div>
                      </div>
                      {user &&
                        (user as any).claims?.sub === comment.userId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground"
                            onClick={() =>
                              deleteCommentMutation.mutate(comment.id)
                            }
                            data-testid={`button-delete-comment-${comment.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                    </div>
                    <p className="text-sm text-gray-300 pl-10">
                      {comment.content}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {comments && comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('blog.beFirstToComment')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  const [isPost] = useRoute("/blog/:slug");
  if (isPost) return <BlogPostView />;
  return <BlogList />;
}
