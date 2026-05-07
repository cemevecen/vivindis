import Image from "next/image";

import { Link } from "@/i18n/routing";

/**
 * Squircle mark: light PNG in light theme, dark PNG in dark theme (`class` on html).
 * Wordmark sits to the right in LTR; logo alone is not used elsewhere in the footer.
 */
export function FooterBrandLink() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
    >
      <span className="relative size-10 shrink-0" aria-hidden>
        <Image
          src="/icons/icon-48-light.png"
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-lg object-cover dark:hidden"
          sizes="40px"
        />
        <Image
          src="/icons/icon-48-dark.png"
          alt=""
          width={40}
          height={40}
          className="hidden size-10 rounded-lg object-cover dark:block"
          sizes="40px"
        />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">Vivindis</span>
    </Link>
  );
}
