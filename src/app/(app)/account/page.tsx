import { getCurrentUser } from "@/lib/dal";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Signed in as {user.email}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
