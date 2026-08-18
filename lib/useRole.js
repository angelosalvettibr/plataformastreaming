"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useRole(session) {
  const [perfil, setPerfil] = useState(null);
  useEffect(() => {
    if (!session?.user?.email) return;
    supabase.from("perfis").select("*").eq("email", session.user.email.toLowerCase()).maybeSingle()
      .then(({ data }) => setPerfil(data || { nome: session.user.email.split("@")[0], role: "none" }));
  }, [session]);
  return perfil;
}
