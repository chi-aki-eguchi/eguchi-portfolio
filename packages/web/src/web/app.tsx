import { Route, Switch, Link, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { Provider, useServiceVisibility } from "./components/provider";
import PageTransition from "./components/PageTransition";
import { usePageTitle } from "./hooks/usePageTitle";
import { PAGE_TITLE } from "../shared/site-title";
import Layout from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type {
  PolicyKind,
  PolicyLanguage,
} from "../shared/policy-content";
import { PublicAnalytics } from "./components/PublicAnalytics";

// Lazy-load all pages — only the shell is eagerly loaded
const TopPage = lazy(() => import("./pages/top"));
const GalleryPage = lazy(() => import("./pages/gallery"));
const SeriesListPage = lazy(() => import("./pages/series"));
const SeriesDetailPage = lazy(() => import("./pages/series-detail"));
const PhotoDetailPage = lazy(() => import("./pages/photo-detail"));
const ProfilePage = lazy(() => import("./pages/profile"));
const ContactPage = lazy(() => import("./pages/contact"));
const PolicyPage = lazy(() => import("./pages/policy"));
const ServicePage = lazy(() => import("./pages/service"));
const ServiceStartPage = lazy(() => import("./pages/service-start"));
const AdminLoginPage = lazy(() => import("./pages/admin-login"));
const AdminPage = lazy(() => import("./pages/admin"));
const AdminDemoPage = lazy(() => import("./pages/admin-demo"));

function TitledRoute({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  usePageTitle(title);
  return <>{children}</>;
}

const PageFallback = () => <div className="h-screen w-full" />;

function ServiceVisibilityGate({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { isResolved, showService } = useServiceVisibility();

  useEffect(() => {
    if (isResolved && !showService) navigate("/", { replace: true });
  }, [isResolved, navigate, showService]);

  if (!isResolved || !showService) return <PageFallback />;
  return <>{children}</>;
}

function LegacyPortfolioKitRedirect({ to }: { to: string }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);

  return <PageFallback />;
}

function PublicPolicyRoute({
  kind,
  language,
  title,
  requiresService = false,
}: {
  kind: PolicyKind;
  language: PolicyLanguage;
  title: string;
  requiresService?: boolean;
}) {
  const page = (
    <Layout>
      <PageTransition>
        <TitledRoute title={title}>
          <Suspense fallback={<PageFallback />}>
            <PolicyPage kind={kind} language={language} />
          </Suspense>
        </TitledRoute>
      </PageTransition>
    </Layout>
  );
  return requiresService ? (
    <ServiceVisibilityGate>{page}</ServiceVisibilityGate>
  ) : (
    page
  );
}

function App() {
  return (
    <Provider>
      <PublicAnalytics />
      <ErrorBoundary>
        <Switch>
          {/* Admin — no layout */}
          <Route path="/admin/demo">
            <Suspense fallback={<PageFallback />}>
              <TitledRoute title="Admin Demo">
                <AdminDemoPage />
              </TitledRoute>
            </Suspense>
          </Route>
          <Route path="/admin/login">
            <Suspense fallback={<PageFallback />}>
              <TitledRoute title="Admin Login">
                <AdminLoginPage />
              </TitledRoute>
            </Suspense>
          </Route>
          <Route path="/admin">
            <Suspense fallback={<PageFallback />}>
              <TitledRoute title="Admin">
                <AdminPage />
              </TitledRoute>
            </Suspense>
          </Route>
          {/* Portfolio */}
          <Route path="/gallery">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.gallery}>
                  <Suspense fallback={<PageFallback />}>
                    <GalleryPage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          {/* 写真1枚ぶんの着地ページ。ここが無いと `/photo/:id` はサーバで
              実在確認できても、クライアント側に何も描かれない。 */}
          <Route path="/photo/:id">
            <Layout>
              <PageTransition>
                <Suspense fallback={<PageFallback />}>
                  <PhotoDetailPage />
                </Suspense>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/series/:slug">
            <Layout>
              <PageTransition>
                <Suspense fallback={<PageFallback />}>
                  <SeriesDetailPage />
                </Suspense>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/series">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.series}>
                  <Suspense fallback={<PageFallback />}>
                    <SeriesListPage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          {/* Work の棚（2026-08-30）。シリーズと同じ部品に棚だけ渡す。
              詳細は `/series/:slug` と同じ部品で、戻り先だけ棚に合わせる。 */}
          <Route path="/work/:slug">
            <Layout>
              <PageTransition>
                <Suspense fallback={<PageFallback />}>
                  <SeriesDetailPage />
                </Suspense>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/work">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.work}>
                  <Suspense fallback={<PageFallback />}>
                    <SeriesListPage kind="work" />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/about">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.about}>
                  <Suspense fallback={<PageFallback />}>
                    <ProfilePage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/profile">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.about}>
                  <Suspense fallback={<PageFallback />}>
                    <ProfilePage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/contact">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.contact}>
                  <Suspense fallback={<PageFallback />}>
                    <ContactPage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/en/about">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.about}>
                  <Suspense fallback={<PageFallback />}>
                    <ProfilePage language="en" />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/en/contact">
            <Layout>
              <PageTransition>
                <TitledRoute title={PAGE_TITLE.contactEn}>
                  <Suspense fallback={<PageFallback />}>
                    <ContactPage language="en" />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/privacy/en">
            <PublicPolicyRoute
              kind="privacy"
              language="en"
              title={PAGE_TITLE.privacyEn}
            />
          </Route>
          <Route path="/privacy">
            <PublicPolicyRoute
              kind="privacy"
              language="ja"
              title={PAGE_TITLE.privacy}
            />
          </Route>
          <Route path="/terms/en">
            <PublicPolicyRoute
              kind="terms"
              language="en"
              title={PAGE_TITLE.termsEn}
            />
          </Route>
          <Route path="/terms">
            <PublicPolicyRoute
              kind="terms"
              language="ja"
              title={PAGE_TITLE.terms}
            />
          </Route>
          <Route path="/legal/en">
            <PublicPolicyRoute
              kind="legal"
              language="en"
              title={PAGE_TITLE.legalEn}
              requiresService
            />
          </Route>
          <Route path="/legal">
            <PublicPolicyRoute
              kind="legal"
              language="ja"
              title={PAGE_TITLE.legal}
              requiresService
            />
          </Route>
          <Route path="/service/start/en">
            <LegacyPortfolioKitRedirect to="/start/en" />
          </Route>
          <Route path="/service/en">
            <LegacyPortfolioKitRedirect to="/portfolio-kit/en" />
          </Route>
          <Route path="/service/start">
            <LegacyPortfolioKitRedirect to="/portfolio-kit/start" />
          </Route>
          <Route path="/service">
            <LegacyPortfolioKitRedirect to="/portfolio-kit" />
          </Route>
          <Route path="/portfolio-kit/start/en">
            <LegacyPortfolioKitRedirect to="/start/en" />
          </Route>
          <Route path="/start/en">
            <ServiceVisibilityGate>
              <Layout>
                <PageTransition>
                  <TitledRoute title="Portfolio Kit Start — English">
                    <Suspense fallback={<PageFallback />}>
                      <ServiceStartPage language="en" />
                    </Suspense>
                  </TitledRoute>
                </PageTransition>
              </Layout>
            </ServiceVisibilityGate>
          </Route>
          <Route path="/start">
            <ServiceVisibilityGate>
              <Layout>
                <PageTransition>
                  <TitledRoute title="Portfolio Kit Start">
                    <Suspense fallback={<PageFallback />}>
                      <ServiceStartPage />
                    </Suspense>
                  </TitledRoute>
                </PageTransition>
              </Layout>
            </ServiceVisibilityGate>
          </Route>
          <Route path="/portfolio-kit/start">
            <ServiceVisibilityGate>
              <Layout>
                <PageTransition>
                  <TitledRoute title="Portfolio Kit Start">
                    <Suspense fallback={<PageFallback />}>
                      <ServiceStartPage />
                    </Suspense>
                  </TitledRoute>
                </PageTransition>
              </Layout>
            </ServiceVisibilityGate>
          </Route>
          <Route path="/portfolio-kit/en">
            <ServiceVisibilityGate>
              <Layout>
                <PageTransition>
                  <TitledRoute title="Portfolio Kit — English">
                    <Suspense fallback={<PageFallback />}>
                      <ServicePage language="en" />
                    </Suspense>
                  </TitledRoute>
                </PageTransition>
              </Layout>
            </ServiceVisibilityGate>
          </Route>
          <Route path="/portfolio-kit">
            <ServiceVisibilityGate>
              <Layout>
                <PageTransition>
                  <TitledRoute title="Portfolio Kit">
                    <Suspense fallback={<PageFallback />}>
                      <ServicePage />
                    </Suspense>
                  </TitledRoute>
                </PageTransition>
              </Layout>
            </ServiceVisibilityGate>
          </Route>
          <Route path="/">
            <Layout>
              <PageTransition>
                <TitledRoute>
                  <Suspense fallback={<PageFallback />}>
                    <TopPage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          {/* Catch-all 404 — avoids a blank screen on unknown SPA paths */}
          <Route>
            <Layout>
              <TitledRoute title="Not Found">
                <section className="max-w-3xl mx-auto px-6 py-32 md:py-48 text-center min-h-[60vh] flex flex-col items-center justify-center">
                  <p
                    className="font-en text-[7rem] md:text-[9rem] leading-none tracking-[0.08em] text-[rgba(var(--foreground-rgb),0.06)] font-light select-none"
                    aria-hidden="true"
                  >
                    404
                  </p>
                  {/* Every other route has exactly one h1; this page had none,
                      so assistive tech and crawlers saw an untitled document. */}
                  <h1 className="font-en text-sm tracking-[0.18em] uppercase text-[color:var(--text-quiet)] -mt-4 md:-mt-6">
                    Page not found
                  </h1>
                  <div className="w-8 h-px bg-[rgba(var(--foreground-rgb),0.12)] mt-8 mb-8" />
                  <p
                    className="text-[color:var(--text-quiet)]"
                    style={{
                      fontSize: "var(--body-size, 0.85rem)",
                      lineHeight: 1.9,
                    }}
                  >
                    お探しのページは存在しないか、移動した可能性があります。
                  </p>
                  <Link
                    to="/"
                    className="inline-block mt-10 font-en text-[11px] tracking-[0.12em] uppercase text-[color:var(--text-quiet)] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] nav-link-luxury transition-colors duration-300"
                  >
                    Back to top
                  </Link>
                </section>
              </TitledRoute>
            </Layout>
          </Route>
        </Switch>
      </ErrorBoundary>
    </Provider>
  );
}

export default App;
