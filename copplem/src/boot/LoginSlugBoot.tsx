import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function LoginSlugBoot() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  useEffect(() => {
    const slug = sp.get("loginSlug");
    if (!slug) return;

    // navega al login con el slug ya seteado
    navigate(`/login?slug=${encodeURIComponent(slug)}`, { replace: true });

    const url = new URL(window.location.href);
    url.searchParams.delete("loginSlug");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []); 

  return null;
}
