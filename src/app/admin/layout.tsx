import { AdminProviders } from "./providers";
import { AdminChrome } from "./admin-chrome";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviders>
      <AdminChrome>{children}</AdminChrome>
    </AdminProviders>
  );
}
