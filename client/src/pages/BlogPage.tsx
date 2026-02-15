import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Eye, ArrowLeft, User, Tag } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
}

function BlogList() {
  const { data: posts, isLoading } = useQuery<any[]>({ queryKey: ["/api/blog/posts"] });
  const { data: categories } = useQuery<any[]>({ queryKey: ["/api/blog/categories"] });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-blog-title">DGB Audio Blog</h1>
          <p className="text-muted-foreground">Noticias, tutoriales y actualizaciones de DGB Studio</p>
        </div>

        {categories && categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6" data-testid="blog-categories-filter">
            {categories.map((cat: any) => (
              <Badge key={cat.id} variant="outline" className="cursor-pointer hover:bg-primary/20" style={{ borderColor: cat.color || "#00F3FF" }}>
                {cat.name}
              </Badge>
            ))}
          </div>
        )}

        {(!posts || posts.length === 0) ? (
          <Card className="bg-card/50 border-white/10">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground text-lg">No hay publicaciones aún. ¡Pronto habrá contenido nuevo!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post: any) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card
                  className="bg-card/50 border-white/10 hover:border-primary/40 transition-all cursor-pointer group overflow-hidden"
                  data-testid={`card-blog-post-${post.id}`}
                >
                  {post.featuredImageUrl && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={post.featuredImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      {post.category && (
                        <Badge variant="secondary" className="text-xs" style={{ backgroundColor: (post.category.color || "#00F3FF") + "20", color: post.category.color || "#00F3FF" }}>
                          {post.category.name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.publishedAt)}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {post.authorName || "DGB Audio"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {post.viewCount || 0} vistas
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlogPostView() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  const { data: post, isLoading, error } = useQuery<any>({
    queryKey: ["/api/blog/posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="bg-card/50 border-white/10 p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Post no encontrado</h2>
          <p className="text-muted-foreground mb-4">Este artículo no existe o fue removido.</p>
          <Link href="/blog">
            <Button variant="outline" data-testid="button-back-to-blog">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver al blog
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {post.seoTitle && (
        <title>{post.seoTitle}</title>
      )}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/blog">
          <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-white" data-testid="button-back-to-blog">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al blog
          </Button>
        </Link>

        {post.featuredImageUrl && (
          <div className="rounded-xl overflow-hidden mb-6 max-h-[400px]">
            <img src={post.featuredImageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {post.category && (
              <Badge variant="secondary" style={{ backgroundColor: (post.category.color || "#00F3FF") + "20", color: post.category.color || "#00F3FF" }}>
                {post.category.name}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.publishedAt)}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.viewCount || 0} vistas
            </span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3" data-testid="text-blog-post-title">{post.title}</h1>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <User className="h-4 w-4" />
            <span>Por {post.authorName || "DGB Audio"}</span>
          </div>

          {post.tags && (
            <div className="flex gap-2 flex-wrap mb-6">
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
          className="prose prose-invert prose-sm max-w-none
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
      </div>
    </div>
  );
}

export default function BlogPage() {
  const [isPost] = useRoute("/blog/:slug");
  if (isPost) return <BlogPostView />;
  return <BlogList />;
}
