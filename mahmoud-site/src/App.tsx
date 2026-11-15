import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import Index from "@/pages/Index";
import Brands from "@/pages/Brands";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App = () => (
  <BrowserRouter>
    <Toaster position="bottom-right" />
    <ScrollToTop />
    <Navbar />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/brands" element={<Brands />} />
      <Route path="/video" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
