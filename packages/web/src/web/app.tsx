import { Route, Switch, Link } from "wouter";
import { lazy, Suspense } from "react";
import { Provider } from "./components/provider";
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
const AdminLoginPage = lazy(() => import("./pages/admin-login"));
const AdminPage = lazy(() => import("./pages/admin"));

function TitledRoute({ title, children }: { title?: string; children: React.ReactNode }) {
  usePageTitle(title);
  return <>{children}</>;
}

const PageFallback = () => <div className="h-screen w-full" />;

function App() {
  return (
    <Provider>
      <ErrorBoundary>
      <Switch>
        {/* Admin — no layout */}
        <Route path="/admin/login">
          <Suspense fallback={<PageFallback />}>
            <AdminLoginPage />
          </Suspense>
        </Route>
        <Route path="/admin">
          <Suspense fallback={<PageFallback />}>
            <AdminPage />
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
              <section className="max-w-3xl mx-auto px-6 py-32 md:py-48 text-center min-h-[50vh]">
                <p className="font-en text-5xl tracking-[0.1em] text-[rgba(var(--foreground-rgb),0.18)]">404</p>
                <p className="mt-6 text-[rgba(var(--foreground-rgb),0.45)]" style={{ fontSize: "var(--body-size, 0.9rem)" }}>
                  ページが見つかりませんでした。
                </p>
                <Link to="/" className="inline-block mt-8 font-en text-xs tracking-[0.08em] text-[rgba(var(--foreground-rgb),0.40)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300">
                  ← Back to top
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
