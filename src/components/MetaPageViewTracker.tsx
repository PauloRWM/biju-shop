import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/services/metaPixel";

const MetaPageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    trackPageView();
  }, [location.pathname, location.search]);

  return null;
};

export default MetaPageViewTracker;
