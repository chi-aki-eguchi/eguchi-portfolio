import { Route, Switch, Link, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { Provider, useServiceVisibility } from "./components/provider";
import PageTransition from "./components/PageTransition";
import { usePageTitle } from "./hooks/usePageTitle";
import Layout from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy-load all pages — only the shell is eagerly loaded
const TopPage = lazy(() => import("./pages/top"));
const GalleryPage = lazy(() => import("./pages/gallery"));
const SeriesListPage = lazy(() => import("./pages/series"));
const SeriesDetailPage = lazy(() => import("./pages/series-detail"));
const ProfilePage = lazy(() => import("./pages/profile"));
const ContactPage = lazy(() => import("./pages/contact"));
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

function App() {
  return (
    <Provider>
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
                <TitledRoute title="Gallery">
                  <Suspense fallback={<PageFallback />}>
                    <GalleryPage />
                  </Suspense>
                </TitledRoute>
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
                <TitledRoute title="Series">
                  <Suspense fallback={<PageFallback />}>
                    <SeriesListPage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/about">
            <Layout>
              <PageTransition>
                <TitledRoute title="About">
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
                <TitledRoute title="About">
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
                <TitledRoute title="Contact">
                  <Suspense fallback={<PageFallback />}>
                    <ContactPage />
                  </Suspense>
                </TitledRoute>
              </PageTransition>
            </Layout>
          </Route>
          <Route path="/service/start">
            <LegacyPortfolioKitRedirect to="/portfolio-kit/start" />
          </Route>
          <Route path="/service">
            <LegacyPortfolioKitRedirect to="/portfolio-kit" />
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
                  <p className="font-en text-sm tracking-[0.18em] uppercase text-[rgba(var(--foreground-rgb),0.35)] -mt-4 md:-mt-6">
                    Page not found
                  </p>
                  <div className="w-8 h-px bg-[rgba(var(--foreground-rgb),0.12)] mt-8 mb-8" />
                  <p
                    className="text-[rgba(var(--foreground-rgb),0.40)]"
                    style={{
                      fontSize: "var(--body-size, 0.85rem)",
                      lineHeight: 1.9,
                    }}
                  >
                    お探しのページは存在しないか、移動した可能性があります。
                  </p>
                  <Link
                    to="/"
                    className="inline-block mt-10 font-en text-[11px] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.35)] hover:text-[rgba(var(--foreground-rgb),0.65)] nav-link-luxury transition-colors duration-300"
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
