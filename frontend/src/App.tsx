import { Routes, Route } from "react-router-dom";
import Layout    from "@/components/Layout";
import Landing   from "@/pages/Landing";
import Checkout  from "@/pages/Checkout";
import Dashboard from "@/pages/Dashboard";
import Docs      from "@/pages/Docs";
import Store     from "@/pages/Store";
import Demo      from "@/pages/Demo";
import NotFound  from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index                      element={<Landing />}   />
        <Route path="checkout/:paymentId" element={<Checkout />}  />
        <Route path="dashboard"           element={<Dashboard />} />
        <Route path="docs"                element={<Docs />}      />
        <Route path="store"               element={<Store />}     />
        <Route path="demo"                element={<Demo />}      />
        <Route path="*"                   element={<NotFound />}  />
      </Route>
    </Routes>
  );
}
