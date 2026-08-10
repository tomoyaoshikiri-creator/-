import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHeading } from "../AuthHeading";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    redirect(profile ? "/schedule" : "/setup");
  }

  return (
    <div>
      <AuthHeading />
      <SignupForm />
    </div>
  );
}
