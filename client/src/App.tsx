import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import AgeGate from "./components/AgeGate";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Checkout from "./pages/Checkout";
import OrderReceived from "./pages/OrderReceived";
import About from "./pages/About";
import Faq from "./pages/Faq";
import Coas from "./pages/Coas";
import Contact from "./pages/Contact";
import Policy from "./pages/Policy";
import NotFound from "./pages/NotFound";

export default function App() {
  const { pathname } = useLocation();
  // Llaves obligatorias: en Chrome reciente window.scrollTo devuelve una Promise, y si el efecto la devuelve
  // React la trata como función de limpieza y la app se cae al navegar ("l is not a function").
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    (window as unknown as { __appMounted?: boolean }).__appMounted = true;
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <ErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-received/:id" element={<OrderReceived />} />
          <Route path="/about-us" element={<About />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/coas" element={<Coas />} />
          <Route path="/contact" element={<Contact />} />
          {["shipping-policy", "return-refund", "terms-conditions", "privacy-policy"].map((slug) => (
            <Route key={slug} path={`/${slug}`} element={<Policy slug={slug} />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <CartDrawer />
      <AgeGate />
    </div>
  );
}
